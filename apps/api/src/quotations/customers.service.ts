import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Role } from "../generated/prisma/client";
import { hasRoleAtLeast, isMemberOf, type RequestUser } from "../common/types";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  private assertOrgAccess(user: RequestUser, orgId: string): void {
    if (!isMemberOf(user, orgId) && !hasRoleAtLeast(user, Role.ADMIN))
      throw new ForbiddenException("You are not a member of that organization.");
  }

  list(user: RequestUser, orgId: string, q?: string) {
    this.assertOrgAccess(user, orgId);
    return this.prisma.customer.findMany({
      where: {
        orgId,
        ...(q ? { fullName: { contains: q, mode: "insensitive" } } : {}),
      },
      orderBy: { fullName: "asc" },
      take: 100,
      include: { _count: { select: { quotations: true } } },
    });
  }

  create(
    user: RequestUser,
    dto: { orgId: string; fullName: string; email?: string; phone?: string; nicOrBrn?: string; notes?: string },
  ) {
    this.assertOrgAccess(user, dto.orgId);
    return this.prisma.customer.create({ data: dto });
  }

  async update(
    user: RequestUser,
    id: string,
    dto: { fullName?: string; email?: string; phone?: string; nicOrBrn?: string; notes?: string },
  ) {
    const customer = await this.prisma.customer.findUnique({ where: { id }, select: { orgId: true } });
    if (!customer) throw new NotFoundException("Customer not found.");
    this.assertOrgAccess(user, customer.orgId);
    return this.prisma.customer.update({ where: { id }, data: dto });
  }
}
