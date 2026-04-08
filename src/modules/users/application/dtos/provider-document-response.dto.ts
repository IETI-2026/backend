import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProviderDocumentStatus } from './provider-document-status.enum';

export class ProviderDocumentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  providerProfileId!: string;

  @ApiProperty()
  documentType!: string;

  @ApiProperty()
  documentHash!: string;

  @ApiPropertyOptional({ nullable: true })
  fileUrl!: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  issuedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  expiresAt!: Date | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  verifiedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  verifiedBy!: string | null;

  @ApiProperty({ enum: ProviderDocumentStatus })
  status!: ProviderDocumentStatus;

  @ApiPropertyOptional({ nullable: true })
  rejectionReason!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}
