import { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';
import { CacheHelper } from '../cache.helper';

function buildMockCache(): jest.Mocked<Pick<Cache, 'get' | 'set' | 'del'>> {
  return {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };
}

describe('CacheHelper', () => {
  let helper: CacheHelper;
  let mockCache: ReturnType<typeof buildMockCache>;
  let mockConfigService: jest.Mocked<Pick<ConfigService, 'get'>>;

  const cacheConfig = {
    ttl: 300,
    ttls: {
      provider_rating: 14400,
      geocoding: 86400,
      user_profile: 1800,
      payment_methods: 3600,
      available_technicians: 900,
      otp: 600,
    },
  };

  beforeEach(() => {
    mockCache = buildMockCache();
    mockConfigService = { get: jest.fn().mockReturnValue(cacheConfig) };
    helper = new CacheHelper(
      mockCache as unknown as Cache,
      mockConfigService as unknown as ConfigService,
    );
  });

  describe('getTtl', () => {
    it('should return the specific TTL for provider_rating', () => {
      const ttl = helper.getTtl('provider_rating');
      expect(ttl).toBe(14400);
    });

    it('should return the specific TTL for geocoding', () => {
      const ttl = helper.getTtl('geocoding');
      expect(ttl).toBe(86400);
    });

    it('should return the specific TTL for otp', () => {
      const ttl = helper.getTtl('otp');
      expect(ttl).toBe(600);
    });

    it('should fall back to default ttl when specific type not found', () => {
      mockConfigService.get.mockReturnValue({ ttl: 300, ttls: {} });
      const ttl = helper.getTtl('user_profile');
      expect(ttl).toBe(300);
    });
  });

  describe('generateKey', () => {
    it('should generate a colon-separated key', () => {
      const key = helper.generateKey(
        'provider',
        'bogota',
        'rating',
        'user-123',
      );
      expect(key).toBe('provider:bogota:rating:user-123');
    });

    it('should produce different keys for different tenants', () => {
      const key1 = helper.generateKey(
        'provider',
        'bogota',
        'rating',
        'user-001',
      );
      const key2 = helper.generateKey(
        'provider',
        'medellin',
        'rating',
        'user-001',
      );
      expect(key1).not.toBe(key2);
    });
  });

  describe('getOrCompute', () => {
    it('should return cached value on cache hit', async () => {
      mockCache.get.mockResolvedValue(42);
      const computeFn = jest.fn();

      const result = await helper.getOrCompute('key', 300, computeFn);

      expect(result).toBe(42);
      expect(computeFn).not.toHaveBeenCalled();
      expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('should compute and cache value on cache miss (null)', async () => {
      mockCache.get.mockResolvedValue(null);
      mockCache.set.mockResolvedValue(undefined);
      const computeFn = jest.fn().mockResolvedValue('computed-value');

      const result = await helper.getOrCompute('key', 300, computeFn);

      expect(result).toBe('computed-value');
      expect(computeFn).toHaveBeenCalledTimes(1);
      expect(mockCache.set).toHaveBeenCalledWith('key', 'computed-value', 300);
    });

    it('should compute and cache value on cache miss (undefined)', async () => {
      mockCache.get.mockResolvedValue(undefined);
      mockCache.set.mockResolvedValue(undefined);
      const computeFn = jest.fn().mockResolvedValue({ rating: 4.5 });

      const result = await helper.getOrCompute('key', 600, computeFn);

      expect(result).toEqual({ rating: 4.5 });
      expect(mockCache.set).toHaveBeenCalledWith('key', { rating: 4.5 }, 600);
    });
  });

  describe('invalidateByPrefix', () => {
    it('should not throw even though no-op', async () => {
      await expect(
        helper.invalidateByPrefix('any-prefix'),
      ).resolves.toBeUndefined();
    });
  });
});
