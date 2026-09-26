import { IsOptional, IsString, Length } from 'class-validator';

export class UssdDto {
  @IsString() @Length(1, 100) sessionId!: string;
  @IsString() @Length(8, 20) phoneNumber!: string;
  @IsOptional() @IsString() @Length(0, 160) text?: string;
  @IsOptional() @IsString() serviceCode?: string;
}
