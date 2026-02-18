import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AcceptedTechnicianUserDto {
  @ApiProperty({
    description: 'ID del usuario técnico',
    example: '2777871d-a5cd-4678-9bf8-577307ceab23',
  })
  id!: string;

  @ApiProperty({
    description: 'Nombre completo del técnico',
    example: 'Juan Técnico',
  })
  fullName!: string;

  @ApiPropertyOptional({
    description: 'Email del técnico',
    example: 'tecnico@demo.com',
    nullable: true,
  })
  email!: string | null;

  @ApiPropertyOptional({
    description: 'Teléfono del técnico',
    example: '+573001234567',
    nullable: true,
  })
  phoneNumber!: string | null;

  @ApiProperty({
    description: 'Habilidades del técnico',
    type: [String],
    example: ['plomeria', 'soldadura'],
  })
  skills!: string[];

  @ApiPropertyOptional({
    description: 'Latitud actual del técnico',
    example: 4.60971,
    nullable: true,
  })
  currentLatitude!: number | null;

  @ApiPropertyOptional({
    description: 'Longitud actual del técnico',
    example: -74.08175,
    nullable: true,
  })
  currentLongitude!: number | null;

  @ApiProperty({
    description: 'Fecha en que aceptó la solicitud',
    type: 'string',
    format: 'date-time',
  })
  respondedAt!: Date;
}
