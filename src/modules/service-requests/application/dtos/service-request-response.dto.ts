import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceRequestStatus, UrgencyLevel } from '@/database/enums';
import { TechnicianResponseDto } from './technician-response.dto';

export class ServiceRequestResponseDto {
  @ApiProperty({
    description: 'ID único de la solicitud de servicio',
    example: '6f9619ff-8b86-d011-b42d-00cf4fc964ff',
  })
  id!: string;

  @ApiProperty({
    description: 'ID del usuario cliente',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiPropertyOptional({
    description: 'ID del técnico asignado cuando acepta la solicitud',
    example: 'd94f7f76-7f57-45be-8a0f-47f6385ab81e',
    nullable: true,
  })
  assignedTechnicianId!: string | null;

  @ApiProperty({
    description: 'Problema reportado por el cliente',
    example: 'El lavamanos tiene una fuga y gotea constantemente',
  })
  problema!: string;

  @ApiProperty({
    description: 'Habilidades solicitadas para resolver el problema',
    type: [String],
    example: ['plomería', 'soldadura'],
  })
  requestedSkills!: string[];

  @ApiProperty({
    description: 'Estado actual de la solicitud',
    enum: ServiceRequestStatus,
    example: ServiceRequestStatus.REQUESTED,
  })
  status!: ServiceRequestStatus;

  @ApiProperty({
    description: 'Urgencia de la solicitud',
    enum: UrgencyLevel,
    example: UrgencyLevel.media,
  })
  urgency!: UrgencyLevel;

  @ApiProperty({
    description: 'Latitud del punto de servicio',
    example: 4.60971,
  })
  latitude!: number;

  @ApiProperty({
    description: 'Longitud del punto de servicio',
    example: -74.08175,
  })
  longitude!: number;

  @ApiProperty({
    description: 'Dirección legible del punto de servicio',
    example: 'Calle 80 # 15-20, Bogotá',
  })
  addressText!: string;

  @ApiProperty({
    description: 'Ciudad o tenant lógico de la solicitud',
    example: 'bogota',
  })
  serviceCity!: string;

  @ApiProperty({
    description: 'Técnicos que han respondido a la solicitud',
    type: TechnicianResponseDto,
    isArray: true,
  })
  technicianResponses!: TechnicianResponseDto[];

  @ApiPropertyOptional({
    description: 'Fecha en que el servicio pasó a IN_PROGRESS',
    type: 'string',
    format: 'date-time',
    nullable: true,
  })
  startedAt!: Date | null;

  @ApiProperty({
    description: 'Indica si el cliente marcó el servicio como finalizado',
  })
  clientMarkedComplete!: boolean;

  @ApiProperty({
    description: 'Indica si el técnico marcó el servicio como finalizado',
  })
  technicianMarkedComplete!: boolean;

  @ApiPropertyOptional({
    description:
      'Distancia de desplazamiento del técnico en km al momento de ser elegido',
    example: 3.2,
    nullable: true,
  })
  displacementDistanceKm!: number | null;

  @ApiPropertyOptional({
    description: 'Precio final del servicio',
    example: '58000',
    nullable: true,
  })
  finalPrice!: string | null;

  @ApiPropertyOptional({
    description: 'Fecha en que el servicio fue completado',
    type: 'string',
    format: 'date-time',
    nullable: true,
  })
  completedAt!: Date | null;

  @ApiPropertyOptional({
    description: 'Nombre del técnico asignado',
    example: 'Carlos Alvarez',
    nullable: true,
  })
  technicianName!: string | null;

  @ApiPropertyOptional({
    description: 'URL de la foto de perfil del técnico asignado',
    example: 'https://cdn.example.com/photo.jpg',
    nullable: true,
  })
  technicianPhotoUrl!: string | null;

  @ApiPropertyOptional({
    description: 'URL del recibo PDF en el blob storage',
    example:
      'https://storage.blob.core.windows.net/cameyo-storage/recibo_abc123.pdf',
    nullable: true,
  })
  receiptUrl!: string | null;

  @ApiPropertyOptional({
    description: 'Nombre de la categoría del servicio',
    example: 'plomeria',
    nullable: true,
  })
  categoryName!: string | null;

  @ApiProperty({
    description: 'Indica si el servicio ya fue calificado por el cliente',
  })
  isRated!: boolean;

  @ApiProperty({
    description: 'Fecha de creación de la solicitud',
    type: 'string',
    format: 'date-time',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Fecha de última actualización',
    type: 'string',
    format: 'date-time',
  })
  updatedAt!: Date;
}
