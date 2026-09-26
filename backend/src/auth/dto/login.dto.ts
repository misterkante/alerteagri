import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: '+22997000000' })
  @IsString()
  phone: string;

  @ApiProperty({ example: '1234' })
  @IsString()
  @Matches(/^[0-9]{4}$/, { message: 'Le PIN doit contenir exactement 4 chiffres' })
  pin: string;
}
