import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
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
          fullName: 'Acme User',
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
          fullName: 'Globex User',
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
          fullName: 'Public User',
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
          fullName: 'Secure User',
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
          fullName: 'Subdomain User',
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
          fullName: 'Priority User',
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
});
