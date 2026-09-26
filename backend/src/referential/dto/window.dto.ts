import { IsIn, IsInt, Matches, Max, Min } from 'class-validator';
import { Zone } from '@prisma/client';

// Month and day, as stored for sowing windows: 03-15.
const MMDD = /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

export class WindowDto {
  @IsIn(['NORD', 'SUD']) zone!: Zone;
  @IsInt() @Min(1) @Max(2) season!: number;
  @Matches(MMDD, { message: 'Date au format MM-JJ' }) start!: string;
  @Matches(MMDD, { message: 'Date au format MM-JJ' }) end!: string;
}
