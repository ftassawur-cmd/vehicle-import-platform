import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from "class-validator";
import { FuelType, VehicleClass } from "../generated/prisma/client";

export class CreateMakeDto {
  @IsString() @IsNotEmpty() @MaxLength(60)
  name!: string;

  @IsOptional() @IsString() @MaxLength(2)
  country?: string;

  @IsOptional() @IsUrl()
  logoUrl?: string;
}

export class CreateModelDto {
  @IsString() @IsNotEmpty()
  makeId!: string;

  @IsString() @IsNotEmpty() @MaxLength(80)
  name!: string;

  @IsOptional() @IsEnum(VehicleClass)
  class?: VehicleClass;

  @IsOptional() @IsBoolean()
  popular?: boolean;
}

export class CreateVariantDto {
  @IsString() @IsNotEmpty()
  modelId!: string;

  @IsString() @IsNotEmpty() @MaxLength(40)
  code!: string;

  @IsInt() @Min(1950)
  yearFrom!: number;

  @IsOptional() @IsInt()
  yearTo?: number;

  @IsEnum(FuelType)
  fuelType!: FuelType;

  @IsOptional() @IsInt() @Min(1)
  engineCc?: number;

  @IsOptional() @IsInt() @Min(1)
  motorKw?: number;

  @IsOptional() @IsString() @MaxLength(10)
  drivetrain?: string;

  @IsOptional() @IsString() @MaxLength(30)
  transmission?: string;

  @IsOptional() @IsString() @MaxLength(30)
  bodyType?: string;

  @IsOptional() @IsInt() lengthMm?: number;
  @IsOptional() @IsInt() widthMm?: number;
  @IsOptional() @IsInt() heightMm?: number;
  @IsOptional() @IsInt() weightKg?: number;

  @IsOptional() @IsNumber()
  fuelEconomyKmPerL?: number;
}

export class AddImageDto {
  @IsUrl()
  url!: string;

  @IsOptional() @IsString() @MaxLength(20)
  kind?: string;

  @IsOptional() @IsInt() @Min(0)
  sortOrder?: number;

  @IsOptional() @IsString() @MaxLength(60)
  source?: string;
}
