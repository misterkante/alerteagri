import { IsOptional, IsString, Length } from 'class-validator';

export class SimulateDto {
  @IsString() @Length(1, 100) sessionId!: string;
  @IsOptional() @IsString() @Length(0, 160) text?: string;
}
