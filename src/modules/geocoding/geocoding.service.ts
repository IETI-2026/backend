import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';
import { lastValueFrom } from 'rxjs';
import { ReverseGeocodeDto } from './dto/reverse-geocode.dto';

export interface GoogleAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

export interface GoogleGeocodeResult {
  formatted_address: string;
  address_components: GoogleAddressComponent[];
  place_id: string;
  types: string[];
}

export interface GoogleGeocodeResponse {
  status: string;
  results: GoogleGeocodeResult[];
  error_message?: string;
}

export interface CachedGeocode {
  formattedAddress: string;
  placeId: string;
  components: GoogleAddressComponent[];
  tenantCandidate: string | null;
}

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER)
    private readonly cache: Cache,
  ) {}

  async reverseGeocode(params: ReverseGeocodeDto) {
    // Round coordinates to 4 decimal places for better cache hit rate
    // (roughly 11 meters precision)
    const roundedLat = Math.round(params.lat * 10000) / 10000;
    const roundedLng = Math.round(params.lng * 10000) / 10000;
    const cacheKey = `geocode:${roundedLat}:${roundedLng}`;

    // Try to get from cache first (public namespace, shared across all tenants)
    const cached = await this.cache.get<CachedGeocode>(cacheKey);
    if (cached) {
      this.logger.debug(
        `Cache hit for reverse geocoding lat=${roundedLat} lng=${roundedLng}`,
      );
      return cached;
    }

    // Not in cache, call Google Maps API
    const apiKey = this.configService.get<string>('googleMaps.apiKey');

    if (!apiKey) {
      this.logger.error('Google Maps API key is not configured');
      throw new InternalServerErrorException(
        'Google Maps API key is not configured',
      );
    }

    this.logger.debug(`Reverse geocoding lat=${params.lat} lng=${params.lng}`);

    const url = 'https://maps.googleapis.com/maps/api/geocode/json';

    const response = await lastValueFrom(
      this.httpService.get<GoogleGeocodeResponse>(url, {
        params: {
          latlng: `${params.lat},${params.lng}`,
          key: apiKey,
        },
      }),
    );

    const payload = response.data;

    if (!payload || payload.status !== 'OK' || payload.results.length === 0) {
      const reason =
        payload?.error_message || payload?.status || 'Unknown error';
      this.logger.warn(
        `Google Maps could not resolve address for lat=${params.lat} lng=${params.lng}: ${reason}`,
      );
      throw new BadRequestException(
        `Google Maps could not resolve the address: ${reason}`,
      );
    }

    const primary = payload.results[0];
    const tenantCandidate = this.deriveTenantCandidate(
      primary.address_components,
    );

    const result: CachedGeocode = {
      formattedAddress: primary.formatted_address,
      placeId: primary.place_id,
      components: primary.address_components,
      tenantCandidate,
    };

    // Cache for 24 hours (geographic data is stable)
    const cacheConfig = this.configService.get('cache');
    const ttl = cacheConfig.ttls?.geocoding || 3600 * 24;
    await this.cache.set(cacheKey, result, ttl);

    this.logger.log(
      `Reverse geocode resolved: "${primary.formatted_address}" → tenant="${tenantCandidate ?? 'public'}"`,
    );

    return result;
  }

  async resolveTenant(params: ReverseGeocodeDto): Promise<{ tenant: string }> {
    const result = await this.reverseGeocode(params);
    return { tenant: result.tenantCandidate ?? 'public' };
  }

  private deriveTenantCandidate(
    components: GoogleAddressComponent[],
  ): string | null {
    const tenantSource = this.findFirstComponent(components, [
      'locality',
      'administrative_area_level_1',
      'country',
    ]);

    if (!tenantSource) {
      return null;
    }

    return this.slugify(tenantSource.long_name);
  }

  private findFirstComponent(
    components: GoogleAddressComponent[],
    types: string[],
  ): GoogleAddressComponent | undefined {
    return components.find((component) =>
      component.types.some((type) => types.includes(type)),
    );
  }

  private slugify(value: string): string {
    const normalized = value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();

    const slug = normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return slug || 'public';
  }
}
