import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UrgencyLevel } from '@prisma/client';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateServiceRequestDto {
  @ApiProperty({
    description: 'ID del usuario cliente que crea la solicitud',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  userId!: string;

  @ApiProperty({
    description: 'Descripción del problema reportado por el cliente',
    example: 'El lavamanos tiene una fuga y gotea constantemente',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  problema!: string;

  @ApiProperty({
    description: 'Lista de habilidades requeridas para resolver el problema',
    example: ['plomería', 'soldadura'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  skills!: string[];

  @ApiProperty({
    description: 'Latitud del punto de servicio',
    example: 4.60971,
    type: Number,
  })
  @IsNumber()
  latitude!: number;

  @ApiProperty({
    description: 'Longitud del punto de servicio',
    example: -74.08175,
    type: Number,
  })
  @IsNumber()
  longitude!: number;

  @ApiProperty({
    description: 'Dirección legible del punto de servicio',
    example: 'Calle 80 # 15-20, Bogotá',
  })
  @IsString()
  @IsNotEmpty()
  addressText!: string;

  @ApiProperty({
    description:
      'Ciudad o tenant lógico de la solicitud (por ahora enviado como atributo)',
    example: 'bogota',
  })
  @IsString()
  @IsNotEmpty()
  serviceCity!: string;

  @ApiPropertyOptional({
    description: 'Nivel de urgencia de la solicitud',
    enum: UrgencyLevel,
    default: UrgencyLevel.MEDIUM,
  })
  @IsOptional()
  @IsEnum(UrgencyLevel)
  urgency?: UrgencyLevel;
}
