import { IsEnum, IsString } from "class-validator";
import { Role } from "../generated/prisma/client";

export class SetRoleDto {
  @IsString()
  orgId!: string;

  @IsEnum(Role)
  role!: Role;
}
