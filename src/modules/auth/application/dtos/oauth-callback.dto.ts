import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class OAuthCallbackDto {
  @ApiPropertyOptional({
    description: 'Código de autorización OAuth',
    example: '4/0AX4XfWh...',
  })
  @IsString()
  @IsNotEmpty()
  code?: string;

  @ApiPropertyOptional({
    description: 'Estado anti-CSRF del flujo OAuth',
    example: 'abc123xyz',
  })
  @IsString()
  @IsNotEmpty()
  state?: string;

  @ApiPropertyOptional({
    description: 'Email del usuario obtenido del proveedor OAuth',
    example: 'usuario@gmail.com',
    format: 'email',
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    description: 'Nombre completo del usuario obtenido del proveedor OAuth',
    example: 'Juan Pérez',
  })
  @IsString()
  @IsOptional()
  fullName?: string;

  @ApiPropertyOptional({
    description: 'URL de la foto de perfil del proveedor OAuth',
    example: 'https://lh3.googleusercontent.com/a/photo.jpg',
  })
  @IsString()
  @IsOptional()
  profilePhotoUrl?: string;
}
