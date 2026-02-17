import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ServiceRequestStatus, UrgencyLevel } from "@prisma/client";
import { TechnicianResponseDto } from "./technician-response.dto";

export class ServiceRequestResponseDto {
  @ApiProperty({
    description: "ID único de la solicitud de servicio",
    example: "6f9619ff-8b86-d011-b42d-00cf4fc964ff",
  })
  id!: string;

  @ApiProperty({
    description: "ID del usuario cliente",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  userId!: string;

  @ApiPropertyOptional({
    description: "ID del técnico asignado cuando acepta la solicitud",
    example: "d94f7f76-7f57-45be-8a0f-47f6385ab81e",
    nullable: true,
  })
  assignedTechnicianId!: string | null;

  @ApiProperty({
    description: "Problema reportado por el cliente",
    example: "El lavamanos tiene una fuga y gotea constantemente",
  })
  problema!: string;

  @ApiProperty({
    description: "Habilidades solicitadas para resolver el problema",
    type: [String],
    example: ["plomería", "soldadura"],
  })
  requestedSkills!: string[];

  @ApiProperty({
    description: "Estado actual de la solicitud",
    enum: ServiceRequestStatus,
    example: ServiceRequestStatus.REQUESTED,
  })
  status!: ServiceRequestStatus;

  @ApiProperty({
    description: "Urgencia de la solicitud",
    enum: UrgencyLevel,
    example: UrgencyLevel.MEDIUM,
  })
  urgency!: UrgencyLevel;

  @ApiProperty({
    description: "Latitud del punto de servicio",
    example: 4.60971,
  })
  latitude!: number;

  @ApiProperty({
    description: "Longitud del punto de servicio",
    example: -74.08175,
  })
  longitude!: number;

  @ApiProperty({
    description: "Dirección legible del punto de servicio",
    example: "Calle 80 # 15-20, Bogotá",
  })
  addressText!: string;

  @ApiProperty({
    description: "Ciudad o tenant lógico de la solicitud",
    example: "bogota",
  })
  serviceCity!: string;

  @ApiProperty({
    description: "Técnicos que han respondido a la solicitud",
    type: TechnicianResponseDto,
    isArray: true,
  })
  technicianResponses!: TechnicianResponseDto[];

  @ApiProperty({
    description: "Fecha de creación de la solicitud",
    type: "string",
    format: "date-time",
  })
  createdAt!: Date;

  @ApiProperty({
    description: "Fecha de última actualización",
    type: "string",
    format: "date-time",
  })
  updatedAt!: Date;
}
