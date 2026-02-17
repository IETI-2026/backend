import { ApiProperty } from "@nestjs/swagger";
import { TechnicianResponseStatus } from "@prisma/client";

export class TechnicianResponseDto {
  @ApiProperty({
    description: "ID del técnico",
    example: "d94f7f76-7f57-45be-8a0f-47f6385ab81e",
  })
  technicianUserId!: string;

  @ApiProperty({
    description: "Estado de respuesta del técnico",
    enum: TechnicianResponseStatus,
    example: TechnicianResponseStatus.ACCEPTED,
  })
  status!: TechnicianResponseStatus;

  @ApiProperty({
    description: "Fecha en la que respondió el técnico",
    type: "string",
    format: "date-time",
  })
  respondedAt!: Date;
}
