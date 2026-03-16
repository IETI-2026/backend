import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethodType, RoleName } from '@/database/enums';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreatePaymentMethodDto {
  @ApiProperty({ enum: PaymentMethodType, description: 'Tipo de método de pago' })
  @IsEnum(PaymentMethodType)
  methodType!: PaymentMethodType;

  @ApiPropertyOptional({
    enum: [RoleName.USER, RoleName.PROVIDER],
    description: 'Rol para el cual aplica el método',
  })
  @IsOptional()
  @IsEnum(RoleName)
  forRole?: RoleName;

  @ApiPropertyOptional({ description: 'Alias legible del método', example: 'Mi Nequi principal' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  alias?: string;

  @ApiPropertyOptional({ description: 'Titular del método', example: 'Juan Perez' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  accountHolder?: string;

  @ApiPropertyOptional({
    description: 'Identificador (teléfono, tarjeta enmascarada, referencia, etc.)',
    example: '3001234567',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  accountIdentifier?: string;

  @ApiPropertyOptional({ description: 'Metadatos adicionales del método', type: Object })
  @IsOptional()
  @IsObject()
  details?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Define este método como predeterminado' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
