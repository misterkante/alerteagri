import { IsString, Length, Matches } from 'class-validator';

export class CreateProducerDto {
  @IsString()
  @Matches(/^\+?[0-9]{8,15}$/, { message: 'Numéro de téléphone invalide' })
  phone!: string;
  @IsString() @Length(2, 80) name!: string;
  @IsString()
  @Matches(/^[0-9]{4}$/, { message: 'Le PIN doit contenir 4 chiffres' })
  pin!: string;
}
