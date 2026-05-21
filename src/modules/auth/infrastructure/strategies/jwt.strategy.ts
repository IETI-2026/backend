import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Cache } from 'cache-manager';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { TenantContext } from '@/tenant';
import { AuthService } from '../../application/services/auth.service';
import { JwtPayloadEntity } from '../../domain/entities';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
    @Inject(CACHE_MANAGER)
    private readonly cache: Cache,
    private readonly tenantContext: TenantContext,
    private readonly configServiceForCache: ConfigService,
  ) {
    const secret = configService.get<string>('jwt.secret');
    if (!secret) {
      throw new Error('JWT secret is required');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayloadEntity): Promise<JwtPayloadEntity> {
    // Get user from cache if available, otherwise validate with DB
    const tenantId = this.tenantContext.getTenantId() || 'public';
    const cacheKey = `user:${tenantId}:${payload.sub}`;

    const cachedPayload = await this.cache.get<JwtPayloadEntity>(cacheKey);
    if (cachedPayload) {
      return cachedPayload;
    }

    // Validate with AuthService (fetches from DB)
    const validatedPayload = await this.authService.validateJwtPayload(payload);

    // Cache for 30 minutes
    const cacheConfig = this.configServiceForCache.get('cache');
    const ttl = cacheConfig?.ttls?.user_profile || 1800;
    await this.cache.set(cacheKey, validatedPayload, ttl);

    return validatedPayload;
  }
}
