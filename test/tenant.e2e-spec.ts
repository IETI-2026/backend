import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Multi-Tenant E2E Tests', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Tenant Isolation', () => {
    it('should isolate users by tenant using X-Tenant-ID header', async () => {
      // Crear usuario en tenant "acme"
      const acmeUser = await request(app.getHttpServer())
        .post('/users')
        .set('X-Tenant-ID', 'acme')
        .send({
          email: 'user@acme.com',
          password: 'password123',
          name: 'Acme',
          lastName: 'User',
          phoneNumber: '+1234567001',
          documentId: 'DOC-ACME-001',
        })
        .expect(201);

      // Crear usuario en tenant "globex"
      const globexUser = await request(app.getHttpServer())
        .post('/users')
        .set('X-Tenant-ID', 'globex')
        .send({
          email: 'user@globex.com',
          password: 'password123',
          name: 'Globex',
          lastName: 'User',
          phoneNumber: '+1234567002',
          documentId: 'DOC-GLOBEX-001',
        })
        .expect(201);

      // Verificar que los usuarios están en diferentes tenants
      expect(acmeUser.body.id).toBeDefined();
      expect(globexUser.body.id).toBeDefined();

      // Obtener usuarios de tenant "acme"
      const acmeUsers = await request(app.getHttpServer())
        .get('/users')
        .set('X-Tenant-ID', 'acme')
        .expect(200);

      // Obtener usuarios de tenant "globex"
      const globexUsers = await request(app.getHttpServer())
        .get('/users')
        .set('X-Tenant-ID', 'globex')
        .expect(200);

      // Verificar aislamiento: cada tenant solo ve sus propios usuarios
      const acmeEmails = acmeUsers.body.data.map((u: any) => u.email);
      const globexEmails = globexUsers.body.data.map((u: any) => u.email);

      expect(acmeEmails).toContain('user@acme.com');
      expect(acmeEmails).not.toContain('user@globex.com');

      expect(globexEmails).toContain('user@globex.com');
      expect(globexEmails).not.toContain('user@acme.com');
    });

    it('should use public tenant when no tenant header is provided', async () => {
      const response = await request(app.getHttpServer())
        .post('/users')
        .send({
          email: 'public@example.com',
          password: 'password123',
          name: 'Public',
          lastName: 'User',
          phoneNumber: '+1234567003',
          documentId: 'DOC-PUBLIC-001',
        })
        .expect(201);

      expect(response.body.id).toBeDefined();

      // Verificar que está en el tenant público
      const publicUsers = await request(app.getHttpServer())
        .get('/users')
        .expect(200);

      const emails = publicUsers.body.users.map((u: any) => u.email);
      expect(emails).toContain('public@example.com');
    });

    it('should not allow cross-tenant data access', async () => {
      // Crear usuario en tenant "acme"
      const acmeUser = await request(app.getHttpServer())
        .post('/users')
        .set('X-Tenant-ID', 'acme')
        .send({
          email: 'secure@acme.com',
          password: 'password123',
          name: 'Secure',
          lastName: 'User',
          phoneNumber: '+1234567004',
          documentId: 'DOC-ACME-SECURE',
        })
        .expect(201);

      const acmeUserId = acmeUser.body.id;

      // Intentar acceder al usuario desde otro tenant
      const response = await request(app.getHttpServer())
        .get(`/users/${acmeUserId}`)
        .set('X-Tenant-ID', 'globex')
        .expect(404); // No debe encontrarlo

      expect(response.body.message).toContain('not found');
    });
  });

  describe('Subdomain Resolution', () => {
    it('should resolve tenant from subdomain', async () => {
      const user = await request(app.getHttpServer())
        .post('/users')
        .set('Host', 'acme.localhost:3000')
        .send({
          email: 'subdomain@acme.com',
          password: 'password123',
          name: 'Subdomain',
          lastName: 'User',
          phoneNumber: '+1234567005',
          documentId: 'DOC-SUBDOMAIN-001',
        })
        .expect(201);

      expect(user.body.id).toBeDefined();

      // Verificar que está en el tenant "acme"
      const acmeUsers = await request(app.getHttpServer())
        .get('/users')
        .set('X-Tenant-ID', 'acme')
        .expect(200);

      const emails = acmeUsers.body.data.map((u: any) => u.email);
      expect(emails).toContain('subdomain@acme.com');
    });

    it('should prioritize X-Tenant-ID header over subdomain', async () => {
      const user = await request(app.getHttpServer())
        .post('/users')
        .set('Host', 'acme.localhost:3000')
        .set('X-Tenant-ID', 'globex') // Header tiene prioridad
        .send({
          email: 'priority@test.com',
          password: 'password123',
          name: 'Priority',
          lastName: 'User',
          phoneNumber: '+1234567006',
          documentId: 'DOC-PRIORITY-001',
        })
        .expect(201);

      // Verificar que está en tenant "globex" (no "acme")
      const globexUsers = await request(app.getHttpServer())
        .get('/users')
        .set('X-Tenant-ID', 'globex')
        .expect(200);

      const globexEmails = globexUsers.body.data.map((u: any) => u.email);
      expect(globexEmails).toContain('priority@test.com');

      // No debe estar en "acme"
      const acmeUsers = await request(app.getHttpServer())
        .get('/users')
        .set('X-Tenant-ID', 'acme')
        .expect(200);

      const acmeEmails = acmeUsers.body.data.map((u: any) => u.email);
      expect(acmeEmails).not.toContain('priority@test.com');
    });
  });

  describe('Tenant ID Validation (SQL Injection Prevention)', () => {
    it('should reject tenant IDs with SQL injection attempts', async () => {
      const maliciousTenantIds = [
        '"; DROP SCHEMA public; --',
        "' OR '1'='1",
        'tenant"; DROP TABLE users; --',
        '../../../etc/passwd',
        'tenant; DELETE FROM users;',
      ];

      for (const tenantId of maliciousTenantIds) {
        const response = await request(app.getHttpServer())
          .get('/users')
          .set('X-Tenant-ID', tenantId)
          .expect(400);

        expect(response.body.message).toContain('Invalid tenant ID');
      }
    });

    it('should reject tenant IDs with uppercase letters', async () => {
      const response = await request(app.getHttpServer())
        .get('/users')
        .set('X-Tenant-ID', 'InvalidTenant')
        .expect(400);

      expect(response.body.message).toContain('Invalid tenant ID');
    });

    it('should reject tenant IDs with special characters', async () => {
      const invalidTenantIds = [
        'tenant@company',
        'tenant.company',
        'tenant/company',
        'tenant\\company',
        'tenant company',
        'tenant!company',
        'tenant#company',
      ];

      for (const tenantId of invalidTenantIds) {
        const response = await request(app.getHttpServer())
          .get('/users')
          .set('X-Tenant-ID', tenantId)
          .expect(400);

        expect(response.body.message).toContain('Invalid tenant ID');
      }
    });

    it('should accept valid tenant IDs with lowercase, numbers, underscores, and hyphens', async () => {
      const validTenantIds = [
        'acme',
        'acme123',
        'acme_company',
        'acme-company',
        'company_123',
        'test-tenant-1',
        'tenant_with_multiple_words',
      ];

      for (const tenantId of validTenantIds) {
        // Should not throw an error - we just check it doesn't return 400
        const response = await request(app.getHttpServer())
          .get('/users')
          .set('X-Tenant-ID', tenantId);

        // Should be 200 or 404, but not 400 (bad request)
        expect(response.status).not.toBe(400);
      }
    });
  });
});
