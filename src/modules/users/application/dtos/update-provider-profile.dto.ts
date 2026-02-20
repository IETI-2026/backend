import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateProviderProfileDto {
  @ApiPropertyOptional({
    description: 'Biografía o descripción del prestador',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional({
    description: 'Radio de cobertura en kilómetros',
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  coverageRadiusKm?: number;

  @ApiPropertyOptional({ description: 'Disponible para recibir solicitudes' })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @ApiPropertyOptional({ description: 'Número Nequi' })
  @IsOptional()
  @IsString()
  nequiNumber?: string;

  @ApiPropertyOptional({ description: 'Número Daviplata' })
  @IsOptional()
  @IsString()
  daviplataNumber?: string;

  @ApiPropertyOptional({
    description: 'Habilidades/servicios que ofrece',
    type: [String],
  })
  @IsOptional()
  @IsString({ each: true })
  skills?: string[];

  @ApiPropertyOptional({ description: 'Latitud actual' })
  @IsOptional()
  @IsNumber()
  currentLatitude?: number;

  @ApiPropertyOptional({ description: 'Longitud actual' })
  @IsOptional()
  @IsNumber()
  currentLongitude?: number;
}
