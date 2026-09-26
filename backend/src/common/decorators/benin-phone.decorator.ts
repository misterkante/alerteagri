import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Matches } from 'class-validator';
import {
  BENIN_PHONE,
  BENIN_PHONE_MESSAGE,
  toBeninPhone,
} from '../../domain/phone';

// Accepts a Beninese number however it is written and hands the service its one stored form.
export const BeninPhone = () =>
  applyDecorators(
    ApiProperty({
      example: '01 97 00 00 01',
      description: 'Numéro béninois, tout format usuel',
    }),
    Transform(({ value }: { value: unknown }) => toBeninPhone(value) ?? value),
    Matches(BENIN_PHONE, { message: BENIN_PHONE_MESSAGE }),
  );
