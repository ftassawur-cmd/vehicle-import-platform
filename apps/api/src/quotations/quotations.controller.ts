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
import { QuotationStatus, Role } from "../generated/prisma/client";
import { CurrentUser, Roles } from "../common/decorators";
import type { RequestUser } from "../common/types";
import { CreateQuotationDto, SetStatusDto } from "./dto";
import { QuotationsService } from "./quotations.service";

@ApiTags("quotations")
@ApiBearerAuth()
@Controller("quotations")
export class QuotationsController {
  constructor(private readonly quotations: QuotationsService) {}

  @Post()
  @Roles(Role.DEALER)
  @ApiOperation({ summary: "Issue a quotation (JSL-Q-YYYY-######) pricing persisted calculations + markup" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateQuotationDto, @Req() req: Request) {
    return this.quotations.create(user, dto, req.ip);
  }

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query("orgId") orgId: string,
    @Query("status") status?: QuotationStatus,
    @Query("take") take?: string,
    @Query("skip") skip?: string,
  ) {
    return this.quotations.list(user, {
      orgId,
      status,
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
  }

  @Get(":id")
  get(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.quotations.get(user, id);
  }

  @Patch(":id/status")
  @Roles(Role.DEALER)
  @ApiOperation({ summary: "Guarded lifecycle: DRAFT→SENT→ACCEPTED/EXPIRED/CANCELLED" })
  setStatus(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: SetStatusDto,
    @Req() req: Request,
  ) {
    return this.quotations.setStatus(user, id, dto.status, req.ip);
  }
}
