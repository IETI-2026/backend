import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { RoleName } from '@/database/enums';
import { JwtPayloadEntity } from '../../../domain/entities';
import { JwtRefreshStrategy } from '../jwt-refresh.strategy';

jest.mock('passport-jwt', () => {
  const actual = jest.requireActual('passport-jwt');
  class MockStrategy {}
  return {
    ...actual,
    Strategy: MockStrategy,
    ExtractJwt: actual.ExtractJwt,
  };
});

describe('JwtRefreshStrategy', () => {
  let strategy: JwtRefreshStrategy;
  let configService: jest.Mocked<ConfigService>;

  const buildStrategy = async (refreshSecret = 'test-refresh-secret') => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtRefreshStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(refreshSecret),
          },
        },
      ],
    }).compile();

    strategy = module.get(JwtRefreshStrategy);
    configService = module.get(ConfigService);
  };

  beforeEach(async () => {
    await buildStrategy();
  });

  describe('constructor', () => {
    it('reads jwt.refreshSecret from config', () => {
      expect(configService.get).toHaveBeenCalledWith('jwt.refreshSecret');
    });

    it('throws when refreshSecret is missing', async () => {
      await expect(buildStrategy('')).rejects.toThrow(
        'JWT refresh secret is required',
      );
    });
  });

  describe('validate', () => {
    const mockRequest = {} as unknown;

    it('returns a JwtPayloadEntity when payload type is refresh', async () => {
      const payload = {
        sub: 'user-1',
        email: 'user@example.com',
        roles: [RoleName.USER],
        type: 'refresh',
        iat: 1000,
        exp: 9999,
      };

      const result: JwtPayloadEntity = await strategy.validate(
        mockRequest,
        payload,
      );

      expect(result).toEqual({
        sub: 'user-1',
        email: 'user@example.com',
        roles: [RoleName.USER],
      });
    });

    it('throws BadRequestException when payload type is not refresh', async () => {
      const payload = {
        sub: 'user-1',
        email: 'user@example.com',
        roles: [RoleName.USER],
        type: 'access',
      };

      await expect(strategy.validate(mockRequest, payload)).rejects.toThrow(
        BadRequestException,
      );
      await expect(strategy.validate(mockRequest, payload)).rejects.toThrow(
        'Invalid refresh token',
      );
    });

    it('throws BadRequestException when type field is absent', async () => {
      const payload = {
        sub: 'user-1',
        email: 'user@example.com',
        roles: [],
        type: undefined,
      } as unknown;

      await expect(strategy.validate(mockRequest, payload)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('includes roles in returned payload', async () => {
      const payload = {
        sub: 'admin-1',
        email: 'admin@example.com',
        roles: [RoleName.ADMIN, RoleName.PROVIDER],
        type: 'refresh',
      };

      const result = await strategy.validate(mockRequest, payload);

      expect(result.roles).toEqual([RoleName.ADMIN, RoleName.PROVIDER]);
    });
  });
});
