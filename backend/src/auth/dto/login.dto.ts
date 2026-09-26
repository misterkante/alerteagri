import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { BeninPhone } from '../../common/decorators/benin-phone.decorator';

export class LoginDto {
  @BeninPhone()
  phone!: string;

  @ApiProperty({ example: '1234' })
  @IsString()
  @Matches(/^[0-9]{4}$/, {
    message: 'Le PIN doit contenir exactement 4 chiffres',
  })
  pin!: string;
}
