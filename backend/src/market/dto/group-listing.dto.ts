import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ShareDto } from './share.dto';

export class GroupListingDto {
  @IsString() @Length(8, 64) clientId!: string;
  @IsString() cropId!: string;
  @IsInt() @Min(1) @Max(1_000_000) pricePerKg!: number;
  @IsOptional() @IsBoolean() forExport?: boolean;
  @IsOptional() @IsString() @Length(1, 60) exportLicense?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ShareDto)
  shares!: ShareDto[];
}
