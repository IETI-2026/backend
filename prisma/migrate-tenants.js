#!/usr/bin/env node
/**
 * Script para aplicar migraciones de Prisma a múltiples tenants (esquemas)
 *
 * Uso:
 *   node prisma/migrate-tenants.js
 *
 * Configura los tenants en la variable TENANTS
 */

const { execSync } = require('child_process');
const path = require('path');

// Lista de tenants (esquemas) a migrar
const TENANTS = ['public', 'acme', 'globex', 'initech'];

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL no está definida');
  process.exit(1);
}

for (const tenant of TENANTS) {
  try {
    const tenantUrl = DATABASE_URL.includes('?')
      ? `${DATABASE_URL}&schema=${tenant}`
      : `${DATABASE_URL}?schema=${tenant}`;

    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: tenantUrl,
      },
    });
  } catch (error) {
    process.exit(1);
  }
}
