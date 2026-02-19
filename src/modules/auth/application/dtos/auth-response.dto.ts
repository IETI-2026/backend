import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';

class AuthUserDto {
  @ApiProperty({ description: 'ID del usuario', example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ description: 'Email del usuario', example: 'usuario@example.com' })
  email: string;

  @ApiProperty({ description: 'Nombre completo', example: 'Juan Pérez' })
  fullName: string;

  @ApiPropertyOptional({ description: 'URL de foto de perfil', example: 'https://example.com/photo.jpg' })
  profilePhotoUrl?: string;

  @ApiProperty({
    description: 'Roles del usuario',
    example: ['USER'],
    enum: RoleName,
    isArray: true,
  })
  roles: RoleName[];
}

export class AuthResponseDto {
  @ApiProperty({
    description: 'JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken?: string;

  @ApiProperty({
    description: 'JWT refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken?: string;

  @ApiProperty({
    description: 'Tiempo de expiración del access token en segundos',
    example: 900,
  })
  expiresIn?: number;

  @ApiProperty({
    description: 'Tipo de token',
    example: 'Bearer',
    default: 'Bearer',
  })
  tokenType: string = 'Bearer';

  @ApiPropertyOptional({
    description: 'Datos básicos del usuario autenticado',
    type: AuthUserDto,
  })
  user?: AuthUserDto;
}
