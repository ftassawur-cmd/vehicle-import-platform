import { IsBoolean, IsObject, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateCalculationDto {
  /** Engine CalcInputs — structurally re-validated server-side (calc-inputs.assert). */
  @IsObject()
  inputs!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  orgId?: string;

  @IsOptional()
  @IsString()
  variantId?: string;
}

export class ReviseCalculationDto {
  @IsObject()
  inputs!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;
}

export class PinDto {
  @IsBoolean()
  pinned!: boolean;
}
