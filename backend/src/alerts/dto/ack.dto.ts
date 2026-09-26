import { IsOptional, IsString, Length } from 'class-validator';

export class AckDto {
  @IsOptional() @IsString() @Length(1, 120) action?: string;
}
