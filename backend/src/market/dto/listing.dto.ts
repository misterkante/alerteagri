import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class ListingDto {
  @IsString() @Length(8, 64) clientId!: string;
  @IsString() cropId!: string;
  @IsInt() @Min(1) @Max(1_000_000) quantityKg!: number;
  @IsInt() @Min(1) @Max(1_000_000) pricePerKg!: number;
  @IsOptional() @IsBoolean() forExport?: boolean;
  @IsOptional() @IsString() @Length(1, 60) exportLicense?: string;
  @IsOptional() @IsString() forUserId?: string;
}
