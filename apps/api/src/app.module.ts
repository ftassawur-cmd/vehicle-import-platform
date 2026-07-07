import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { CalculationsModule } from "./calculations/calculations.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { env } from "./config/env";
import { FxModule } from "./fx/fx.module";
import { HealthController } from "./health/health.controller";
import { MailModule } from "./mail/mail.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PrismaModule } from "./prisma/prisma.module";
import { QuotationsModule } from "./quotations/quotations.module";
import { RulesModule } from "./rules/rules.module";
import { UsersModule } from "./users/users.module";
import { VehiclesModule } from "./vehicles/vehicles.module";

@Module({
  imports: [
    // Global JwtModule so the auth guard can verify tokens anywhere.
    JwtModule.register({ global: true }),
    ThrottlerModule.forRoot([{ ttl: env.throttleTtlMs, limit: env.throttleLimit }]),
    PrismaModule,
    AuditModule,
    MailModule,
    NotificationsModule,
    RulesModule,
    AuthModule,
    UsersModule,
    VehiclesModule,
    FxModule,
    CalculationsModule,
    QuotationsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: rate-limit first, then authenticate, then authorize.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
