import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  buildRuleSet,
  RULE_DOMAINS,
  type RuleDomain,
  type RulePayloads,
  type RuleSet,
} from "@jsl/calc-engine";
import { ConfigDomain, Role, RuleSetStatus } from "../generated/prisma/client";
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { DB_TO_ENGINE, ENGINE_TO_DB } from "./domain-map";

export interface ActiveVersionInfo {
  id: string;
  dbDomain: ConfigDomain;
  version: string;
  effectiveFrom: Date;
  sourceGazette: string | null;
}

interface ActiveBundle {
  ruleSet: RuleSet;
  payloads: RulePayloads;
  versions: Record<RuleDomain, ActiveVersionInfo>;
}

const CACHE_TTL_MS = 30_000;

/**
 * ADR-002 in code: rules are versioned rows, never files. The /config/*.json
 * seeds enter the DB once (prisma/seed.ts); from then on the Admin Panel
 * drafts → validates → publishes, and every calculation records the exact
 * version ids it consumed — byte-reproducible history after gazette changes.
 */
@Injectable()
export class RulesService {
  private readonly logger = new Logger(RulesService.name);
  private cache: { bundle: ActiveBundle; at: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  invalidate(): void {
    this.cache = null;
  }

  /** The assembled, engine-validated active rule-set (cached ~30 s). */
  async active(): Promise<ActiveBundle> {
    if (this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) return this.cache.bundle;

    const now = new Date();
    const rows = await this.prisma.ruleSetVersion.findMany({
      where: { status: RuleSetStatus.ACTIVE, effectiveFrom: { lte: now } },
      orderBy: [{ domain: "asc" }, { effectiveFrom: "desc" }],
    });

    const byDomain = new Map<ConfigDomain, (typeof rows)[number]>();
    for (const row of rows) if (!byDomain.has(row.domain)) byDomain.set(row.domain, row);

    const missing = (Object.values(ConfigDomain) as ConfigDomain[]).filter((d) => !byDomain.has(d));
    if (missing.length)
      throw new ServiceUnavailableException(
        `No ACTIVE rule-set for domain(s): ${missing.join(", ")}. Run the seed (npm --prefix apps/api run db:seed) or publish versions in the Admin Panel.`,
      );

    const payloads = {} as RulePayloads;
    const versions = {} as Record<RuleDomain, ActiveVersionInfo>;
    for (const [db, row] of byDomain) {
      const eng = DB_TO_ENGINE[db];
      payloads[eng] = row.payload as unknown;
      versions[eng] = {
        id: row.id,
        dbDomain: db,
        version: row.version,
        effectiveFrom: row.effectiveFrom,
        sourceGazette: row.sourceGazette,
      };
    }

    const ruleSet = buildRuleSet(payloads); // throws [rules:domain] … → 422 via filter
    const bundle: ActiveBundle = { ruleSet, payloads, versions };
    this.cache = { bundle, at: Date.now() };
    return bundle;
  }

  /** Public seam consumed by the web app in place of the bundled /config seeds. */
  async activeBundleForClients() {
    const { payloads, versions } = await this.active();
    return { generatedAt: new Date().toISOString(), versions, payloads };
  }

  listVersions(domain: ConfigDomain, status?: RuleSetStatus) {
    return this.prisma.ruleSetVersion.findMany({
      where: { domain, ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, domain: true, version: true, status: true, effectiveFrom: true,
        effectiveTo: true, changeNote: true, sourceGazette: true, createdAt: true,
        publishedBy: { select: { id: true, fullName: true, email: true } },
      },
    });
  }

  async getVersion(id: string) {
    const row = await this.prisma.ruleSetVersion.findUnique({
      where: { id },
      include: { publishedBy: { select: { id: true, fullName: true, email: true } } },
    });
    if (!row) throw new NotFoundException("Rule-set version not found.");
    return row;
  }

  /**
   * Structural validation for a draft: swap the candidate payload into the
   * current active set and run the engine's own buildRuleSet. Cross-domain
   * invariants (contiguous excise bands, duty-component ordering, …) are
   * enforced by the exact code the calculator runs — ADR-001's guarantee
   * extended to authoring time.
   */
  private async validateCandidate(domain: ConfigDomain, payload: unknown): Promise<void> {
    const { payloads } = await this.active();
    const candidate = { ...payloads, [DB_TO_ENGINE[domain]]: payload } as RulePayloads;
    buildRuleSet(candidate); // throws with a precise [rules:…] message
  }

  async createDraft(
    domain: ConfigDomain,
    dto: { version: string; payload: unknown; changeNote?: string; sourceGazette?: string; effectiveFrom?: string },
    byUserId: string,
  ) {
    if (payloadMeta(dto.payload)?.domain && payloadMeta(dto.payload)!.domain !== domain)
      throw new BadRequestException(
        `payload._meta.domain '${payloadMeta(dto.payload)!.domain}' does not match route domain '${domain}'.`,
      );
    await this.validateCandidate(domain, dto.payload);

    const row = await this.prisma.ruleSetVersion.create({
      data: {
        domain,
        version: dto.version,
        payload: dto.payload as object,
        status: RuleSetStatus.DRAFT,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date(),
        changeNote: dto.changeNote,
        sourceGazette: dto.sourceGazette,
      },
    });
    this.audit.log("rules.draft_created", {
      userId: byUserId, entity: "RuleSetVersion", entityId: row.id,
      metadata: { domain, version: dto.version },
    });
    return row;
  }

  async publish(id: string, byUserId: string, effectiveFromIso?: string) {
    const draft = await this.prisma.ruleSetVersion.findUnique({ where: { id } });
    if (!draft) throw new NotFoundException("Rule-set version not found.");
    if (draft.status === RuleSetStatus.RETIRED)
      throw new BadRequestException("A retired version cannot be re-published; create a new draft from it.");
    if (draft.status === RuleSetStatus.ACTIVE) return draft; // idempotent

    await this.validateCandidate(draft.domain, draft.payload);
    const effectiveFrom = effectiveFromIso ? new Date(effectiveFromIso) : new Date();

    const published = await this.prisma.$transaction(async (tx) => {
      await tx.ruleSetVersion.updateMany({
        where: { domain: draft.domain, status: RuleSetStatus.ACTIVE },
        data: { status: RuleSetStatus.RETIRED, effectiveTo: effectiveFrom },
      });
      return tx.ruleSetVersion.update({
        where: { id },
        data: { status: RuleSetStatus.ACTIVE, effectiveFrom, publishedById: byUserId },
      });
    });

    this.invalidate();
    this.audit.log("rules.publish", {
      userId: byUserId, entity: "RuleSetVersion", entityId: id,
      metadata: { domain: draft.domain, version: draft.version },
    });
    await this.notifications.notifyRoleAtLeast(
      Role.ADMIN, "rule_change",
      `Rules published: ${draft.domain} ${draft.version}`,
      draft.changeNote ?? `Domain ${draft.domain} is now on version ${draft.version}.`,
    );
    this.logger.log(`published ${draft.domain} ${draft.version} (${id})`);
    return published;
  }

  /** Path-level structural diff between two versions (Admin Panel's diff view). */
  async diff(aId: string, bId: string) {
    const [a, b] = await Promise.all([this.getVersion(aId), this.getVersion(bId)]);
    if (a.domain !== b.domain)
      throw new BadRequestException(`Cannot diff across domains (${a.domain} vs ${b.domain}).`);
    return {
      domain: a.domain,
      a: { id: a.id, version: a.version, status: a.status },
      b: { id: b.id, version: b.version, status: b.status },
      changes: diffPaths(a.payload, b.payload),
      payloads: { a: a.payload, b: b.payload },
    };
  }
}

/* ── helpers ── */

function payloadMeta(p: unknown): { domain?: string; version?: string } | undefined {
  if (p && typeof p === "object" && "_meta" in p) {
    const meta = (p as { _meta?: unknown })._meta;
    if (meta && typeof meta === "object") return meta as { domain?: string; version?: string };
  }
  return undefined;
}

export interface PathChange {
  path: string;
  kind: "added" | "removed" | "changed";
  from?: unknown;
  to?: unknown;
}

/** Deterministic leaf-level diff, capped at 200 entries to keep responses sane. */
export function diffPaths(a: unknown, b: unknown, base = "", out: PathChange[] = []): PathChange[] {
  if (out.length >= 200) return out;
  const isObj = (x: unknown): x is Record<string, unknown> =>
    typeof x === "object" && x !== null && !Array.isArray(x);

  if (Array.isArray(a) && Array.isArray(b)) {
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) diffPaths(a[i], b[i], `${base}[${i}]`, out);
    return out;
  }
  if (isObj(a) && isObj(b)) {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const path = base ? `${base}.${key}` : key;
      if (!(key in a)) out.push({ path, kind: "added", to: b[key] });
      else if (!(key in b)) out.push({ path, kind: "removed", from: a[key] });
      else diffPaths(a[key], b[key], path, out);
      if (out.length >= 200) return out;
    }
    return out;
  }
  if (JSON.stringify(a) !== JSON.stringify(b))
    out.push({ path: base || "(root)", kind: "changed", from: a, to: b });
  return out;
}
