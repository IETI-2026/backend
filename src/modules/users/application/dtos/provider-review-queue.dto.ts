import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProviderReviewQueueItemDto {
  @ApiProperty() documentId!: string;
  @ApiProperty() providerUserId!: string;
  @ApiProperty() providerProfileId!: string;
  @ApiProperty() providerFullName!: string;
  @ApiPropertyOptional() providerDocumentId!: string;
  @ApiProperty() documentType!: string;
  @ApiProperty() documentStatus!: string;
  @ApiProperty() providerVerificationStatus!: string;
  @ApiProperty() createdAt!: string;
}

export class ProviderReviewQueueResponseDto {
  @ApiProperty({ type: [ProviderReviewQueueItemDto] })
  items!: ProviderReviewQueueItemDto[];

  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() totalPages!: number;
}
