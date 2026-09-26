import { Type } from 'class-transformer';
import {
  IsDate,
  IsNumber,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class LotDto {
  @IsString() parcelId!: string;
  @Type(() => Date) @IsDate() harvestDate!: Date;
  @IsInt() @Min(1) @Max(1_000_000) weightKg!: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) humidityPct?: number;
}
