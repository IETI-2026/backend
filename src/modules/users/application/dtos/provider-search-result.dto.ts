import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProviderSearchResultDto {
  @ApiProperty() userId!: string;
  @ApiProperty() fullName!: string;
  @ApiPropertyOptional({ nullable: true }) profilePhotoUrl!: string | null;
  @ApiPropertyOptional({ nullable: true }) bio!: string | null;
  @ApiProperty({ type: [String] }) skills!: string[];
  @ApiPropertyOptional({ nullable: true }) averageRating!: number | null;
  @ApiProperty() totalRatings!: number;
  @ApiProperty() isAvailable!: boolean;
  @ApiProperty() verificationStatus!: string;
}
