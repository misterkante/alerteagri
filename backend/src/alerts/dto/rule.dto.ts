import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class RuleDto {
  @IsNumber() @Min(0) @Max(1000) threshold!: number;
  @IsInt() @Min(1) @Max(30) windowDays!: number;
  @IsInt() @Min(0) @Max(200) neighborKm!: number;
  @IsBoolean() active!: boolean;
  @IsString() @Length(10, 240) message!: string;
}
