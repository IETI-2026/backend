import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import { GeocodingService } from '../geocoding.service';

function makeAxiosResponse(data: unknown) {
  return of({ data } as unknown);
}

const mockHttpService = {
  get: jest.fn(),
};

const mockConfigService = {
  get: jest.fn(),
};

const mockCacheManager = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
};

const bogotaComponents = [
  {
    long_name: 'Bogotá',
    short_name: 'Bogotá',
    types: ['locality', 'political'],
  },
  {
    long_name: 'Bogota D.C.',
    short_name: 'Bogota D.C.',
    types: ['administrative_area_level_1', 'political'],
  },
  {
    long_name: 'Colombia',
    short_name: 'CO',
    types: ['country', 'political'],
  },
];

const successGeoResponse = {
  status: 'OK',
  results: [
    {
      formatted_address: 'Calle 123, Bogotá, Colombia',
      place_id: 'ChIJplace123',
      types: ['street_address'],
      address_components: bogotaComponents,
    },
  ],
};

describe('GeocodingService', () => {
  let service: GeocodingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeocodingService,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile();

    service = module.get<GeocodingService>(GeocodingService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('reverseGeocode', () => {
    it('should return formatted address and tenantCandidate on success', async () => {
      mockConfigService.get.mockReturnValue('test-api-key');
      mockHttpService.get.mockReturnValue(
        makeAxiosResponse(successGeoResponse),
      );

      const result = await service.reverseGeocode({
        lat: 4.711,
        lng: -74.0721,
      });

      expect(mockHttpService.get).toHaveBeenCalledWith(
        'https://maps.googleapis.com/maps/api/geocode/json',
        expect.objectContaining({
          params: expect.objectContaining({
            latlng: '4.711,-74.0721',
            key: 'test-api-key',
          }),
        }),
      );
      expect(result.formattedAddress).toBe('Calle 123, Bogotá, Colombia');
      expect(result.placeId).toBe('ChIJplace123');
      expect(result.tenantCandidate).toBe('bogota');
    });

    it('should normalize aliased tenant names to canonical tenant slugs', async () => {
      mockConfigService.get.mockReturnValue('test-api-key');
      const responseWithAccent = {
        ...successGeoResponse,
        results: [
          {
            ...successGeoResponse.results[0],
            address_components: [
              {
                long_name: 'Bogotá D.C.',
                short_name: 'Bogotá D.C.',
                types: ['locality', 'political'],
              },
            ],
          },
        ],
      };
      mockHttpService.get.mockReturnValue(
        makeAxiosResponse(responseWithAccent),
      );

      const result = await service.reverseGeocode({
        lat: 4.711,
        lng: -74.0721,
      });

      expect(result.tenantCandidate).toBe('bogota');
    });

    it('should return tenantCandidate as null when no recognisable address component is found', async () => {
      mockConfigService.get.mockReturnValue('test-api-key');
      const noLocality = {
        ...successGeoResponse,
        results: [
          {
            ...successGeoResponse.results[0],
            address_components: [
              {
                long_name: 'Some Street',
                short_name: 'Some St',
                types: ['route'],
              },
            ],
          },
        ],
      };
      mockHttpService.get.mockReturnValue(makeAxiosResponse(noLocality));

      const result = await service.reverseGeocode({ lat: 0, lng: 0 });

      expect(result.tenantCandidate).toBeNull();
    });

    it('should throw InternalServerErrorException when API key is not configured', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      await expect(
        service.reverseGeocode({ lat: 4.711, lng: -74.0721 }),
      ).rejects.toThrow(InternalServerErrorException);

      expect(mockHttpService.get).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when Google returns status ZERO_RESULTS', async () => {
      mockConfigService.get.mockReturnValue('test-api-key');
      mockHttpService.get.mockReturnValue(
        makeAxiosResponse({ status: 'ZERO_RESULTS', results: [] }),
      );

      await expect(service.reverseGeocode({ lat: 0, lng: 0 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when response results array is empty', async () => {
      mockConfigService.get.mockReturnValue('test-api-key');
      mockHttpService.get.mockReturnValue(
        makeAxiosResponse({ status: 'OK', results: [] }),
      );

      await expect(service.reverseGeocode({ lat: 0, lng: 0 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should include Google error_message in the thrown exception', async () => {
      mockConfigService.get.mockReturnValue('test-api-key');
      mockHttpService.get.mockReturnValue(
        makeAxiosResponse({
          status: 'REQUEST_DENIED',
          results: [],
          error_message: 'API key invalid',
        }),
      );

      await expect(service.reverseGeocode({ lat: 0, lng: 0 })).rejects.toThrow(
        'API key invalid',
      );
    });

    it('should throw BadRequestException when the HTTP response payload is falsy', async () => {
      mockConfigService.get.mockReturnValue('test-api-key');
      mockHttpService.get.mockReturnValue(makeAxiosResponse(null));

      await expect(service.reverseGeocode({ lat: 0, lng: 0 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should fall back to administrative_area_level_1 when locality is absent', async () => {
      mockConfigService.get.mockReturnValue('test-api-key');
      const noLocality = {
        ...successGeoResponse,
        results: [
          {
            ...successGeoResponse.results[0],
            address_components: [
              {
                long_name: 'Cundinamarca',
                short_name: 'Cundinamarca',
                types: ['administrative_area_level_1', 'political'],
              },
            ],
          },
        ],
      };
      mockHttpService.get.mockReturnValue(makeAxiosResponse(noLocality));

      const result = await service.reverseGeocode({
        lat: 4.711,
        lng: -74.0721,
      });

      expect(result.tenantCandidate).toBe('cundinamarca');
    });

    it('should fall back to country when both locality and admin level 1 are absent', async () => {
      mockConfigService.get.mockReturnValue('test-api-key');
      const countryOnly = {
        ...successGeoResponse,
        results: [
          {
            ...successGeoResponse.results[0],
            address_components: [
              {
                long_name: 'Colombia',
                short_name: 'CO',
                types: ['country', 'political'],
              },
            ],
          },
        ],
      };
      mockHttpService.get.mockReturnValue(makeAxiosResponse(countryOnly));

      const result = await service.reverseGeocode({
        lat: 4.711,
        lng: -74.0721,
      });

      expect(result.tenantCandidate).toBe('colombia');
    });
  });

  describe('resolveTenant', () => {
    it('should return the slugified locality as tenant', async () => {
      mockConfigService.get.mockReturnValue('test-api-key');
      mockHttpService.get.mockReturnValue(
        makeAxiosResponse(successGeoResponse),
      );

      const result = await service.resolveTenant({ lat: 4.711, lng: -74.0721 });

      expect(result.tenant).toBe('bogota');
    });

    it('should return "public" when tenantCandidate is null', async () => {
      mockConfigService.get.mockReturnValue('test-api-key');
      const noComponents = {
        ...successGeoResponse,
        results: [
          {
            ...successGeoResponse.results[0],
            address_components: [
              { long_name: 'Route 66', short_name: 'RT-66', types: ['route'] },
            ],
          },
        ],
      };
      mockHttpService.get.mockReturnValue(makeAxiosResponse(noComponents));

      const result = await service.resolveTenant({ lat: 0, lng: 0 });

      expect(result.tenant).toBe('public');
    });

    it('should propagate InternalServerErrorException when API key is missing', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      await expect(
        service.resolveTenant({ lat: 4.711, lng: -74.0721 }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should propagate BadRequestException when geocoding fails', async () => {
      mockConfigService.get.mockReturnValue('test-api-key');
      mockHttpService.get.mockReturnValue(
        makeAxiosResponse({ status: 'ZERO_RESULTS', results: [] }),
      );

      await expect(service.resolveTenant({ lat: 0, lng: 0 })).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
