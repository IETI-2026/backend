import { FactoryProvider, Scope } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantContext } from './tenant-context';
import { TenantDataSourceService } from './tenant-datasource.service';

export const TENANT_DATA_SOURCE = 'TENANT_DATA_SOURCE';

export const tenantDataSourceProvider: FactoryProvider<Promise<DataSource>> = {
  provide: TENANT_DATA_SOURCE,
  scope: Scope.REQUEST,
  inject: [TenantContext, TenantDataSourceService],
  useFactory: (
    tenantContext: TenantContext,
    tenantDataSourceService: TenantDataSourceService,
  ): Promise<DataSource> => {
    const tenantId = tenantContext.getTenantId() ?? 'public';
    return tenantDataSourceService.getDataSource(tenantId);
  },
};
