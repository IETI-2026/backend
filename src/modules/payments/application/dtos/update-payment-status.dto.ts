import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatus } from '@/database/enums';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePaymentStatusDto {
  @ApiProperty({ enum: PaymentStatus, description: 'Nuevo estado del pago' })
  @IsEnum(PaymentStatus)
  status!: PaymentStatus;

  @ApiPropertyOptional({
    description: 'Razón del reembolso o fallo',
    example: 'Reverso solicitado por cliente',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({ description: 'URL de recibo/comprobante', example: 'https://...' })
  @IsOptional()
  @IsString()
  receiptUrl?: string;
}
