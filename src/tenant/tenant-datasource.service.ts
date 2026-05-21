import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { SERVICE_CATEGORY_DATA } from '../database/constants/service-category-data';
import { ALL_ENTITIES } from '../database/entities';
import { RoleEntity } from '../database/entities/role.entity';
import { ServiceCategoryEntity } from '../database/entities/service-category.entity';
import { RoleName } from '../database/enums';

@Injectable()
export class TenantDataSourceService implements OnModuleDestroy {
  private readonly logger = new Logger(TenantDataSourceService.name);

  private readonly dataSources = new Map<string, DataSource>();
  private readonly pending = new Map<string, Promise<DataSource>>();

  private readonly databaseUrl: string;

  private readonly TENANT_ID_PATTERN = /^[a-z0-9_-]+$/;

  constructor(private readonly configService: ConfigService) {
    this.databaseUrl =
      this.configService.get<string>('database.url') ||
      this.configService.get<string>('DATABASE_URL') ||
      '';

    if (!this.databaseUrl) {
      throw new Error('DATABASE_URL no está configurada');
    }
  }

  private validateTenantId(tenantId: string): void {
    if (!tenantId || !this.TENANT_ID_PATTERN.test(tenantId)) {
      throw new BadRequestException(
        'Tenant ID inválido: solo minúsculas, números, "_" y "-"',
      );
    }
  }

  async getDataSource(tenantId: string): Promise<DataSource> {
    this.validateTenantId(tenantId);
    const schema = tenantId === 'public' ? 'public' : tenantId;
    return this.getOrCreateDataSource(tenantId, schema);
  }

  private async getOrCreateDataSource(
    tenantId: string,
    schema: string,
  ): Promise<DataSource> {
    const cached = this.dataSources.get(tenantId);
    if (cached?.isInitialized) {
      return cached;
    }

    const pending = this.pending.get(tenantId);
    if (pending) {
      return pending;
    }

    const task = this.createDataSource(schema);
    this.pending.set(tenantId, task);

    try {
      const ds = await task;
      this.dataSources.set(tenantId, ds);
      this.logger.log(`DataSource ready for schema: ${schema}`);
      return ds;
    } finally {
      this.pending.delete(tenantId);
    }
  }

  private async createDataSource(schema: string): Promise<DataSource> {
    await this.ensureSchemaExists(schema);

    const ds = new DataSource({
      type: 'postgres',
      url: this.databaseUrl,
      schema,
      entities: ALL_ENTITIES,
      synchronize: true,
    });

    await ds.initialize();

    await this.seedRoles(ds);
    await this.seedServiceCategories(ds);

    return ds;
  }

  private async seedServiceCategories(ds: DataSource): Promise<void> {
    const categoryRepo = ds.getRepository(ServiceCategoryEntity);
    for (const data of SERVICE_CATEGORY_DATA) {
      const exists = await categoryRepo.findOne({ where: { slug: data.slug } });
      if (!exists) {
        await categoryRepo.save(categoryRepo.create(data));
        this.logger.log(`Seeded service category: ${data.slug}`);
      } else if (
        exists.basePrice !== data.basePrice ||
        exists.pricePerKm !== data.pricePerKm ||
        exists.pricePerHour !== data.pricePerHour
      ) {
        await categoryRepo.update(exists.id, {
          basePrice: data.basePrice,
          pricePerKm: data.pricePerKm,
          pricePerHour: data.pricePerHour,
        });
        this.logger.log(`Updated pricing for service category: ${data.slug}`);
      }
    }
  }

  private async seedRoles(ds: DataSource): Promise<void> {
    const roleRepo = ds.getRepository(RoleEntity);
    for (const name of Object.values(RoleName)) {
      const exists = await roleRepo.findOne({ where: { name } });
      if (!exists) {
        await roleRepo.save(roleRepo.create({ name }));
        this.logger.log(`Seeded role: ${name}`);
      }
    }
  }

  private async ensureSchemaExists(schema: string): Promise<void> {
    const tempDs = new DataSource({
      type: 'postgres',
      url: this.databaseUrl,
    });

    try {
      await tempDs.initialize();
      await tempDs.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
      this.logger.log(`Schema "${schema}" created/verified`);
    } catch (error) {
      this.logger.error(
        `Failed to ensure schema "${schema}": ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    } finally {
      if (tempDs.isInitialized) {
        await tempDs.destroy();
      }
    }
  }

  async onModuleDestroy() {
    await Promise.all(
      Array.from(this.dataSources.values()).map((ds) =>
        ds.isInitialized ? ds.destroy() : Promise.resolve(),
      ),
    );
    this.dataSources.clear();
  }
}
