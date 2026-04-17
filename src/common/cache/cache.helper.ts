import { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';

/**
 * Helper service for cache operations with tenant-aware key generation
 */
export class CacheHelper {
  constructor(
    private readonly cache: Cache,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get cache TTL configuration
   */
  getTtl(
    type:
      | 'provider_rating'
      | 'geocoding'
      | 'user_profile'
      | 'payment_methods'
      | 'available_technicians'
      | 'otp',
  ): number {
    const cacheConfig = this.configService.get('cache');
    return cacheConfig.ttls?.[type] || cacheConfig.ttl;
  }

  /**
   * Generate tenant-aware cache key
   */
  generateKey(
    namespace: string,
    tenantId: string,
    resourceType: string,
    resourceId: string,
  ): string {
    return `${namespace}:${tenantId}:${resourceType}:${resourceId}`;
  }

  /**
   * Get cached value or execute fn if not cached
   */
  async getOrCompute<T>(
    key: string,
    ttl: number,
    computeFn: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.cache.get<T>(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }

    const computed = await computeFn();
    await this.cache.set(key, computed, ttl);
    return computed;
  }

  /**
   * Invalidate cache by pattern (Redis SCAN-like, but simplified)
   */
  async invalidateByPrefix(_prefix: string): Promise<void> {
    // Note: This is a simplified version. In production, you might use SCAN or maintain a set of keys
    // For now, we rely on TTL for eventual consistency
    try {
      // If using Redis directly, you could use del with pattern
      // This is a placeholder for more sophisticated invalidation
    } catch {
      // Silently handle cache invalidation errors
    }
  }
}
