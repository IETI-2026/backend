import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class RateServiceRequestDto {
  @ApiProperty({
    description: 'Calificación del servicio (1-5)',
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  serviceRating!: number;

  @ApiProperty({
    description: 'Calificación del técnico (1-5)',
    example: 4,
    minimum: 1,
    maximum: 5,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  technicianRating!: number;

  @ApiPropertyOptional({
    description: 'Comentario opcional del cliente',
    example: 'Excelente servicio, muy puntual',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  comment?: string;
}
