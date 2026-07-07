import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { Role } from "../generated/prisma/client";
import { CurrentUser, Public, Roles } from "../common/decorators";
import type { RequestUser } from "../common/types";
import { IngestRatesDto } from "./dto";
import { FxService } from "./fx.service";

@ApiTags("fx")
@Controller("fx")
export class FxController {
  constructor(private readonly fx: FxService) {}

  @Public()
  @Get("latest")
  @ApiOperation({ summary: "Freshest stored rate per pair with staleness flags" })
  latest() {
    return this.fx.latest();
  }

  @Get("stale-report")
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  staleReport() {
    return this.fx.staleReport();
  }

  @Post("rates")
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Ingest rate readings → appends ExchangeRate history AND auto-publishes a new EXCHANGE_RATES rule version",
  })
  ingest(@CurrentUser() user: RequestUser, @Body() dto: IngestRatesDto, @Req() req: Request) {
    return this.fx.ingest(dto.rates, user.id, req.ip);
  }
}
