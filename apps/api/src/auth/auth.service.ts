import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { createHash, randomBytes } from "node:crypto";
import { AccountStatus, Role } from "../generated/prisma/client";
import { AuditService } from "../audit/audit.service";
import { env } from "../config/env";
import { MailService } from "../mail/mail.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../common/types";
import type { LoginDto, RegisterDto } from "./dto";

const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");
const newToken = (): string => randomBytes(48).toString("base64url");

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string; // raw — only ever leaves via the httpOnly cookie
  user: RequestUser & { status: AccountStatus };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /* ── Password hashing (Argon2id per docs/architecture §3) ── */

  hashPassword(plain: string): Promise<string> {
    return argon2.hash(plain, {
      type: argon2.argon2id,
      memoryCost: env.argon2MemoryKib,
      timeCost: 3,
      parallelism: 1,
    });
  }

  verifyPassword(hash: string, plain: string): Promise<boolean> {
    return argon2.verify(hash, plain).catch(() => false);
  }

  /* ── Registration & email verification ── */

  async register(dto: RegisterDto, ip?: string): Promise<{ id: string; email: string; status: AccountStatus }> {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException("An account with this email already exists.");

    const passwordHash = await this.hashPassword(dto.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { email, passwordHash, fullName: dto.fullName.trim(), phone: dto.phone },
      });
      if (dto.orgName) {
        const base = dto.orgName
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")
          .slice(0, 60) || "org";
        let slug = base;
        for (let i = 2; await tx.organization.findUnique({ where: { slug } }); i++)
          slug = `${base}-${i}`;
        const org = await tx.organization.create({ data: { name: dto.orgName.trim(), slug } });
        await tx.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: Role.IMPORTER } });
      }
      return u;
    });

    await this.issueEmailVerification(user.id, email);
    this.audit.log("auth.register", { userId: user.id, entity: "User", entityId: user.id, ip });
    return { id: user.id, email: user.email, status: user.status };
  }

  private async issueEmailVerification(userId: string, email: string): Promise<void> {
    const raw = newToken();
    await this.prisma.emailVerificationToken.create({
      data: { userId, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + 24 * 3_600_000) },
    });
    await this.mail.sendEmailVerification(email, raw);
  }

  async verifyEmail(rawToken: string): Promise<{ status: AccountStatus }> {
    const row = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash: sha256(rawToken) },
      include: { user: true },
    });
    if (!row || row.usedAt || row.expiresAt < new Date())
      throw new UnauthorizedException("Verification link is invalid or has expired.");

    const nextStatus =
      row.user.status === AccountStatus.PENDING_EMAIL ? AccountStatus.PENDING_APPROVAL : row.user.status;

    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({
        where: { id: row.userId },
        data: { status: nextStatus, emailVerifiedAt: row.user.emailVerifiedAt ?? new Date() },
      }),
    ]);

    if (row.user.status === AccountStatus.PENDING_EMAIL) {
      this.audit.log("auth.email_verified", { userId: row.userId, entity: "User", entityId: row.userId });
      await this.notifications.notifyRoleAtLeast(
        Role.ADMIN,
        "approval",
        "Account awaiting approval",
        `${row.user.fullName} <${row.user.email}> verified their email and awaits activation.`,
      );
    }
    return { status: nextStatus };
  }

  /* ── Login / refresh / logout ── */

  private async membershipsOf(userId: string): Promise<{ orgId: string; role: Role }[]> {
    const rows = await this.prisma.orgMembership.findMany({
      where: { userId },
      select: { orgId: true, role: true },
    });
    return rows.map((r) => ({ orgId: r.orgId, role: r.role }));
  }

  private async issueTokens(
    user: { id: string; email: string; fullName: string; status: AccountStatus },
    userAgent?: string,
    ip?: string,
  ): Promise<IssuedTokens> {
    const memberships = await this.membershipsOf(user.id);
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, fullName: user.fullName, memberships, typ: "access" },
      { secret: env.jwtAccessSecret, expiresIn: Math.floor(env.accessTokenTtlMs / 1000) },
    );
    const refreshToken = newToken();
    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: sha256(refreshToken),
        userAgent: userAgent?.slice(0, 250),
        ip,
        expiresAt: new Date(Date.now() + env.refreshTokenTtlMs),
      },
    });
    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, fullName: user.fullName, memberships, status: user.status },
    };
  }

  async login(dto: LoginDto, userAgent?: string, ip?: string): Promise<IssuedTokens> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    const ok = user && (await this.verifyPassword(user.passwordHash, dto.password));
    if (!ok) throw new UnauthorizedException("Invalid email or password.");

    switch (user.status) {
      case AccountStatus.PENDING_EMAIL:
        throw new ForbiddenException("Please verify your email address first.");
      case AccountStatus.PENDING_APPROVAL:
        throw new ForbiddenException("Your account is awaiting administrator approval.");
      case AccountStatus.SUSPENDED:
        throw new ForbiddenException("This account is suspended. Contact support.");
      case AccountStatus.ACTIVE:
        break;
    }

    const tokens = await this.issueTokens(user, userAgent, ip);
    this.audit.log("auth.login", { userId: user.id, entity: "User", entityId: user.id, ip });
    return tokens;
  }

  async rotateRefresh(rawToken: string, userAgent?: string, ip?: string): Promise<IssuedTokens> {
    const hash = sha256(rawToken);
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: hash },
      include: { user: true },
    });
    if (!session) throw new UnauthorizedException("Invalid refresh token.");

    if (session.revokedAt) {
      // Reuse of a rotated token → assume theft, kill the whole family.
      await this.prisma.session.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      this.audit.log("auth.refresh_reuse_detected", {
        userId: session.userId, entity: "Session", entityId: session.id, ip,
      });
      throw new UnauthorizedException("Refresh token reuse detected — all sessions revoked.");
    }
    if (session.expiresAt < new Date()) throw new UnauthorizedException("Session expired. Please sign in again.");
    if (session.user.status !== AccountStatus.ACTIVE)
      throw new ForbiddenException("Account is not active.");

    await this.prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    return this.issueTokens(session.user, userAgent, ip);
  }

  async logout(rawToken: string | undefined, userId?: string): Promise<void> {
    if (rawToken) {
      await this.prisma.session.updateMany({
        where: { refreshTokenHash: sha256(rawToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    if (userId) this.audit.log("auth.logout", { userId, entity: "User", entityId: userId });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, fullName: true, phone: true, status: true,
        emailVerifiedAt: true, createdAt: true,
        memberships: {
          select: { role: true, org: { select: { id: true, name: true, slug: true, type: true } } },
        },
      },
    });
    if (!user) throw new NotFoundException("User not found.");
    return user;
  }

  /* ── Password reset ── */

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user) {
      this.logger.log(`password reset requested for unknown email (no action)`);
      return; // controller always answers 202 — no account enumeration
    }
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    const raw = newToken();
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + 3_600_000) },
    });
    await this.mail.sendPasswordReset(user.email, raw);
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: sha256(rawToken) },
    });
    if (!row || row.usedAt || row.expiresAt < new Date())
      throw new UnauthorizedException("Reset link is invalid or has expired.");

    const passwordHash = await this.hashPassword(newPassword);
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
      this.prisma.session.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    this.audit.log("auth.password_reset", { userId: row.userId, entity: "User", entityId: row.userId });
  }
}
