import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TenantService } from './tenant.service';
import { TenantContext } from './tenant-context';
import { TenantPrismaService } from './tenant-prisma.service';
import { tenantPrismaClientProvider } from './tenant-prisma-client.provider';

@Module({
  imports: [ConfigModule],
  providers: [
    TenantContext,
    TenantService,
    TenantPrismaService,
    tenantPrismaClientProvider,
  ],
  exports: [
    TenantContext,
    TenantService,
    TenantPrismaService,
    tenantPrismaClientProvider,
  ],
})
export class TenantModule {}
