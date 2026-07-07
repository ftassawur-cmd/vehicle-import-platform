import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role } from "../generated/prisma/client";
import { CurrentUser, Roles } from "../common/decorators";
import type { RequestUser } from "../common/types";
import { CustomersService } from "./customers.service";
import { CreateCustomerDto, UpdateCustomerDto } from "./dto";

@ApiTags("customers")
@ApiBearerAuth()
@Controller("customers")
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query("orgId") orgId: string, @Query("q") q?: string) {
    return this.customers.list(user, orgId, q);
  }

  @Post()
  @Roles(Role.DEALER)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateCustomerDto) {
    return this.customers.create(user, dto);
  }

  @Patch(":id")
  @Roles(Role.DEALER)
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateCustomerDto) {
    return this.customers.update(user, id, dto);
  }
}
