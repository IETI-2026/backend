import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class TenantPrismaService implements OnModuleDestroy {
  private readonly logger = new Logger(TenantPrismaService.name);
  private readonly clients = new Map<string, PrismaClient>();
  private readonly pending = new Map<string, Promise<PrismaClient>>();
  private readonly databaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.databaseUrl = this.configService.get<string>('DATABASE_URL') || '';
  }

  async getClient(tenantId: string): Promise<PrismaClient> {
    // Para el tenant público, usa el esquema 'public'
    if (tenantId === 'public') {
      return this.getOrCreateClient(tenantId, 'public');
    }

    // Para otros tenants, simplemente crear el cliente
    // El esquema debe existir previamente (provisionado fuera del request path)
    return this.getOrCreateClient(tenantId, tenantId);
  }

  private async getOrCreateClient(
    tenantId: string,
    schema: string,
  ): Promise<PrismaClient> {
    // Si ya existe el cliente, retornarlo
    const existingClient = this.clients.get(tenantId);
    if (existingClient) {
      return existingClient;
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
    // Verificar que el esquema existe antes de crear el cliente
    if (schema !== 'public') {
      const schemaExists = await this.verifySchemaExists(schema);
      if (!schemaExists) {
        throw new Error(
          `Schema "${schema}" no existe. Los esquemas deben ser provisionados fuera del request path usando migrate-tenants.js o prisma migrate deploy.`,
        );
      }
    }

    const url = this.databaseUrl.includes('?')
      ? `${this.databaseUrl}&schema=${schema}`
      : `${this.databaseUrl}?schema=${schema}`;

    const client = new PrismaClient({
      datasources: {
        db: {
          url,
        },
      },
    });

    try {
      await client.$connect();
      this.logger.log(`✅ Cliente Prisma conectado para esquema: ${schema}`);
      return client;
    } catch (error) {
      await client.$disconnect();
      this.logger.error(`❌ Error conectando a esquema ${schema}:`, error);
      throw new Error(
        `No se pudo conectar al esquema "${schema}". Verifique que el esquema existe y las tablas están migradas.`,
      );
    }
  }

  private async verifySchemaExists(schema: string): Promise<boolean> {
    const tempClient = new PrismaClient();
    try {
      const result = await tempClient.$queryRaw<{ exists: boolean }[]>`
        SELECT EXISTS(
          SELECT 1 FROM information_schema.schemata 
          WHERE schema_name = ${schema}
        ) as exists
      `;
      return result[0]?.exists || false;
    } catch (error) {
      this.logger.error(`Error verificando esquema ${schema}:`, error);
      return false;
    } finally {
      await tempClient.$disconnect();
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
