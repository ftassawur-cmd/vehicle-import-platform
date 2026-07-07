import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, QuotationStatus, Role } from "../generated/prisma/client";
import { AuditService } from "../audit/audit.service";
import { hasRoleAtLeast, isMemberOf, type RequestUser } from "../common/types";
import { PrismaService } from "../prisma/prisma.service";

/** DRAFT → SENT → (ACCEPTED | EXPIRED | CANCELLED); CANCELLED reachable from DRAFT too. */
const TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  DRAFT: [QuotationStatus.SENT, QuotationStatus.CANCELLED],
  SENT: [QuotationStatus.ACCEPTED, QuotationStatus.EXPIRED, QuotationStatus.CANCELLED],
  ACCEPTED: [],
  EXPIRED: [],
  CANCELLED: [],
};

export interface QuotationItemInput {
  calculationId: string;
  markupLkr?: number;
}

@Injectable()
export class QuotationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private assertOrgAccess(user: RequestUser, orgId: string): void {
    if (!isMemberOf(user, orgId) && !hasRoleAtLeast(user, Role.ADMIN))
      throw new ForbiddenException("You are not a member of that organization.");
  }

  private async nextReference(tx: Prisma.TransactionClient): Promise<string> {
    const year = new Date().getFullYear();
    const count = await tx.quotation.count({
      where: { reference: { startsWith: `JSL-Q-${year}-` } },
    });
    return `JSL-Q-${year}-${String(count + 1).padStart(6, "0")}`;
  }

  async create(
    user: RequestUser,
    dto: {
      orgId: string;
      customerId?: string;
      items: QuotationItemInput[];
      marginModel?: Record<string, unknown>;
      validUntil?: string;
    },
    ip?: string,
  ) {
    this.assertOrgAccess(user, dto.orgId);
    if (!dto.items.length) throw new BadRequestException("A quotation needs at least one item.");

    if (dto.customerId) {
      const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
      if (!customer || customer.orgId !== dto.orgId)
        throw new BadRequestException("Customer not found in that organization.");
    }

    const calcIds = dto.items.map((i) => i.calculationId);
    const calcs = await this.prisma.calculation.findMany({
      where: { id: { in: calcIds } },
      select: { id: true, orgId: true, userId: true, totalLandedLkr: true },
    });
    const byId = new Map(calcs.map((c) => [c.id, c]));
    for (const id of calcIds) {
      const c = byId.get(id);
      if (!c) throw new NotFoundException(`Calculation ${id} not found.`);
      const accessible =
        c.userId === user.id || (c.orgId !== null && isMemberOf(user, c.orgId)) || hasRoleAtLeast(user, Role.ADMIN);
      if (!accessible) throw new ForbiddenException(`No access to calculation ${id}.`);
    }

    // Reference generation can race under concurrency → retry ×3 on P2002.
    for (let attempt = 1; ; attempt++) {
      try {
        const created = await this.prisma.$transaction(async (tx) => {
          const reference = await this.nextReference(tx);
          let total = new Prisma.Decimal(0);
          const items = dto.items.map((item, idx) => {
            const calc = byId.get(item.calculationId)!;
            const markup = new Prisma.Decimal(item.markupLkr ?? 0);
            const lineTotal = calc.totalLandedLkr.add(markup);
            total = total.add(lineTotal);
            return {
              calculationId: item.calculationId,
              markupLkr: markup,
              lineTotalLkr: lineTotal,
              sortOrder: idx,
            };
          });
          return tx.quotation.create({
            data: {
              orgId: dto.orgId,
              customerId: dto.customerId,
              createdById: user.id,
              reference,
              totalLkr: total,
              marginModel: dto.marginModel as Prisma.InputJsonValue | undefined,
              validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
              items: { create: items },
            },
            include: { items: true, customer: true },
          });
        });
        this.audit.log("quote.create", {
          userId: user.id, entity: "Quotation", entityId: created.id, ip,
          metadata: { reference: created.reference, totalLkr: created.totalLkr.toString() },
        });
        return created;
      } catch (e) {
        const isRefRace =
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002" &&
          (e.meta?.target as string[] | undefined)?.includes("reference");
        if (isRefRace && attempt < 3) continue;
        throw e;
      }
    }
  }

  async list(user: RequestUser, opts: { orgId: string; status?: QuotationStatus; take?: number; skip?: number }) {
    this.assertOrgAccess(user, opts.orgId);
    const take = Math.min(Math.max(opts.take ?? 50, 1), 100);
    const skip = Math.max(opts.skip ?? 0, 0);
    const where: Prisma.QuotationWhereInput = {
      orgId: opts.orgId,
      ...(opts.status ? { status: opts.status } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.quotation.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip,
        include: {
          customer: { select: { id: true, fullName: true } },
          createdBy: { select: { id: true, fullName: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.quotation.count({ where }),
    ]);
    return { total, take, skip, items };
  }

  async get(user: RequestUser, id: string) {
    const quote = await this.prisma.quotation.findUnique({
      where: { id },
      include: {
        customer: true,
        createdBy: { select: { id: true, fullName: true, email: true } },
        items: {
          orderBy: { sortOrder: "asc" },
          include: {
            calculation: {
              select: {
                id: true, title: true, totalLandedLkr: true, shippingMethod: true, createdAt: true,
                variant: {
                  select: {
                    code: true, yearFrom: true,
                    model: { select: { name: true, make: { select: { name: true } } } },
                  },
                },
                ruleSetVersion: { select: { version: true } },
              },
            },
          },
        },
      },
    });
    if (!quote) throw new NotFoundException("Quotation not found.");
    this.assertOrgAccess(user, quote.orgId);
    return quote;
  }

  async setStatus(user: RequestUser, id: string, status: QuotationStatus, ip?: string) {
    const quote = await this.prisma.quotation.findUnique({ where: { id }, select: { id: true, orgId: true, status: true, reference: true } });
    if (!quote) throw new NotFoundException("Quotation not found.");
    this.assertOrgAccess(user, quote.orgId);
    if (!TRANSITIONS[quote.status].includes(status))
      throw new BadRequestException(`Cannot move a ${quote.status} quotation to ${status}.`);

    const updated = await this.prisma.quotation.update({
      where: { id },
      data: { status },
      select: { id: true, reference: true, status: true, updatedAt: true },
    });
    this.audit.log("quote.status", {
      userId: user.id, entity: "Quotation", entityId: id, ip,
      metadata: { reference: quote.reference, from: quote.status, to: status },
    });
    return updated;
  }
}
