import {
  BadRequestException,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { TenantContext } from './tenant-context';
import { TenantPrismaService } from './tenant-prisma.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  // Regex pattern to validate tenant IDs: only lowercase alphanumeric, underscores, and hyphens
  private readonly TENANT_ID_PATTERN = /^[a-z0-9_-]+$/;

  constructor(
    private readonly tenantContext: TenantContext,
    private readonly tenantPrismaService: TenantPrismaService,
  ) {}

  use(req: Request, _res: Response, next: NextFunction) {
    let tenant: string;

    try {
      tenant = this.resolveTenant(req);
    } catch (error) {
      // Pass validation errors to Express error handler
      return next(error);
    }

    this.tenantContext.run(tenant, () => {
      // Inicializa el cliente Prisma para este tenant
      void this.tenantPrismaService
        .getClient(tenant)
        .then(() => {
          next();
        })
        .catch((error) => {
          next(error);
        });
    });
  }

  private resolveTenant(req: Request): string {
    // 1. Intentar obtener desde header X-Tenant-ID
    const headerTenant = req.header('X-Tenant-ID');
    if (headerTenant) {
      return this.normalizeTenant(headerTenant);
    }

    // 2. Intentar obtener desde subdomain
    const hostHeader = req.header('host') ?? req.hostname;
    if (hostHeader && !this.isIPAddress(hostHeader)) {
      const host = hostHeader.split(':')[0];
      if (host?.includes('.')) {
        const [subdomain] = host.split('.');
        return this.normalizeTenant(subdomain);
      }
    }

    // 3. Fallback al tenant público
    return 'public';
  }

  private isIPAddress(value: string): boolean {
    // Simple IP address detection - IPv4
    return /^\d+\.\d+\.\d+\.\d+/.test(value) || /^\[/.test(value); // IPv6
  }

  private normalizeTenant(value?: string | null): string {
    const tenant = value?.trim().toLowerCase() ?? '';
    if (!tenant) {
      return 'public';
    }

    // Validate tenant ID format to prevent SQL injection
    if (!this.TENANT_ID_PATTERN.test(tenant)) {
      throw new BadRequestException(
        `Invalid tenant ID: must contain only lowercase letters, numbers, underscores, and hyphens`,
      );
    }

    return tenant;
  }
}
