import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { TenantModule } from '@/tenant';
import { AuthModule } from '../auth';
import { ServiceRequestsService } from './application';
import { ServiceRequestsController } from './presentation';

@Module({
  imports: [PrismaModule, TenantModule, AuthModule],
  controllers: [ServiceRequestsController],
  providers: [ServiceRequestsService],
  exports: [ServiceRequestsService],
})
export class ServiceRequestsModule {}
