import { Injectable } from "@nestjs/common";
import { Role } from "../generated/prisma/client";
import { ROLE_RANK } from "../common/types";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, kind: string, title: string, body?: string) {
    return this.prisma.notification.create({ data: { userId, kind, title, body } });
  }

  /** Fan out to every user holding `minRole` or higher in any organization. */
  async notifyRoleAtLeast(minRole: Role, kind: string, title: string, body?: string): Promise<number> {
    const roles = (Object.keys(ROLE_RANK) as Role[]).filter((r) => ROLE_RANK[r] >= ROLE_RANK[minRole]);
    const users = await this.prisma.user.findMany({
      where: { memberships: { some: { role: { in: roles } } } },
      select: { id: true },
    });
    if (users.length === 0) return 0;
    await this.prisma.notification.createMany({
      data: users.map((u) => ({ userId: u.id, kind, title, body })),
    });
    return users.length;
  }

  listMine(userId: string, unreadOnly: boolean) {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async markRead(userId: string, id: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: count };
  }

  async markAllRead(userId: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: count };
  }
}
