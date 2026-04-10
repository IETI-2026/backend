import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * DTO que modela el payload de confirmación que ePayco envía al endpoint
 * de webhook tras procesar una transacción.
 *
 * Campos según la especificación oficial de ePayco:
 * https://docs.epayco.com/docs/confirmacion-de-pago
 */
export class EpaycoWebhookDto {
  /** Referencia única de la transacción en ePayco */
  @ApiProperty({ example: 'EP-1700000000000-ABC123' })
  @IsString()
  x_ref_payco!: string;

  /** ID interno de la transacción en el sistema de ePayco */
  @ApiPropertyOptional({ example: '123456789' })
  @IsOptional()
  @IsString()
  x_transaction_id?: string;

  /** Monto total cobrado */
  @ApiPropertyOptional({ example: '79000.00' })
  @IsOptional()
  @IsString()
  x_amount?: string;

  /** Moneda utilizada */
  @ApiPropertyOptional({ example: 'COP' })
  @IsOptional()
  @IsString()
  x_currency_code?: string;

  /**
   * Código de respuesta de la transacción:
   * - '1' → Aceptada
   * - '2' → Rechazada
   * - '3' → Pendiente
   * - '4' → Fallida
   * - '6' → Reversada
   */
  @ApiProperty({ example: '1' })
  @IsString()
  x_response!: string;

  /** Descripción del estado de la transacción */
  @ApiPropertyOptional({ example: 'Aceptada' })
  @IsOptional()
  @IsString()
  x_transaction_state?: string;

  /** Firma SHA-256 para validar autenticidad del webhook */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  x_signature?: string;

  /** Campo extra 1: ID del pago interno (UUID del PaymentEntity) */
  @ApiPropertyOptional({ example: 'uuid-del-pago-interno' })
  @IsOptional()
  @IsString()
  x_extra1?: string;

  /** Campo extra 2: ID de la solicitud de servicio */
  @ApiPropertyOptional({ example: 'uuid-de-la-solicitud' })
  @IsOptional()
  @IsString()
  x_extra2?: string;

  /** Franquicia de tarjeta (VISA, MASTERCARD, etc.) */
  @ApiPropertyOptional({ example: 'VISA' })
  @IsOptional()
  @IsString()
  x_franchise?: string;

  /** Código de banco (para PSE) */
  @ApiPropertyOptional({ example: 'BANCOLOMBIA' })
  @IsOptional()
  @IsString()
  x_bank_name?: string;

  /** Número de cuotas (tarjeta de crédito) */
  @ApiPropertyOptional({ example: '1' })
  @IsOptional()
  @IsString()
  x_quotas?: string;

  /** Fecha y hora de la transacción */
  @ApiPropertyOptional({ example: '2024-01-15T10:30:00' })
  @IsOptional()
  @IsString()
  x_transaction_date?: string;
}
