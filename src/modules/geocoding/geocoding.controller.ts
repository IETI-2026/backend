import { Body, Controller, Post } from "@nestjs/common";
import { ApiBody } from "@nestjs/swagger";
import { ReverseGeocodeDto } from "./dto/reverse-geocode.dto";
import { GeocodingService } from "./geocoding.service";

const reverseGeocodeBodyExample = {
  lat: 4.711,
  lng: -74.0721,
};

@Controller("geocoding")
export class GeocodingController {
  constructor(private readonly geocodingService: GeocodingService) {}

  @Post("reverse")
  @ApiBody({
    type: ReverseGeocodeDto,
    examples: {
      default: {
        summary: "Coordenadas de ejemplo",
        value: reverseGeocodeBodyExample,
      },
    },
  })
  reverse(@Body() payload: ReverseGeocodeDto) {
    return this.geocodingService.reverseGeocode(payload);
  }

  @Post("tenant")
  @ApiBody({
    type: ReverseGeocodeDto,
    examples: {
      default: {
        summary: "Coordenadas de ejemplo",
        value: reverseGeocodeBodyExample,
      },
    },
  })
  async getTenant(
    @Body() payload: ReverseGeocodeDto,
  ): Promise<{ tenant: string }> {
    return this.geocodingService.resolveTenant(payload);
  }
}
