import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '@users/domain';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiPropertyOptional({
    description: 'Email del usuario',
    example: 'usuario@example.com',
    format: 'email',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Número de teléfono (formato internacional)',
    example: '+573001234567',
    minLength: 10,
    maxLength: 15,
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(15)
  phoneNumber?: string;

  @ApiPropertyOptional({
    description: 'Hash de la contraseña del usuario',
    example: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
    minLength: 8,
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  passwordHash?: string;

  @ApiProperty({
    description: 'Nombre completo del usuario',
    example: 'Juan Pérez García',
    minLength: 2,
    maxLength: 100,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName!: string;

  @ApiPropertyOptional({
    description: 'Documento de identidad (cédula, pasaporte, etc.)',
    example: '1234567890',
  })
  @IsOptional()
  @IsString()
  documentId?: string;

  @ApiPropertyOptional({
    description: 'URL de la foto de perfil del usuario',
    example: 'https://example.com/photos/user123.jpg',
  })
  @IsOptional()
  @IsString()
  profilePhotoUrl?: string;

  @ApiPropertyOptional({
    description: 'Estado del usuario',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
    example: UserStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
