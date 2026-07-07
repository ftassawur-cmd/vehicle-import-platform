import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { env } from "../../config/env";
import { IS_PUBLIC_KEY } from "../decorators";
import type { RequestUser } from "../types";

interface AccessPayload extends RequestUser {
  sub: string;
  typ: "access";
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) throw new UnauthorizedException("Missing Bearer token");

    let payload: AccessPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessPayload>(token, { secret: env.jwtAccessSecret });
    } catch {
      throw new UnauthorizedException("Invalid or expired access token");
    }
    if (payload.typ !== "access") throw new UnauthorizedException("Wrong token type");

    req.user = {
      id: payload.sub,
      email: payload.email,
      fullName: payload.fullName,
      memberships: payload.memberships ?? [],
    };
    return true;
  }
}
