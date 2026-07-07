import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role } from "../../generated/prisma/client";
import { ROLES_KEY } from "../decorators";
import { hasRoleAtLeast, type AuthedRequest } from "../types";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role | undefined>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required) return true;

    const { user } = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (!user) throw new ForbiddenException("Authentication required");
    if (!hasRoleAtLeast(user, required))
      throw new ForbiddenException(`Requires ${required} role or higher`);
    return true;
  }
}
