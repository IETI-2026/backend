import { Module } from '@nestjs/common';
import { WsJwtGuard } from '@/common/guards/ws-jwt.guard';
import { BlobStorageService } from '@/common/services/blob-storage.service';
import { TenantModule } from '@/tenant';
import { AuthModule } from '../auth';
import { ServiceRequestsService } from './application';
import {
  ServiceRequestsController,
  ServiceRequestsGateway,
} from './presentation';

@Module({
  imports: [TenantModule, AuthModule],
  controllers: [ServiceRequestsController],
  providers: [
    ServiceRequestsGateway,
    ServiceRequestsService,
    BlobStorageService,
    WsJwtGuard,
  ],
  exports: [ServiceRequestsService, ServiceRequestsGateway],
})
export class ServiceRequestsModule {}
