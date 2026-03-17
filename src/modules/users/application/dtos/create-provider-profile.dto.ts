import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProviderProfileDto {
  @ApiPropertyOptional({
    description: 'Biografía o descripción del prestador',
    example:
      'Electricista con 10 años de experiencia en instalaciones residenciales',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional({
    description: 'Radio de cobertura en kilómetros',
    example: 15.0,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  coverageRadiusKm?: number;

  @ApiPropertyOptional({
    description: 'Disponible para recibir solicitudes',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @ApiPropertyOptional({
    description: 'Número Nequi para recibir pagos',
    example: '3001234567',
  })
  @IsOptional()
  @IsString()
  nequiNumber?: string;

  @ApiPropertyOptional({
    description: 'Número Daviplata para recibir pagos',
    example: '3001234567',
  })
  @IsOptional()
  @IsString()
  daviplataNumber?: string;

  @ApiProperty({
    description: 'Habilidades/servicios que ofrece el prestador',
    example: ['electricidad', 'plomería'],
    type: [String],
  })
  @IsOptional()
  @IsString({ each: true })
  skills?: string[];
}
