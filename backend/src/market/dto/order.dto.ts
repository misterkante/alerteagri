import { IsInt, IsString, Length, Max, Min } from 'class-validator';

export class OrderDto {
  @IsString() @Length(8, 64) clientId!: string;
  @IsString() listingId!: string;
  @IsInt() @Min(1) @Max(1_000_000) quantityKg!: number;
}
