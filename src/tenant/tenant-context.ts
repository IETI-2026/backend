import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

@Injectable()
export class TenantContext {
  private readonly storage = new AsyncLocalStorage<{ tenantId: string }>();

  run(tenantId: string, callback: () => void) {
    this.storage.run({ tenantId }, callback);
  }

  getTenantId(): string | undefined {
    return this.storage.getStore()?.tenantId;
  }
}
