import { Injectable } from '@nestjs/common';
import { TenantContext } from './tenant-context';

@Injectable()
export class TenantService {
  constructor(private readonly tenantContext: TenantContext) {}

  getTenantId(): string {
    return this.tenantContext.getTenantId() ?? 'public';
  }
}
