import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator";

export class RateDto {
  @IsString()
  @Matches(/^[A-Z]{3}\/LKR$/, { message: "pair must look like 'JPY/LKR'" })
  pair!: string;

  @IsNumber()
  @IsPositive()
  rate!: number;

  @IsISO8601()
  asOf!: string;

  @IsString()
  @MaxLength(60)
  source!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  confidence?: string;
}

export class IngestRatesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RateDto)
  rates!: RateDto[];
}
