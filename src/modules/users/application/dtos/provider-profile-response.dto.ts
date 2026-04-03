import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProviderProfileResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() userId!: string;
  @ApiPropertyOptional() bio!: string | null;
  @ApiProperty() verificationStatus!: string;
  @ApiPropertyOptional({ nullable: true }) averageRating!: number | null;
  @ApiProperty() totalRatings!: number;
  @ApiProperty() totalCompletedServices!: number;
  @ApiProperty() totalCancelledServices!: number;
  @ApiProperty() isAvailable!: boolean;
  @ApiPropertyOptional() currentLatitude!: number | null;
  @ApiPropertyOptional() currentLongitude!: number | null;
  @ApiPropertyOptional() nequiNumber!: string | null;
  @ApiPropertyOptional() daviplataNumber!: string | null;
  @ApiProperty() skills!: string[];
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
