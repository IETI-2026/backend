import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { UserStatus } from "@users/domain";

export class UserResponseDto {
  @ApiProperty({
    description: "ID único del usuario (UUID)",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  id!: string;

  @ApiPropertyOptional({
    description: "Email del usuario",
    example: "usuario@example.com",
    nullable: true,
  })
  email!: string | null;

  @ApiPropertyOptional({
    description: "Número de teléfono del usuario",
    example: "+573001234567",
    nullable: true,
  })
  phoneNumber!: string | null;

  @ApiProperty({
    description: "Nombre completo del usuario",
    example: "Juan Pérez García",
  })
  fullName!: string;

  @ApiPropertyOptional({
    description: "Documento de identidad",
    example: "1234567890",
    nullable: true,
  })
  documentId!: string | null;

  @ApiPropertyOptional({
    description: "URL de la foto de perfil",
    example: "https://example.com/photos/user123.jpg",
    nullable: true,
  })
  profilePhotoUrl!: string | null;

  @ApiProperty({
    description: "Lista de habilidades del usuario",
    example: ["electricidad", "plomería"],
    type: [String],
  })
  skills!: string[];

  @ApiPropertyOptional({
    description: "Latitud actual del usuario",
    example: 4.60971,
    nullable: true,
  })
  currentLatitude!: number | null;

  @ApiPropertyOptional({
    description: "Longitud actual del usuario",
    example: -74.08175,
    nullable: true,
  })
  currentLongitude!: number | null;

  @ApiPropertyOptional({
    description: "Fecha de última actualización de ubicación",
    example: "2026-02-16T10:30:00Z",
    type: "string",
    format: "date-time",
    nullable: true,
  })
  lastLocationUpdate!: Date | null;

  @ApiProperty({
    description: "Estado actual del usuario",
    enum: UserStatus,
    example: UserStatus.ACTIVE,
  })
  status!: UserStatus;

  @ApiProperty({
    description: "Indica si el email ha sido verificado",
    example: true,
  })
  emailVerified!: boolean;

  @ApiProperty({
    description: "Indica si el teléfono ha sido verificado",
    example: false,
  })
  phoneVerified!: boolean;

  @ApiProperty({
    description: "Fecha y hora de creación del usuario",
    example: "2024-01-15T10:30:00Z",
    type: "string",
    format: "date-time",
  })
  createdAt!: Date;

  @ApiProperty({
    description: "Fecha y hora de última actualización",
    example: "2024-01-20T15:45:00Z",
    type: "string",
    format: "date-time",
  })
  updatedAt!: Date;

  @ApiPropertyOptional({
    description: "Fecha y hora del último login",
    example: "2024-01-25T08:15:00Z",
    type: "string",
    format: "date-time",
    nullable: true,
  })
  lastLoginAt!: Date | null;
}
