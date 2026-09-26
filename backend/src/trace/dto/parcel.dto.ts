import { Type } from 'class-transformer';
import {
  IsDate,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ParcelDto {
  @IsString() cropId!: string;
  @IsNumber() @Min(0.01) @Max(500) areaHa!: number;
  @IsLatitude() lat!: number;
  @IsLongitude() lon!: number;
  @IsOptional() @Type(() => Date) @IsDate() sownAt?: Date;
  @IsOptional() @IsString() forUserId?: string;
}
