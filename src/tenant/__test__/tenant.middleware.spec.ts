import { BadRequestException } from '@nestjs/common';
import { TenantMiddleware } from '../tenant.middleware';
import { TenantContext } from '../tenant-context';
import { TenantDataSourceService } from '../tenant-datasource.service';

describe('TenantMiddleware', () => {
  let middleware: TenantMiddleware;
  let tenantContext: jest.Mocked<TenantContext>;
  let tenantDataSourceService: jest.Mocked<TenantDataSourceService>;

  beforeEach(() => {
    tenantContext = {
      run: jest.fn((tenantId, cb) => cb()),
      getTenantId: jest.fn(),
    } as any;

    tenantDataSourceService = {
      getDataSource: jest.fn().mockResolvedValue({}),
    } as any;

    middleware = new TenantMiddleware(tenantContext, tenantDataSourceService);
  });

  const makeReq = (headerValue?: string) => ({
    header: jest.fn((name: string) => {
      if (name === 'X-Tenant-ID') return headerValue;
      return undefined;
    }),
  });

  describe('use() tenant resolution', () => {
    it('resolves tenant from X-Tenant-ID header', (done) => {
      const req = makeReq('acme');
      const next = jest.fn(() => done());
      middleware.use(req as any, {} as any, next);
      expect(tenantContext.run).toHaveBeenCalledWith(
        'acme',
        expect.any(Function),
      );
    });

    it('normalises tenant to lower-case', (done) => {
      const req = makeReq('ACME');
      const next = jest.fn(() => done());
      middleware.use(req as any, {} as any, next);
      expect(tenantContext.run).toHaveBeenCalledWith(
        'acme',
        expect.any(Function),
      );
    });

    it('trims whitespace from the header value', (done) => {
      const req = makeReq('  acme  ');
      const next = jest.fn(() => done());
      middleware.use(req as any, {} as any, next);
      expect(tenantContext.run).toHaveBeenCalledWith(
        'acme',
        expect.any(Function),
      );
    });

    it('falls back to public when header is absent', (done) => {
      const req = makeReq(undefined);
      const next = jest.fn(() => done());
      middleware.use(req as any, {} as any, next);
      expect(tenantContext.run).toHaveBeenCalledWith(
        'public',
        expect.any(Function),
      );
    });

    it('falls back to public when header is empty string', (done) => {
      const req = makeReq('');
      const next = jest.fn(() => done());
      middleware.use(req as any, {} as any, next);
      expect(tenantContext.run).toHaveBeenCalledWith(
        'public',
        expect.any(Function),
      );
    });
  });

  describe('use() invalid tenant ID', () => {
    it('calls next(error) with BadRequestException for invalid chars', () => {
      const req = makeReq('INVALID TENANT!');
      const next = jest.fn();
      middleware.use(req as any, {} as any, next);
      expect(next).toHaveBeenCalledWith(expect.any(BadRequestException));
    });

    it('does NOT call tenantContext.run for invalid tenant', () => {
      const req = makeReq('bad tenant!');
      const next = jest.fn();
      middleware.use(req as any, {} as any, next);
      expect(tenantContext.run).not.toHaveBeenCalled();
    });
  });

  describe('use() data source errors', () => {
    it('calls next(error) when getDataSource rejects', (done) => {
      const dbError = new Error('DB connection failed');
      tenantDataSourceService.getDataSource.mockRejectedValue(dbError);
      const req = makeReq('acme');
      const next = jest.fn((err?: unknown) => {
        if (err) {
          expect(err).toBe(dbError);
          done();
        }
      });
      middleware.use(req as any, {} as any, next);
    });

    it('calls getDataSource with the resolved tenant ID', (done) => {
      const req = makeReq('mytenant');
      const next = jest.fn(() => done());
      middleware.use(req as any, {} as any, next);
      setTimeout(() => {
        expect(tenantDataSourceService.getDataSource).toHaveBeenCalledWith(
          'mytenant',
        );
      }, 0);
    });
  });
});
