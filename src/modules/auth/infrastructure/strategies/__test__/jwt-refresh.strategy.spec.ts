import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtRefreshStrategy } from '../jwt-refresh.strategy';
import { JwtPayloadEntity } from '../../../domain/entities';
import { RoleName } from '@/database/enums';

// ---------------------------------------------------------------------------
// We need to bypass the PassportStrategy super() call because it tries to
// validate the secret at construction time. We mock passport-jwt so that
// Strategy is a plain class that does nothing in its constructor.
// ---------------------------------------------------------------------------
jest.mock('passport-jwt', () => {
  const actual = jest.requireActual('passport-jwt');
  class MockStrategy {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_options: unknown) {}
  }
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

  // -------------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------------

  describe('constructor', () => {
    it('reads jwt.refreshSecret from config', () => {
      expect(configService.get).toHaveBeenCalledWith('jwt.refreshSecret');
    });

    it('throws when refreshSecret is missing', async () => {
      await expect(buildStrategy('')).rejects.toThrow('JWT refresh secret is required');
    });
  });

  // -------------------------------------------------------------------------
  // validate
  // -------------------------------------------------------------------------

  describe('validate', () => {
    const mockRequest = {} as any;

    it('returns a JwtPayloadEntity when payload type is refresh', async () => {
      const payload = {
        sub: 'user-1',
        email: 'user@example.com',
        roles: [RoleName.USER],
        type: 'refresh',
        iat: 1000,
        exp: 9999,
      };

      const result: JwtPayloadEntity = await strategy.validate(mockRequest, payload);

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
      } as any;

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
