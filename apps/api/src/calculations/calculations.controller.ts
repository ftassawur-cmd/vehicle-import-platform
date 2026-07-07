import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { Role } from "../generated/prisma/client";
import { CurrentUser, Roles } from "../common/decorators";
import type { RequestUser } from "../common/types";
import { CalculationsService } from "./calculations.service";
import { CreateCalculationDto, PinDto, ReviseCalculationDto } from "./dto";

@ApiTags("calculations")
@ApiBearerAuth()
@Controller("calculations")
export class CalculationsController {
  constructor(private readonly calcs: CalculationsService) {}

  @Post()
  @Roles(Role.IMPORTER)
  @ApiOperation({
    summary:
      "Authoritative engine run — persists inputs, full step-trace snapshot and the RuleSetVersion ids used",
  })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateCalculationDto, @Req() req: Request) {
    return this.calcs.create(user, dto, req.ip);
  }

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query("orgId") orgId?: string,
    @Query("pinned") pinned?: string,
    @Query("take") take?: string,
    @Query("skip") skip?: string,
  ) {
    return this.calcs.list(user, {
      orgId,
      pinned: pinned === undefined ? undefined : pinned === "1" || pinned === "true",
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
  }

  @Get(":id")
  get(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.calcs.get(user, id);
  }

  @Patch(":id/pin")
  @Roles(Role.IMPORTER)
  pin(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: PinDto) {
    return this.calcs.setPinned(user, id, dto.pinned);
  }

  @Post(":id/revise")
  @Roles(Role.IMPORTER)
  @ApiOperation({ summary: "Run a modified scenario as a new version chained to this calculation" })
  revise(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: ReviseCalculationDto,
    @Req() req: Request,
  ) {
    return this.calcs.revise(user, id, dto, req.ip);
  }
}
