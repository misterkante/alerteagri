import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsEnum, IsString, Length, Matches } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: '+22997000000' })
  @IsString()
  @Matches(/^\+?[0-9]{8,15}$/, { message: 'Numero de telephone invalide' })
  phone: string;

  @ApiProperty({ example: 'Awa Dossou' })
  @IsString()
  @Length(2, 80)
  name: string;

  @ApiProperty({ enum: [Role.PRODUCER, Role.BUYER] })
  @IsEnum(Role, { message: 'Le role doit etre PRODUCER ou BUYER' })
  role: Role;

  @ApiProperty({ example: 'Parakou' })
  @IsString()
  @Length(2, 60)
  commune: string;

  @ApiProperty({ example: '1234', description: 'Code PIN a 4 chiffres' })
  @IsString()
  @Matches(/^[0-9]{4}$/, { message: 'Le PIN doit contenir exactement 4 chiffres' })
  pin: string;
}
