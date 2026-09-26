import {
  IsIn,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { PEST_CROPS, SYMPTOMS } from '../reports.constants';

export class CreateReportDto {
  @IsString() @Length(8, 64) clientId!: string;
  @IsIn(PEST_CROPS) cropId!: string;
  @IsIn(SYMPTOMS as unknown as string[]) symptom!: string;
  @IsOptional() @IsLatitude() lat?: number;
  @IsOptional() @IsLongitude() lon?: number;
  @IsOptional() @IsString() forUserId?: string;
}
