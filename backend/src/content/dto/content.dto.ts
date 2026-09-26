import { ContentKind } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { PICTOGRAMS } from '../content.constants';

export class ContentDto {
  @IsEnum(ContentKind) kind!: ContentKind;
  @IsString() @Length(3, 120) title!: string;
  @IsString() @Length(10, 2000) body!: string;
  @IsIn(PICTOGRAMS) pictogram!: string;
  @IsOptional() @IsString() @Length(3, 300) officialRef?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(11)
  @IsIn(
    [
      'mais',
      'sorgho',
      'riz',
      'manioc',
      'igname',
      'arachide',
      'niebe',
      'soja',
      'coton',
      'anacarde',
      'tomate',
    ],
    { each: true },
  )
  targetCrops?: string[];
}
