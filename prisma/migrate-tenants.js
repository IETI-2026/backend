#!/usr/bin/env node
/**
 * Script para provisionar esquemas y aplicar migraciones de Prisma a múltiples tenants
 *
 * Este script debe ejecutarse fuera del request path (en deploy time o como tarea admin)
 * para crear y migrar esquemas de tenants.
 *
 * Uso:
 *   node prisma/migrate-tenants.js
 *
 * Configura los tenants en la variable TENANTS
 */
require("dotenv").config();
const { execSync } = require("node:child_process");
const { Client } = require("pg");

// Lista de tenants (esquemas) a provisionar y migrar
// Ejemplo: TENANTS=public,agente,medellin node prisma/migrate-tenants.js
const TENANTS = (process.env.TENANTS || "public")
  .split(",")
  .map((tenant) => tenant.trim())
  .filter((tenant) => tenant.length > 0);

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ ERROR: DATABASE_URL no está definida");
  process.exit(1);
}

async function createSchemaIfNotExists(schemaName) {
  const client = new Client({
    connectionString: DATABASE_URL,
  });

  try {
    await client.connect();
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    console.log(`📁 Esquema "${schemaName}" creado/verificado`);
  } catch (error) {
    console.error(`❌ Error creando esquema ${schemaName}:`, error.message);
    throw error;
  } finally {
    await client.end();
  }
}

async function main() {
  for (const tenant of TENANTS) {
    try {
      console.log(`\n🔄 Provisionando tenant: ${tenant}`);

      // 1. Crear el esquema si no existe
      await createSchemaIfNotExists(tenant);

      // 2. Aplicar migraciones
      const tenantUrl = DATABASE_URL.includes("?")
        ? `${DATABASE_URL}&schema=${tenant}`
        : `${DATABASE_URL}?schema=${tenant}`;

      console.log(`🔄 Aplicando migraciones para: ${tenant}`);
      execSync("npx prisma migrate deploy", {
        stdio: "inherit",
        env: {
          ...process.env,
          DATABASE_URL: tenantUrl,
        },
      });

      console.log(`✅ Tenant "${tenant}" provisionado exitosamente`);
    } catch (_error) {
      console.error(`❌ Error provisionando tenant ${tenant}`);
      process.exit(1);
    }
  }

  console.log("\n✅ Todos los tenants provisionados exitosamente");
}

main();
