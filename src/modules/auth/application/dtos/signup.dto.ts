import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';

export class SignUpDto {
  @ApiProperty({
    description: 'Correo electrónico del usuario',
    example: 'usuario@example.com',
    format: 'email',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Nombre completo del usuario',
    example: 'Juan Pérez García',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  fullName: string;

  @ApiProperty({
    description:
      'Contraseña (mínimo 8 caracteres, debe contener mayúscula, minúscula, número y carácter especial)',
    example: 'MiPassword123!',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/gim, {
    message:
      'Password must contain uppercase, lowercase, number and special character (@$!%*?&)',
  })
  password: string;

  @ApiPropertyOptional({
    description: 'Número de teléfono (formato internacional)',
    example: '+573001234567',
  })
  @IsString()
  @IsOptional()
  phoneNumber?: string;
}
