import { IsInt, IsString, Length, Max, Min } from 'class-validator';

export class CollectDto {
  @IsString() @Length(8, 64) clientId!: string;
  @IsString() cropId!: string;
  @IsInt() @Min(1) @Max(1_000_000) quantityKg!: number;
}
