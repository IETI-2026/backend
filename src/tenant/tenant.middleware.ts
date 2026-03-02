import {
  BadRequestException,
  Injectable,
  NestMiddleware,
} from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { TenantContext } from "./tenant-context";
import { TenantDataSourceService } from "./tenant-datasource.service";

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly TENANT_ID_PATTERN = /^[a-z0-9_-]+$/;

  constructor(
    private readonly tenantContext: TenantContext,
    private readonly tenantDataSourceService: TenantDataSourceService,
  ) {}

  use(req: Request, _res: Response, next: NextFunction) {
    let tenant: string;

    try {
      tenant = this.resolveTenant(req);
    } catch (error) {
      return next(error);
    }

    this.tenantContext.run(tenant, () => {
      void this.tenantDataSourceService
        .getDataSource(tenant)
        .then(() => {
          next();
        })
        .catch((error) => {
          next(error);
        });
    });
  }

  private resolveTenant(req: Request): string {
    // Solo se resuelve por header X-Tenant-ID
    const headerTenant = req.header("X-Tenant-ID");
    if (headerTenant) {
      return this.normalizeTenant(headerTenant);
    }

    // Fallback al tenant público
    return "public";
  }

  private normalizeTenant(value?: string | null): string {
    const tenant = value?.trim().toLowerCase() ?? "";
    if (!tenant) {
      return "public";
    }

    if (!this.TENANT_ID_PATTERN.test(tenant)) {
      throw new BadRequestException(
        `Invalid tenant ID: must contain only lowercase letters, numbers, underscores, and hyphens`,
      );
    }

    return tenant;
  }
}
