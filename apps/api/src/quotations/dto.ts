import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { QuotationStatus } from "../generated/prisma/client";

export class QuotationItemDto {
  @IsString()
  @IsNotEmpty()
  calculationId!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  markupLkr?: number;
}

export class CreateQuotationDto {
  @IsString()
  @IsNotEmpty()
  orgId!: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuotationItemDto)
  items!: QuotationItemDto[];

  @IsOptional()
  @IsObject()
  marginModel?: Record<string, unknown>;

  @IsOptional()
  @IsISO8601()
  validUntil?: string;
}

export class SetStatusDto {
  @IsEnum(QuotationStatus)
  status!: QuotationStatus;
}

export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  orgId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  fullName!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  nicOrBrn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  nicOrBrn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
