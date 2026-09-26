import { IsInt, IsString, Max, Min } from 'class-validator';

export class ShareDto {
  @IsString() producerId!: string;
  @IsInt() @Min(1) @Max(1_000_000) quantityKg!: number;
}
