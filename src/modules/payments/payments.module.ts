import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  PaymentEntity,
  ServiceRequestEntity,
  UserEntity,
  UserPaymentMethodEntity,
} from '@/database/entities';
import { TenantModule } from '@/tenant';
import { AuthModule } from '../auth';
import { ServiceRequestsModule } from '../service-requests';
import { PaymentsService } from './application';
import { PaymentsController } from './presentation';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentEntity,
      UserPaymentMethodEntity,
      ServiceRequestEntity,
      UserEntity,
    ]),
    TenantModule,
    AuthModule,
    ServiceRequestsModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
