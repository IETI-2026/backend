import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional, Max, Min } from 'class-validator';
import { ProviderDocumentStatus } from './provider-document-status.enum';

export class ProviderReviewQueryDto {
  @ApiPropertyOptional({ example: 0, description: 'Numero de pagina' })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  page?: number;

  @ApiPropertyOptional({ example: 20, description: 'Tamano de pagina' })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    enum: ProviderDocumentStatus,
    default: ProviderDocumentStatus.PENDING_REVIEW,
  })
  @IsOptional()
  @IsEnum(ProviderDocumentStatus)
  status?: ProviderDocumentStatus;
}
