import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PaymentMethodType } from '@/database/enums';

export class CreatePaymentDto {
  @ApiProperty({
    description: 'ID de la solicitud de servicio',
    format: 'uuid',
  })
  @IsUUID()
  serviceRequestId!: string;

  @ApiProperty({ description: 'Monto bruto del pago', example: 120000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  grossAmount!: number;

  @ApiPropertyOptional({
    description: 'Comisión aplicada en decimal (ej: 0.10 para 10%)',
    example: 0.1,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  commissionRate?: number;

  @ApiPropertyOptional({
    description: 'ID del método de pago guardado por el usuario',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;

  @ApiPropertyOptional({
    enum: PaymentMethodType,
    description: 'Tipo de método de pago (si no se envía paymentMethodId)',
  })
  @IsOptional()
  @IsEnum(PaymentMethodType)
  paymentMethod?: PaymentMethodType;

  @ApiPropertyOptional({
    description: 'Referencia externa transaccional (pasarela/billetera)',
    example: 'epayco_tx_12345',
  })
  @IsOptional()
  @IsString()
  externalTransactionId?: string;

  @ApiPropertyOptional({
    description: 'Referencia del gateway',
    example: 'ref_abc_098',
  })
  @IsOptional()
  @IsString()
  gatewayReference?: string;

  @ApiPropertyOptional({
    description: 'Payload técnico del gateway',
    type: Object,
  })
  @IsOptional()
  gatewayResponse?: Record<string, unknown>;
}
