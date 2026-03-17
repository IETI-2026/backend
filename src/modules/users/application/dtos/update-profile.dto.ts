import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: 'Nombre completo del usuario',
    example: 'Juan Pérez García',
    minLength: 2,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName?: string;

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
    description: 'URL de la foto de perfil',
    example: 'https://example.com/photos/user123.jpg',
  })
  @IsOptional()
  @IsString()
  profilePhotoUrl?: string;
}
