import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
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
