import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
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

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async reverseGeocode(params: ReverseGeocodeDto) {
    const apiKey = this.configService.get<string>('googleMaps.apiKey');
    console.log(`Using Google Maps API key: ${apiKey}`);

    if (!apiKey) {
      throw new InternalServerErrorException('Google Maps API key is not configured');
    }

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
      const reason = payload?.error_message || payload?.status || 'Unknown error';
      throw new BadRequestException(`Google Maps could not resolve the address: ${reason}`);
    }

    const primary = payload.results[0];
    const tenantCandidate = this.deriveTenantCandidate(primary.address_components);

    return {
      formattedAddress: primary.formatted_address,
      placeId: primary.place_id,
      components: primary.address_components,
      tenantCandidate,
    };
  }

  async resolveTenant(params: ReverseGeocodeDto): Promise<{ tenant: string }> {
    const result = await this.reverseGeocode(params);
    return { tenant: result.tenantCandidate ?? 'public' };
  }

  private deriveTenantCandidate(components: GoogleAddressComponent[]): string | null {
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
