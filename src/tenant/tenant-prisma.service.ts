import { execSync } from 'node:child_process';
import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class TenantPrismaService implements OnModuleDestroy {
  private readonly logger = new Logger(TenantPrismaService.name);

  private readonly clients = new Map<string, PrismaClient>();
  private readonly pending = new Map<string, Promise<PrismaClient>>();

  private readonly databaseUrl: string;

  // Solo permite ids seguros
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

  async getClient(tenantId: string): Promise<PrismaClient> {
    this.validateTenantId(tenantId);

    const schema = tenantId === 'public' ? 'public' : tenantId;
    return this.getOrCreateClient(tenantId, schema);
  }

  private async getOrCreateClient(
    tenantId: string,
    schema: string,
  ): Promise<PrismaClient> {
    const cached = this.clients.get(tenantId);
    if (cached) {
      return cached;
    }

    const pending = this.pending.get(tenantId);
    if (pending) {
      return pending;
    }

    const task = this.createClient(schema);
    this.pending.set(tenantId, task);

    try {
      const client = await task;
      this.clients.set(tenantId, client);
      this.logger.log(`Prisma client ready for schema: ${schema}`);
      return client;
    } finally {
      this.pending.delete(tenantId);
    }
  }

  private async createClient(schema: string): Promise<PrismaClient> {
    const exists = await this.verifySchemaExists(schema);
    if (!exists) {
      this.logger.log(
        `El esquema "${schema}" no existe. Creándolo automáticamente...`,
      );
      await this.provisionTenantSchema(schema);
    }

    const url = this.databaseUrl.includes('?')
      ? `${this.databaseUrl}&schema=${schema}`
      : `${this.databaseUrl}?schema=${schema}`;

    const client = new PrismaClient({
      datasources: { db: { url } },
    });

    await client.$connect();
    return client;
  }

  /**
   * Provisiona un nuevo tenant: crea el esquema y aplica migraciones
   */
  private async provisionTenantSchema(schema: string): Promise<void> {
    try {
      // 1. Crear el esquema en la base de datos
      await this.createSchema(schema);

      // 2. Aplicar migraciones de Prisma
      await this.applyMigrations(schema);

      this.logger.log(`Tenant "${schema}" provisioned successfully`);
    } catch (error) {
      this.logger.error(
        `Failed to provision tenant "${schema}": ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(
        `No se pudo provisionar el tenant "${schema}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Crea el esquema SQL si no existe
   */
  private async createSchema(schema: string): Promise<void> {
    const tempClient = new PrismaClient();

    try {
      await tempClient.$executeRawUnsafe(
        `CREATE SCHEMA IF NOT EXISTS "${schema}"`,
      );
      this.logger.log(`Schema "${schema}" created/verified`);
    } catch (error) {
      this.logger.error(
        `Failed to create schema "${schema}": ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    } finally {
      await tempClient.$disconnect();
    }
  }

  /**
   * Aplica las migraciones de Prisma al esquema del tenant
   */
  private async applyMigrations(schema: string): Promise<void> {
    const tenantUrl = this.databaseUrl.includes('?')
      ? `${this.databaseUrl}&schema=${schema}`
      : `${this.databaseUrl}?schema=${schema}`;

    try {
      this.logger.log(`Applying migrations for schema: ${schema}`);

      execSync('npx prisma migrate deploy', {
        stdio: 'inherit',
        env: {
          ...process.env,
          DATABASE_URL: tenantUrl,
        },
      });

      this.logger.log(`Migrations applied for schema: ${schema}`);
    } catch (error) {
      this.logger.error(
        `Failed to apply migrations for schema "${schema}": ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  private async verifySchemaExists(schema: string): Promise<boolean> {
    const tempClient = new PrismaClient();

    try {
      const result = await tempClient.$queryRaw<{ exists: boolean }[]>`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.schemata
          WHERE schema_name = ${schema}
        ) AS exists
      `;

      return result[0]?.exists ?? false;
    } catch (error) {
      this.logger.error(`Error verificando esquema ${schema}`, error);
      return false;
    } finally {
      await tempClient.$disconnect();
    }
  }

  async onModuleDestroy() {
    await Promise.all(
      Array.from(this.clients.values()).map((c) => c.$disconnect()),
    );
    this.clients.clear();
  }
}
