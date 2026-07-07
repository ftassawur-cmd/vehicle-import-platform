import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AccountStatus, Role } from "../generated/prisma/client";
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  list(status?: AccountStatus) {
    return this.prisma.user.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true, email: true, fullName: true, phone: true, status: true,
        emailVerifiedAt: true, createdAt: true,
        memberships: { select: { role: true, org: { select: { id: true, name: true, slug: true } } } },
      },
    });
  }

  async approve(id: string, approvedById: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("User not found.");
    if (user.status !== AccountStatus.PENDING_APPROVAL)
      throw new BadRequestException(`Only PENDING_APPROVAL accounts can be approved (current: ${user.status}).`);

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: AccountStatus.ACTIVE, approvedById },
      select: { id: true, email: true, fullName: true, status: true },
    });
    this.audit.log("user.approve", { userId: approvedById, entity: "User", entityId: id });
    await this.notifications.create(
      id, "approval", "Account activated",
      "Your JSL Imports account has been approved — you can sign in now.",
    );
    return updated;
  }

  async suspend(id: string, byUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("User not found.");
    if (id === byUserId) throw new BadRequestException("You cannot suspend your own account.");

    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { status: AccountStatus.SUSPENDED },
        select: { id: true, email: true, status: true },
      }),
      this.prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    this.audit.log("user.suspend", { userId: byUserId, entity: "User", entityId: id });
    return updated;
  }

  /** SUPER_ADMIN: grant/change a user's role inside an organization. */
  async setRole(userId: string, orgId: string, role: Role, byUserId: string) {
    const [user, org] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
      this.prisma.organization.findUnique({ where: { id: orgId }, select: { id: true } }),
    ]);
    if (!user) throw new NotFoundException("User not found.");
    if (!org) throw new NotFoundException("Organization not found.");

    const membership = await this.prisma.orgMembership.upsert({
      where: { userId_orgId: { userId, orgId } },
      create: { userId, orgId, role },
      update: { role },
      select: { userId: true, orgId: true, role: true },
    });
    this.audit.log("user.set_role", {
      userId: byUserId, entity: "OrgMembership", entityId: `${userId}:${orgId}`, metadata: { role },
    });
    return membership;
  }
}
