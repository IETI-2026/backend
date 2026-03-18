import { Module } from '@nestjs/common';
import { TenantModule } from '@/tenant';
import { AuthModule } from '../auth';
import { ServiceRequestsService } from './application';
import { ServiceRequestsController, ServiceRequestsGateway } from './presentation';

@Module({
  imports: [TenantModule, AuthModule],
  controllers: [ServiceRequestsController],
  providers: [ServiceRequestsGateway, ServiceRequestsService],
  exports: [ServiceRequestsService],
})
export class ServiceRequestsModule {}
