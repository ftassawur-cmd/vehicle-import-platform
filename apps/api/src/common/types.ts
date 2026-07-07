import type { Request } from "express";
import { Role } from "../generated/prisma/client";

/** Shape carried inside the access token and attached to authenticated requests. */
export interface RequestUser {
  id: string;
  email: string;
  fullName: string;
  memberships: { orgId: string; role: Role }[];
}

export interface AuthedRequest extends Request {
  user: RequestUser;
}

/**
 * Role lattice: SUPER_ADMIN > ADMIN > DEALER > IMPORTER > VIEWER
 * (docs/architecture §5). A guard requirement of e.g. ADMIN is satisfied by
 * any membership whose rank is ≥ ADMIN's.
 */
export const ROLE_RANK: Record<Role, number> = {
  SUPER_ADMIN: 5,
  ADMIN: 4,
  DEALER: 3,
  IMPORTER: 2,
  VIEWER: 1,
};

export const hasRoleAtLeast = (user: RequestUser, required: Role): boolean =>
  user.memberships.some((m) => ROLE_RANK[m.role] >= ROLE_RANK[required]);

export const isMemberOf = (user: RequestUser, orgId: string): boolean =>
  user.memberships.some((m) => m.orgId === orgId);

export const roleInOrg = (user: RequestUser, orgId: string): Role | undefined =>
  user.memberships.find((m) => m.orgId === orgId)?.role;
