import { ApiPropertyOptional } from "@nestjs/swagger";
import { ServiceRequestStatus } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";

export class GetServiceRequestsQueryDto {
  @ApiPropertyOptional({
    description: "Filtrar por estado de la solicitud",
    enum: ServiceRequestStatus,
    example: ServiceRequestStatus.ASSIGNED,
  })
  @IsOptional()
  @IsEnum(ServiceRequestStatus)
  status?: ServiceRequestStatus;

  @ApiPropertyOptional({
    description: "Filtrar por ID del cliente creador",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({
    description: "Filtrar por técnico asignado",
    example: "d94f7f76-7f57-45be-8a0f-47f6385ab81e",
  })
  @IsOptional()
  @IsUUID()
  technicianUserId?: string;

  @ApiPropertyOptional({
    description: "Filtrar por ciudad/tenant lógico de la solicitud",
    example: "bogota",
  })
  @IsOptional()
  @IsString()
  serviceCity?: string;

  @ApiPropertyOptional({
    description: "Página (inicia en 0)",
    example: 0,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  page?: number;

  @ApiPropertyOptional({
    description: "Cantidad por página",
    example: 20,
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
