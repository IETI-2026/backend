import { Body, Controller, Logger, Post, UseGuards } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { ReverseGeocodeDto } from './dto/reverse-geocode.dto';
import { GeocodingService } from './geocoding.service';

const reverseGeocodeBodyExample = {
  lat: 4.711,
  lng: -74.0721,
};

@Controller('geocoding')
@UseGuards(JwtAuthGuard)
@Throttle({ default: { ttl: 60000, limit: 30 } })
export class GeocodingController {
  private readonly logger = new Logger(GeocodingController.name);

  constructor(private readonly geocodingService: GeocodingService) {}

  @Post('reverse')
  @ApiBody({
    type: ReverseGeocodeDto,
    examples: {
      default: {
        summary: 'Coordenadas de ejemplo',
        value: reverseGeocodeBodyExample,
      },
    },
  })
  reverse(@Body() payload: ReverseGeocodeDto) {
    this.logger.log(
      `POST /geocoding/reverse - Reverse geocoding for lat=${payload.lat}, lng=${payload.lng}`,
    );
    return this.geocodingService.reverseGeocode(payload);
  }

  @Post('tenant')
  @ApiBody({
    type: ReverseGeocodeDto,
    examples: {
      default: {
        summary: 'Coordenadas de ejemplo',
        value: reverseGeocodeBodyExample,
      },
    },
  })
  async getTenant(
    @Body() payload: ReverseGeocodeDto,
  ): Promise<{ tenant: string }> {
    this.logger.log(
      `POST /geocoding/tenant - Resolving tenant for lat=${payload.lat}, lng=${payload.lng}`,
    );
    return this.geocodingService.resolveTenant(payload);
  }
}
