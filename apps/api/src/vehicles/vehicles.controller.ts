import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { FuelType, Role, VehicleClass } from "../generated/prisma/client";
import { Public, Roles } from "../common/decorators";
import { AddImageDto, CreateMakeDto, CreateModelDto, CreateVariantDto } from "./dto";
import { VehiclesService } from "./vehicles.service";

@ApiTags("vehicles")
@Controller("vehicles")
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Public()
  @Get("makes")
  listMakes(@Query("withModels") withModels?: string) {
    return this.vehicles.listMakes(withModels === "1" || withModels === "true");
  }

  @Public()
  @Get("makes/:makeId/models")
  listModels(@Param("makeId") makeId: string) {
    return this.vehicles.listModels(makeId);
  }

  @Public()
  @Get("variants")
  searchVariants(
    @Query("q") q?: string,
    @Query("makeId") makeId?: string,
    @Query("modelId") modelId?: string,
    @Query("fuelType") fuelType?: FuelType,
    @Query("class") vehicleClass?: VehicleClass,
    @Query("take") take?: string,
    @Query("skip") skip?: string,
  ) {
    return this.vehicles.searchVariants({
      q, makeId, modelId, fuelType, vehicleClass,
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
  }

  @Public()
  @Get("variants/:id")
  getVariant(@Param("id") id: string) {
    return this.vehicles.getVariant(id);
  }

  /* ── Admin catalog management ── */

  @Post("makes")
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  createMake(@Body() dto: CreateMakeDto) {
    return this.vehicles.createMake(dto);
  }

  @Post("models")
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  createModel(@Body() dto: CreateModelDto) {
    return this.vehicles.createModel(dto);
  }

  @Post("variants")
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  createVariant(@Body() dto: CreateVariantDto) {
    return this.vehicles.createVariant(dto);
  }

  @Post("variants/:id/images")
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  addImage(@Param("id") id: string, @Body() dto: AddImageDto) {
    return this.vehicles.addImage(id, dto);
  }
}
