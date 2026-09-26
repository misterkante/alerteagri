import { IsOptional, IsString, Length } from 'class-validator';

export class VoiceDto {
  // Text in the target language, written by a speaker. Without it the sheet is machine translated.
  @IsOptional() @IsString() @Length(2, 1000) text?: string;
}
