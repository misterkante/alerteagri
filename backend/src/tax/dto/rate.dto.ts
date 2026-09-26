import { IsInt, IsString, Max, Min } from 'class-validator';

export class RateDto {
  @IsString() communeId!: string;
  @IsString() cropId!: string;
  @IsInt() @Min(0) @Max(100000) fcfaPer100Kg!: number;
}
