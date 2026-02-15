import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

@Injectable()
export class TenantPrismaService implements OnModuleDestroy {
  private readonly logger = new Logger(TenantPrismaService.name);
  private readonly clients = new Map<string, PrismaClient>();
  private readonly pending = new Map<string, Promise<PrismaClient>>();
  private readonly databaseUrl: string;
  private readonly initializedSchemas = new Set<string>();

  constructor(private readonly configService: ConfigService) {
    this.databaseUrl = this.configService.get<string>('DATABASE_URL') || '';
    // Marcar 'public' como ya inicializado
    this.initializedSchemas.add('public');
  }

  async getClient(tenantId: string): Promise<PrismaClient> {
    // Para el tenant público, usa el esquema 'public'
    if (tenantId === 'public') {
      return this.getOrCreateClient(tenantId, 'public');
    }

    // Para otros tenants, asegura que el esquema exista con tablas
    await this.ensureSchemaWithTables(tenantId);
    return this.getOrCreateClient(tenantId, tenantId);
  }

  private async getOrCreateClient(
    tenantId: string,
    schema: string,
  ): Promise<PrismaClient> {
    // Si ya existe el cliente, retornarlo
    if (this.clients.has(tenantId)) {
      return this.clients.get(tenantId)!;
    }

    // Si ya hay una operación pendiente para este tenant, esperarla
    const existing = this.pending.get(tenantId);
    if (existing) {
      return existing;
    }

    // Crear nuevo cliente
    const task = this.createClient(schema);
    this.pending.set(tenantId, task);

    try {
      const client = await task;
      this.clients.set(tenantId, client);
      return client;
    } finally {
      this.pending.delete(tenantId);
    }
  }

  private async createClient(schema: string): Promise<PrismaClient> {
    const url = `${this.databaseUrl}&schema=${schema}`;

    const client = new PrismaClient({
      datasources: {
        db: {
          url,
        },
      },
    });

    await client.$connect();
    return client;
  }

  private async ensureSchemaWithTables(tenantId: string): Promise<void> {
    // Si ya está inicializado, no hacer nada
    if (this.initializedSchemas.has(tenantId)) {
      return;
    }

    try {
      // 1. Crear el esquema si no existe
      const tempClient = new PrismaClient();
      try {
        await tempClient.$executeRawUnsafe(
          `CREATE SCHEMA IF NOT EXISTS "${tenantId}"`,
        );
        this.logger.log(`📁 Esquema "${tenantId}" creado/verificado`);
      } finally {
        await tempClient.$disconnect();
      }

      // 2. Sincronizar las tablas usando prisma db push
      this.logger.log(`🔄 Sincronizando tablas para esquema: ${tenantId}`);

      const schemaUrl = `${this.databaseUrl}&schema=${tenantId}`;

      try {
        execSync('npx prisma db push --skip-generate --accept-data-loss', {
          stdio: 'pipe',
          env: {
            ...process.env,
            DATABASE_URL: schemaUrl,
          },
          cwd: process.cwd(),
        });

        this.logger.log(`✅ Tablas sincronizadas para tenant: ${tenantId}`);
        this.initializedSchemas.add(tenantId);
      } catch (error) {
        this.logger.error(
          `❌ Error al sincronizar tablas para tenant ${tenantId}:`,
          error instanceof Error ? error.message : error,
        );
        throw new Error(
          `No se pudo inicializar el esquema para el tenant ${tenantId}`,
        );
      }
    } catch (error) {
      this.logger.error(`❌ Error al crear esquema ${tenantId}:`, error);
      throw error;
    }
  }

  async onModuleDestroy() {
    // Desconectar todos los clientes al destruir el módulo
    await Promise.all(
      Array.from(this.clients.values()).map((client) => client.$disconnect()),
    );
    this.clients.clear();
  }
}
