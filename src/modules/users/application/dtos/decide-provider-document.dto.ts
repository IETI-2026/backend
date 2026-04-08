import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ProviderDocumentDecision } from './provider-document-status.enum';

export class DecideProviderDocumentDto {
  @ApiProperty({ enum: ProviderDocumentDecision })
  @IsEnum(ProviderDocumentDecision)
  decision!: ProviderDocumentDecision;

  @ApiPropertyOptional({
    description: 'Motivo de rechazo o comentario de revision',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
