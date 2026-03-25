import { Module } from '@nestjs/common';
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
  ],
  exports: [ServiceRequestsService],
})
export class ServiceRequestsModule {}
