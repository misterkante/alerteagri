import { Type } from 'class-transformer';
import { IsDate, IsIn, IsOptional, IsString } from 'class-validator';

export class HarvestDto {
  @IsIn([
    'mais',
    'arachide',
    'sorgho',
    'riz',
    'niebe',
    'soja',
    'coton',
    'manioc',
    'igname',
    'anacarde',
    'tomate',
  ])
  cropId!: string;
  @Type(() => Date) @IsDate() harvestDate!: Date;
  @IsOptional() @IsString() forUserId?: string;
}
