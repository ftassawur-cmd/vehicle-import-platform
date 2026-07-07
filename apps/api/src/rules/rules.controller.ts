import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Role, RuleSetStatus } from "../generated/prisma/client";
import { CurrentUser, Public, Roles } from "../common/decorators";
import type { RequestUser } from "../common/types";
import { parseDomainParam } from "./domain-map";
import { CreateDraftDto, PublishDto } from "./dto";
import { RulesService } from "./rules.service";

@ApiTags("rules")
@Controller("rules")
export class RulesController {
  constructor(private readonly rules: RulesService) {}

  @Public()
  @Get("active")
  @ApiOperation({
    summary:
      "The ten active rule payloads + version provenance — feed straight into @jsl/calc-engine buildRuleSet()",
  })
  active() {
    return this.rules.activeBundleForClients();
  }

  @Get(":domain/versions")
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  listVersions(@Param("domain") raw: string, @Query("status") status?: RuleSetStatus) {
    const domain = parseDomainParam(raw);
    if (!domain) throw new BadRequestException(`Unknown rule domain '${raw}'.`);
    return this.rules.listVersions(domain, status);
  }

  @Post(":domain/versions")
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a DRAFT version; the payload is engine-validated before persist" })
  createDraft(@Param("domain") raw: string, @Body() dto: CreateDraftDto, @CurrentUser() user: RequestUser) {
    const domain = parseDomainParam(raw);
    if (!domain) throw new BadRequestException(`Unknown rule domain '${raw}'.`);
    return this.rules.createDraft(domain, dto, user.id);
  }

  @Get("versions/:id")
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  getVersion(@Param("id") id: string) {
    return this.rules.getVersion(id);
  }

  @Get("diff")
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  diff(@Query("a") a: string, @Query("b") b: string) {
    if (!a || !b) throw new BadRequestException("Provide both ?a= and ?b= version ids.");
    return this.rules.diff(a, b);
  }

  @Post("versions/:id/publish")
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "DRAFT → ACTIVE; the previous ACTIVE version of the domain is retired atomically" })
  publish(@Param("id") id: string, @Body() dto: PublishDto, @CurrentUser() user: RequestUser) {
    return this.rules.publish(id, user.id, dto.effectiveFrom);
  }
}
