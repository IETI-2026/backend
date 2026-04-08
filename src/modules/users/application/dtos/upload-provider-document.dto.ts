import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadProviderDocumentDto {
  @ApiProperty({
    description: 'Tipo de documento cargado',
    example: 'CERTIFICADO_ANTECEDENTES',
    maxLength: 80,
  })
  @IsString()
  @MaxLength(80)
  documentType!: string;

  @ApiPropertyOptional({
    description: 'Fecha de expedicion del documento',
    example: '2026-03-21T00:00:00.000Z',
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  issuedAt?: string;

  @ApiPropertyOptional({
    description: 'Fecha de expiracion del documento',
    example: '2028-03-21T00:00:00.000Z',
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({
    description: 'Numero de documento detectado o digitado manualmente',
    example: '1234567890',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  documentNumber?: string;
}
