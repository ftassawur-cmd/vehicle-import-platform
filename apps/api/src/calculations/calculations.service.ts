import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { calculate, type CalcInputs, type CalcResult } from "@jsl/calc-engine";
import { Prisma, Role, ShippingMethod } from "../generated/prisma/client";
import { AuditService } from "../audit/audit.service";
import { hasRoleAtLeast, isMemberOf, type RequestUser } from "../common/types";
import { PrismaService } from "../prisma/prisma.service";
import { RulesService } from "../rules/rules.service";
import { assertCalcInputs } from "./calc-inputs.assert";

const METHOD_MAP: Record<CalcInputs["shipping"]["method"], ShippingMethod> = {
  roro: ShippingMethod.RORO,
  container: ShippingMethod.CONTAINER,
};

export interface PersistedCalc {
  id: string;
  createdAt: Date;
  title: string | null;
  pinned: boolean;
  parentId: string | null;
  result: CalcResult;
}

/**
 * ADR-001, server half: the browser previews with the same engine, but only
 * this service's run is authoritative — persisted with the full step trace
 * AND the RuleSetVersion ids consumed, so every historical quote replays
 * byte-identically after gazette changes.
 */
@Injectable()
export class CalculationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: RulesService,
    private readonly audit: AuditService,
  ) {}

  async create(
    user: RequestUser,
    dto: { inputs: unknown; title?: string; orgId?: string; variantId?: string; parentId?: string },
    ip?: string,
  ): Promise<PersistedCalc> {
    assertCalcInputs(dto.inputs);

    if (dto.orgId && !isMemberOf(user, dto.orgId) && !hasRoleAtLeast(user, Role.ADMIN))
      throw new ForbiddenException("You are not a member of that organization.");
    if (dto.variantId) {
      const variant = await this.prisma.vehicleVariant.findUnique({ where: { id: dto.variantId }, select: { id: true } });
      if (!variant) throw new NotFoundException("Vehicle variant not found.");
    }
    if (dto.parentId) await this.getAccessible(user, dto.parentId); // authorizes + existence

    const { ruleSet, versions } = await this.rules.active();
    const result = calculate(dto.inputs, ruleSet);

    const ruleVersionsMap = Object.fromEntries(
      Object.entries(versions).map(([eng, info]) => [eng, info.id]),
    );

    const row = await this.prisma.calculation.create({
      data: {
        userId: user.id,
        orgId: dto.orgId,
        variantId: dto.variantId,
        parentId: dto.parentId,
        title: dto.title,
        inputs: dto.inputs as unknown as Prisma.InputJsonValue,
        resultSnapshot: result as unknown as Prisma.InputJsonValue,
        totalLandedLkr: new Prisma.Decimal(result.totals.landedAtPortLkr),
        shippingMethod: METHOD_MAP[dto.inputs.shipping.method],
        ruleSetVersionId: versions.taxRules.id,
        ruleVersionsMap,
      },
      select: { id: true, createdAt: true, title: true, pinned: true, parentId: true },
    });

    this.audit.log("calc.create", {
      userId: user.id, entity: "Calculation", entityId: row.id, ip,
      metadata: {
        onRoadLkr: result.totals.onRoadLkr,
        taxRulesVersion: versions.taxRules.version,
        importable: result.eligibility.importable,
      },
    });
    return { ...row, result };
  }

  async list(user: RequestUser, opts: { orgId?: string; pinned?: boolean; take?: number; skip?: number }) {
    const take = Math.min(Math.max(opts.take ?? 50, 1), 100);
    const skip = Math.max(opts.skip ?? 0, 0);

    let where: Prisma.CalculationWhereInput;
    if (opts.orgId) {
      if (!isMemberOf(user, opts.orgId) && !hasRoleAtLeast(user, Role.ADMIN))
        throw new ForbiddenException("You are not a member of that organization.");
      where = { orgId: opts.orgId };
    } else {
      where = { userId: user.id };
    }
    if (opts.pinned !== undefined) where = { ...where, pinned: opts.pinned };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.calculation.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip,
        select: {
          id: true, title: true, createdAt: true, pinned: true, parentId: true,
          totalLandedLkr: true, shippingMethod: true,
          variant: {
            select: {
              id: true, code: true, yearFrom: true,
              model: { select: { name: true, make: { select: { name: true } } } },
            },
          },
          ruleSetVersion: { select: { id: true, version: true } },
        },
      }),
      this.prisma.calculation.count({ where }),
    ]);
    return { total, take, skip, items };
  }

  private async getAccessible(user: RequestUser, id: string) {
    const row = await this.prisma.calculation.findUnique({
      where: { id },
      include: {
        variant: {
          select: {
            id: true, code: true, yearFrom: true, fuelType: true, engineCc: true,
            model: { select: { name: true, make: { select: { name: true } } } },
          },
        },
        ruleSetVersion: { select: { id: true, version: true, sourceGazette: true } },
        revisions: { select: { id: true, createdAt: true, title: true }, orderBy: { createdAt: "desc" } },
      },
    });
    if (!row) throw new NotFoundException("Calculation not found.");
    const allowed =
      row.userId === user.id ||
      (row.orgId !== null && isMemberOf(user, row.orgId)) ||
      hasRoleAtLeast(user, Role.ADMIN);
    if (!allowed) throw new ForbiddenException("You do not have access to this calculation.");
    return row;
  }

  get(user: RequestUser, id: string) {
    return this.getAccessible(user, id);
  }

  async setPinned(user: RequestUser, id: string, pinned: boolean) {
    const row = await this.getAccessible(user, id);
    return this.prisma.calculation.update({
      where: { id: row.id },
      data: { pinned },
      select: { id: true, pinned: true },
    });
  }

  /** New version in the history chain: same authorization as reading the parent. */
  async revise(
    user: RequestUser,
    parentId: string,
    dto: { inputs: unknown; title?: string },
    ip?: string,
  ): Promise<PersistedCalc> {
    const parent = await this.getAccessible(user, parentId);
    return this.create(
      user,
      {
        inputs: dto.inputs,
        title: dto.title ?? parent.title ?? undefined,
        orgId: parent.orgId ?? undefined,
        variantId: parent.variantId ?? undefined,
        parentId,
      },
      ip,
    );
  }
}
