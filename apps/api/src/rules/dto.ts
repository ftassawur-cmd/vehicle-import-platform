import { IsISO8601, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateDraftDto {
  /** e.g. "2026.08.15-r1" — unique per domain. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  version!: string;

  @IsObject()
  payload!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  changeNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourceGazette?: string;

  @IsOptional()
  @IsISO8601()
  effectiveFrom?: string;
}

export class PublishDto {
  @IsOptional()
  @IsISO8601()
  effectiveFrom?: string;
}
