import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ConfigDomain, Prisma, Role, RuleSetStatus } from "../generated/prisma/client";
import { AuditService } from "../audit/audit.service";
import { env } from "../config/env";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { RulesService } from "../rules/rules.service";

export interface RateInput {
  pair: string; // "JPY/LKR"
  rate: number;
  asOf: string; // ISO date
  source: string; // customs_weekly | market | manual | …
  confidence?: string; // official | reported | estimate
}

const PAIR_RE = /^[A-Z]{3}\/LKR$/;

/**
 * FX stays inside the rule system (ADR-002/005): ingesting rates writes the
 * ExchangeRate history table AND auto-publishes a new EXCHANGE_RATES
 * RuleSetVersion assembled from the freshest rate per pair — so calculations
 * keep recording exactly which fx version they consumed.
 */
@Injectable()
export class FxService {
  private readonly logger = new Logger(FxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: RulesService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Freshest stored rate per pair, with staleness computed against FX_STALE_AFTER_HOURS. */
  async latest() {
    const rows = await this.prisma.exchangeRate.findMany({
      orderBy: [{ pair: "asc" }, { asOf: "desc" }, { createdAt: "desc" }],
    });
    const seen = new Set<string>();
    const staleCutoff = Date.now() - env.fxStaleAfterHours * 3_600_000;
    const latest = rows
      .filter((r) => (seen.has(r.pair) ? false : (seen.add(r.pair), true)))
      .map((r) => ({
        pair: r.pair,
        rate: Number(r.rate),
        asOf: r.asOf.toISOString().slice(0, 10),
        source: r.source,
        stale: r.asOf.getTime() < staleCutoff,
      }));
    return { staleAfterHours: env.fxStaleAfterHours, rates: latest };
  }

  async ingest(rates: RateInput[], byUserId: string, ip?: string) {
    for (const r of rates) {
      if (!PAIR_RE.test(r.pair))
        throw new BadRequestException(`pair '${r.pair}' must look like 'JPY/LKR' (XXX/LKR).`);
      if (!(r.rate > 0)) throw new BadRequestException(`rate for ${r.pair} must be > 0.`);
      if (Number.isNaN(Date.parse(r.asOf)))
        throw new BadRequestException(`asOf for ${r.pair} must be an ISO date.`);
    }

    // 1) Append to the ExchangeRate history (idempotent on [pair, asOf, source]).
    let inserted = 0;
    for (const r of rates) {
      try {
        await this.prisma.exchangeRate.create({
          data: { pair: r.pair, rate: new Prisma.Decimal(r.rate), asOf: new Date(r.asOf), source: r.source },
        });
        inserted++;
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue; // same reading re-posted
        throw e;
      }
    }

    // 2) Assemble a fresh fx payload (current active _meta + freshest rate per pair)
    //    and publish it through the normal rules pipeline.
    const { payloads } = await this.rules.active();
    const current = payloads.fx as {
      _meta: Record<string, unknown>;
      rates: { pair: string; rate: number; asOf: string; source: string; confidence?: string; stale?: boolean }[];
      [k: string]: unknown;
    };

    const merged = new Map(current.rates.map((r) => [r.pair, { ...r }]));
    for (const r of rates) {
      const existing = merged.get(r.pair);
      if (!existing || Date.parse(r.asOf) >= Date.parse(existing.asOf)) {
        merged.set(r.pair, {
          pair: r.pair,
          rate: r.rate,
          asOf: r.asOf,
          source: r.source,
          confidence: r.confidence ?? "reported",
          stale: false,
        });
      }
    }
    const staleCutoff = Date.now() - env.fxStaleAfterHours * 3_600_000;
    const nextRates = [...merged.values()]
      .map((r) => ({ ...r, stale: Date.parse(r.asOf) < staleCutoff }))
      .sort((a, b) => a.pair.localeCompare(b.pair));

    // Millisecond stamp + one retry keeps rapid successive ingests collision-free
    // on the [domain, version] unique key.
    const mkVersion = (): string =>
      `fx-${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 17)}`;
    let version = mkVersion();
    const mkPayload = (v: string) => ({
      ...current,
      _meta: { ...current._meta, version: v, notes: `Auto-published by FX ingest (${rates.length} reading(s)).` },
      rates: nextRates,
    });

    let draft;
    try {
      draft = await this.rules.createDraft(
        ConfigDomain.EXCHANGE_RATES,
        { version, payload: mkPayload(version), changeNote: `FX ingest: ${rates.map((r) => `${r.pair}=${r.rate}`).join(", ")}` },
        byUserId,
      );
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
      version = `${mkVersion()}-${Math.floor(Math.random() * 1000)}`;
      draft = await this.rules.createDraft(
        ConfigDomain.EXCHANGE_RATES,
        { version, payload: mkPayload(version), changeNote: `FX ingest: ${rates.map((r) => `${r.pair}=${r.rate}`).join(", ")}` },
        byUserId,
      );
    }
    const published = await this.rules.publish(draft.id, byUserId);

    this.audit.log("fx.ingest", {
      userId: byUserId, entity: "RuleSetVersion", entityId: published.id, ip,
      metadata: { inserted, pairs: rates.map((r) => r.pair) },
    });
    this.logger.log(`fx ingest: ${inserted} new reading(s) → published ${version}`);

    const nowStale = nextRates.filter((r) => r.stale).map((r) => r.pair);
    if (nowStale.length)
      await this.notifications.notifyRoleAtLeast(
        Role.ADMIN, "fx_stale",
        "Stale exchange rates",
        `Pairs older than ${env.fxStaleAfterHours}h: ${nowStale.join(", ")}.`,
      );

    return { inserted, publishedVersion: published.version, ruleSetVersionId: published.id, rates: nextRates };
  }

  /** Nightly-style staleness sweep exposed for ops (also callable from CI smoke). */
  async staleReport() {
    const { rates, staleAfterHours } = await this.latest();
    const stale = rates.filter((r) => r.stale);
    return { staleAfterHours, staleCount: stale.length, stale };
  }
}
