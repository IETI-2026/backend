/**
 * Script para seed multi-tenant
 *
 * Uso:
 *   TENANT_ID=acme npm run seed:tenant
 *   TENANT_ID=globex npm run seed:tenant
 */

import { PrismaClient } from '@prisma/client';

const tenantId = process.env.TENANT_ID || 'public';
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL no está definida');
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl.includes('?')
        ? `${databaseUrl}&schema=${tenantId}`
        : `${databaseUrl}?schema=${tenantId}`,
    },
  },
});

async function main() {
  // Crear usuarios de ejemplo
  const admin = await prisma.user.upsert({
    where: { email: `admin@${tenantId}.com` },
    update: {},
    create: {
      email: `admin@${tenantId}.com`,
      passwordHash: '$2b$10$YourHashedPasswordHere', // Usar hash real en producción
      fullName: `Admin ${tenantId}`,
      phoneNumber: `+123456${tenantId}`,
      documentId: `DOC-${tenantId}-001`,
      status: 'ACTIVE',
    },
  });

  // Puedes agregar más seeds aquí según tus necesidades
  // Por ejemplo: crear roles, categorías, etc.
}

main()
  .catch((e) => {
    console.error('❌ Error durante el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
