import { Type } from 'class-transformer';
import { IsDate } from 'class-validator';

export class SowingDto {
  @Type(() => Date) @IsDate() sownAt!: Date;
}
