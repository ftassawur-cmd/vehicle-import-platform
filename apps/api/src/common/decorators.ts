import { createParamDecorator, ExecutionContext, SetMetadata } from "@nestjs/common";
import { Role } from "../generated/prisma/client";
import type { AuthedRequest, RequestUser } from "./types";

export const IS_PUBLIC_KEY = "isPublic";
/** Marks a route as reachable without a Bearer token (global guard checks this). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = "requiredRole";
/** Minimum role (per the SUPER_ADMIN>…>VIEWER lattice) required for the route. */
export const Roles = (role: Role) => SetMetadata(ROLES_KEY, role);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser =>
    ctx.switchToHttp().getRequest<AuthedRequest>().user,
);
