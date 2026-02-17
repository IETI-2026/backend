import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class RejectServiceRequestDto {
  @ApiProperty({
    description: 'ID del usuario técnico que rechaza la solicitud',
    example: 'd94f7f76-7f57-45be-8a0f-47f6385ab81e',
  })
  @IsUUID()
  technicianUserId!: string;

  @ApiPropertyOptional({
    description: 'Motivo del rechazo por parte del técnico',
    example: 'No tengo disponibilidad en este horario',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
