import { Module } from '@nestjs/common';
import { TenantModule } from '@/tenant';
import { AuthModule } from '../auth';
import { MailModule } from '../mail';
import { ServiceRequestsModule } from '../service-requests';
import { PaymentsService } from './application';
import { PaymentsController } from './presentation';

@Module({
  imports: [TenantModule, MailModule, AuthModule, ServiceRequestsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
