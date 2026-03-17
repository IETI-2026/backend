import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'Email del usuario para enviar el enlace de restablecimiento',
    example: 'usuario@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}
