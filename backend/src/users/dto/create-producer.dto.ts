import { IsString, Length, Matches } from 'class-validator';
import { BeninPhone } from '../../common/decorators/benin-phone.decorator';

export class CreateProducerDto {
  @BeninPhone()
  phone!: string;
  @IsString() @Length(2, 80) name!: string;
  @IsString()
  @Matches(/^[0-9]{4}$/, { message: 'Le PIN doit contenir 4 chiffres' })
  pin!: string;
}
