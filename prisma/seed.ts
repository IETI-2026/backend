import { PrismaClient, RoleName } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const baseRoles: RoleName[] = [
    'USER',
    'PROVIDER',
    'ADMIN',
    'MODERATOR',
  ] as RoleName[];

  for (const r of baseRoles) {
    await prisma.role.upsert({
      where: { name: r },
      update: {},
      create: { name: r, description: `${r} role` },
    });
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminFullName = process.env.ADMIN_FULLNAME ?? 'Platform Admin';
  const adminPhone = process.env.ADMIN_PHONE ?? undefined;

  if (adminEmail && adminPassword) {
    console.log(
      'ADMIN credentials provided, creating/updating master admin...',
    );

    const passwordHash = await bcrypt.hash(adminPassword, 10);

    const user = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        fullName: adminFullName,
        passwordHash,
        emailVerified: true,
        phoneNumber: adminPhone,
        primaryRole: 'ADMIN',
      },
      create: {
        email: adminEmail,
        passwordHash,
        fullName: adminFullName,
        emailVerified: true,
        phoneNumber: adminPhone,
        primaryRole: 'ADMIN',
      },
    });

    const adminRole = await prisma.role.findUnique({
      where: { name: 'ADMIN' },
    });
    if (!adminRole) throw new Error('ADMIN role not found after upsert');

    const existing = await prisma.userRole
      .findUnique({
        where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
      })
      .catch(() => null);
    if (!existing) {
      await prisma.$transaction(async (tx) => {
        await tx.userRole.create({
          data: { userId: user.id, roleId: adminRole.id, assignedBy: user.id },
        });
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'ADMIN_CREATED',
            resource: 'user',
            resourceId: user.id,
            newValues: { role: 'ADMIN' },
          },
        });
      });
      console.log(`Assigned ADMIN role to ${adminEmail}`);
    } else {
      console.log('Admin role already assigned to the provided email');
    }
  } else {
    console.log(
      'No ADMIN_EMAIL/ADMIN_PASSWORD provided — roles created, no admin user seeded.',
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
