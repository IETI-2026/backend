import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class SendOtpDto {
  @ApiProperty({
    description:
      'Número de teléfono para enviar el OTP (formato internacional)',
    example: '+573001234567',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+\d{10,15}$/, {
    message:
      'Phone number must be in international format (e.g. +573001234567)',
  })
  phone!: string;
}
