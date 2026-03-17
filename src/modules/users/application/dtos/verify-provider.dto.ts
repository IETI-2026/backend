import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';

export enum VerificationAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  SUSPEND = 'SUSPEND',
}

export class VerifyProviderDto {
  @ApiProperty({
    description: 'Acción de verificación',
    enum: VerificationAction,
    example: VerificationAction.APPROVE,
  })
  @IsEnum(VerificationAction)
  @IsNotEmpty()
  action!: VerificationAction;
}
