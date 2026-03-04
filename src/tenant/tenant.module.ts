import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TenantService } from './tenant.service';
import { TenantContext } from './tenant-context';
import { tenantDataSourceProvider } from './tenant-datasource.provider';
import { TenantDataSourceService } from './tenant-datasource.service';

@Module({
  imports: [ConfigModule],
  providers: [
    TenantContext,
    TenantService,
    TenantDataSourceService,
    tenantDataSourceProvider,
  ],
  exports: [
    TenantContext,
    TenantService,
    TenantDataSourceService,
    tenantDataSourceProvider,
  ],
})
export class TenantModule {}
