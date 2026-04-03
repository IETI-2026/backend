import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ReverseGeocodeDto } from '../dto/reverse-geocode.dto';
import { GeocodingController } from '../geocoding.controller';
import { GeocodingService } from '../geocoding.service';

const mockReverseGeocodeResult = {
  formattedAddress: 'Cra. 7 #123-45, Bogotá, Colombia',
  placeId: 'ChIJ_place_id_123',
  components: [
    { long_name: 'Bogotá', short_name: 'Bogotá', types: ['locality'] },
    {
      long_name: 'Cundinamarca',
      short_name: 'Cundinamarca',
      types: ['administrative_area_level_1'],
    },
    { long_name: 'Colombia', short_name: 'CO', types: ['country'] },
  ],
  tenantCandidate: 'bogota',
};

const mockGeocodingService = {
  reverseGeocode: jest.fn(),
  resolveTenant: jest.fn(),
};

describe('GeocodingController', () => {
  let controller: GeocodingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GeocodingController],
      providers: [
        { provide: GeocodingService, useValue: mockGeocodingService },
      ],
    }).compile();

    controller = module.get<GeocodingController>(GeocodingController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('reverse', () => {
    const payload: ReverseGeocodeDto = { lat: 4.711, lng: -74.0721 };

    it('should return geocoding result for valid coordinates', async () => {
      mockGeocodingService.reverseGeocode.mockResolvedValue(
        mockReverseGeocodeResult,
      );

      const result = await controller.reverse(payload);

      expect(mockGeocodingService.reverseGeocode).toHaveBeenCalledWith(payload);
      expect(result).toBe(mockReverseGeocodeResult);
      expect(result.formattedAddress).toBe('Cra. 7 #123-45, Bogotá, Colombia');
      expect(result.tenantCandidate).toBe('bogota');
    });

    it('should propagate InternalServerErrorException when API key is missing', async () => {
      mockGeocodingService.reverseGeocode.mockRejectedValue(
        new InternalServerErrorException(
          'Google Maps API key is not configured',
        ),
      );

      await expect(controller.reverse(payload)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should propagate BadRequestException when coordinates cannot be resolved', async () => {
      mockGeocodingService.reverseGeocode.mockRejectedValue(
        new BadRequestException(
          'Google Maps could not resolve the address: ZERO_RESULTS',
        ),
      );

      await expect(controller.reverse({ lat: 0, lng: 0 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should propagate generic errors from the service', async () => {
      mockGeocodingService.reverseGeocode.mockRejectedValue(
        new Error('Network error'),
      );

      await expect(controller.reverse(payload)).rejects.toThrow(
        'Network error',
      );
    });
  });

  describe('getTenant', () => {
    const payload: ReverseGeocodeDto = { lat: 4.711, lng: -74.0721 };

    it('should return the tenant for valid coordinates', async () => {
      mockGeocodingService.resolveTenant.mockResolvedValue({
        tenant: 'bogota',
      });

      const result = await controller.getTenant(payload);

      expect(mockGeocodingService.resolveTenant).toHaveBeenCalledWith(payload);
      expect(result).toEqual({ tenant: 'bogota' });
    });

    it('should return public as fallback tenant when no locality is found', async () => {
      mockGeocodingService.resolveTenant.mockResolvedValue({
        tenant: 'public',
      });

      const result = await controller.getTenant({ lat: 89.9999, lng: 0 });

      expect(result.tenant).toBe('public');
    });

    it('should propagate InternalServerErrorException when API key is missing', async () => {
      mockGeocodingService.resolveTenant.mockRejectedValue(
        new InternalServerErrorException(
          'Google Maps API key is not configured',
        ),
      );

      await expect(controller.getTenant(payload)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should propagate BadRequestException when Google Maps returns no results', async () => {
      mockGeocodingService.resolveTenant.mockRejectedValue(
        new BadRequestException(
          'Google Maps could not resolve the address: ZERO_RESULTS',
        ),
      );

      await expect(controller.getTenant({ lat: 0, lng: 0 })).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
