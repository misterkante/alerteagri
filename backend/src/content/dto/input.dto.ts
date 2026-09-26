import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export class InputDto {
  @IsString() @Length(2, 80) name!: string;
  @IsIn(['HOMOLOGATED', 'NOT_HOMOLOGATED']) status!:
    'HOMOLOGATED' | 'NOT_HOMOLOGATED';
  @IsString() @Length(3, 300) source!: string;
  @IsOptional() @IsString() @Length(3, 200) alternative?: string;
}
