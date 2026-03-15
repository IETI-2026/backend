import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { TenantDataSourceService } from '../tenant-datasource.service';

jest.mock('typeorm', () => {
  const actual = jest.requireActual('typeorm');
  return {
    ...actual,
    DataSource: jest.fn(),
  };
});

const MockedDataSource = DataSource as jest.MockedClass<typeof DataSource>;

describe('TenantDataSourceService', () => {
  let service: TenantDataSourceService;
  let configService: jest.Mocked<ConfigService>;
  let mockDs: jest.Mocked<DataSource>;

  beforeEach(() => {
    mockDs = {
      isInitialized: true,
      initialize: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue(undefined),
      getRepository: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockReturnValue({}),
        save: jest.fn().mockResolvedValue({}),
      }),
    } as any;

    MockedDataSource.mockImplementation(() => mockDs);

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'database.url' || key === 'DATABASE_URL') {
          return 'postgresql://localhost/test';
        }
        return undefined;
      }),
    } as any;

    service = new TenantDataSourceService(configService);
  });

  afterEach(() => { jest.clearAllMocks(); });

  describe('constructor', () => {
    it('throws when DATABASE_URL is not configured', () => {
      const badConfig = { get: jest.fn().mockReturnValue(undefined) } as any;
      expect(() => new TenantDataSourceService(badConfig)).toThrow(
        'DATABASE_URL no está configurada'
      );
    });

    it('reads url from database.url config key', () => {
      const cfg = {
        get: jest.fn((key: string) => {
          if (key === 'database.url') return 'postgresql://localhost/cfg';
          return undefined;
        }),
      } as any;
      expect(() => new TenantDataSourceService(cfg)).not.toThrow();
    });

    it('reads url from DATABASE_URL fallback', () => {
      const cfg = {
        get: jest.fn((key: string) => {
          if (key === 'DATABASE_URL') return 'postgresql://localhost/env';
          return undefined;
        }),
      } as any;
      expect(() => new TenantDataSourceService(cfg)).not.toThrow();
    });
  });

  describe('getDataSource()', () => {
    it('throws BadRequestException for empty tenant ID', async () => {
      await expect(service.getDataSource('')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for tenant ID with invalid chars', async () => {
      await expect(service.getDataSource('Invalid Tenant!')).rejects.toThrow(BadRequestException);
    });

    it('creates and initializes a DataSource for valid tenant', async () => {
      const ds = await service.getDataSource('acme');
      expect(ds).toBe(mockDs);
      expect(mockDs.initialize).toHaveBeenCalled();
    });

    it('returns cached DataSource on second call', async () => {
      await service.getDataSource('acme');
      MockedDataSource.mockClear();
      mockDs.initialize.mockClear();
      const ds2 = await service.getDataSource('acme');
      expect(ds2).toBe(mockDs);
      expect(mockDs.initialize).not.toHaveBeenCalled();
    });

    it('uses schema=public for public tenant', async () => {
      await service.getDataSource('public');
      const calls = MockedDataSource.mock.calls.map((c) => c[0]);
      expect(calls.some((cfg) => (cfg as any).schema === 'public')).toBe(true);
    });

    it('uses tenant ID as schema name for non-public tenant', async () => {
      await service.getDataSource('mytenant');
      const calls = MockedDataSource.mock.calls.map((c) => c[0]);
      expect(calls.some((cfg) => (cfg as any).schema === 'mytenant')).toBe(true);
    });
  });

  describe('onModuleDestroy()', () => {
    it('destroys all initialized data sources', async () => {
      await service.getDataSource('tenant1');
      await service.onModuleDestroy();
      expect(mockDs.destroy).toHaveBeenCalled();
    });

    it('skips destroy for uninitialized data sources', async () => {
      mockDs.isInitialized = false;
      await service.getDataSource('tenant2');
      await service.onModuleDestroy();
      expect(mockDs.destroy).not.toHaveBeenCalled();
    });

    it('completes without error when no data sources exist', async () => {
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });
  });
});
