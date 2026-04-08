import { ApiProperty } from '@nestjs/swagger';
import { ProviderVerificationStatus } from '@/database/enums';
import { ProviderDocumentStatus } from './provider-document-status.enum';

export class ProviderReviewItemDto {
  @ApiProperty({ format: 'uuid' })
  documentId!: string;

  @ApiProperty({ format: 'uuid' })
  providerUserId!: string;

  @ApiProperty({ format: 'uuid' })
  providerProfileId!: string;

  @ApiProperty()
  providerFullName!: string;

  @ApiProperty({ nullable: true })
  providerDocumentId!: string | null;

  @ApiProperty()
  documentType!: string;

  @ApiProperty({ enum: ProviderDocumentStatus })
  documentStatus!: ProviderDocumentStatus;

  @ApiProperty({ enum: ProviderVerificationStatus })
  providerVerificationStatus!: ProviderVerificationStatus;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
}
