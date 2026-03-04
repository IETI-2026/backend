import { Body, Controller, Post } from '@nestjs/common';
import { ReverseGeocodeDto } from './dto/reverse-geocode.dto';
import { GeocodingService } from './geocoding.service';

@Controller('geocoding')
export class GeocodingController {
  constructor(private readonly geocodingService: GeocodingService) {}

  @Post('reverse')
  reverse(@Body() payload: ReverseGeocodeDto) {
    return this.geocodingService.reverseGeocode(payload);
  }

  @Post('tenant')
  async getTenant(
    @Body() payload: ReverseGeocodeDto,
  ): Promise<{ tenant: string }> {
    return this.geocodingService.resolveTenant(payload);
  }
}
