import { FactoryProvider, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { TenantContext } from './tenant-context';
import { TenantPrismaService } from './tenant-prisma.service';

export const TENANT_PRISMA_CLIENT = 'TENANT_PRISMA_CLIENT';

export const tenantPrismaClientProvider: FactoryProvider<
  Promise<PrismaClient>
> = {
  provide: TENANT_PRISMA_CLIENT,
  scope: Scope.REQUEST,
  inject: [TenantContext, TenantPrismaService],
  useFactory: (
    tenantContext: TenantContext,
    tenantPrismaService: TenantPrismaService,
  ): Promise<PrismaClient> => {
    const tenantId = tenantContext.getTenantId() ?? 'public';
    return tenantPrismaService.getClient(tenantId);
  },
};
