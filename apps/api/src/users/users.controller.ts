import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AccountStatus, Role } from "../generated/prisma/client";
import { CurrentUser, Roles } from "../common/decorators";
import type { RequestUser } from "../common/types";
import { SetRoleDto } from "./dto";
import { UsersService } from "./users.service";

@ApiTags("users")
@ApiBearerAuth()
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Roles(Role.ADMIN)
  list(@Query("status") status?: AccountStatus) {
    return this.users.list(status);
  }

  @Post(":id/approve")
  @Roles(Role.ADMIN)
  approve(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.users.approve(id, user.id);
  }

  @Post(":id/suspend")
  @Roles(Role.ADMIN)
  suspend(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.users.suspend(id, user.id);
  }

  @Post(":id/role")
  @Roles(Role.SUPER_ADMIN)
  setRole(@Param("id") id: string, @Body() dto: SetRoleDto, @CurrentUser() user: RequestUser) {
    return this.users.setRole(id, dto.orgId, dto.role, user.id);
  }
}
