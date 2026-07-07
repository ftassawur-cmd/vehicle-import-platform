import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Append-only audit trail (docs/architecture §5): every rule publish, calc
 * persist, quote issue and auth event lands here. Writes are fire-and-forget —
 * an audit hiccup must never fail the business action it describes.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  log(
    action: string,
    opts: {
      userId?: string | null;
      entity?: string;
      entityId?: string;
      metadata?: Record<string, unknown>;
      ip?: string;
    } = {},
  ): void {
    void this.prisma.auditLog
      .create({
        data: {
          action,
          userId: opts.userId ?? null,
          entity: opts.entity,
          entityId: opts.entityId,
          metadata: opts.metadata as object | undefined,
          ip: opts.ip,
        },
      })
      .catch((e: unknown) =>
        this.logger.error(`audit write failed for '${action}': ${e instanceof Error ? e.message : e}`),
      );
  }
}
