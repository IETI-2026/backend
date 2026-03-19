import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { RoleName } from '../../../../../database/enums';
import { AuthService } from '../../../application/services/auth.service';
import { JwtPayloadEntity } from '../../../domain/entities';
import { JwtStrategy } from '../jwt.strategy';

const mockValidatedPayload: JwtPayloadEntity = {
  sub: 'user-uuid-001',
  email: 'user@example.com',
  roles: [RoleName.USER],
};

const mockAuthService = {
  validateJwtPayload: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockReturnValue('test-jwt-secret-that-is-long-enough'),
};

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: AuthService, useValue: mockAuthService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    const incomingPayload: JwtPayloadEntity = {
      sub: 'user-uuid-001',
      email: 'user@example.com',
      roles: [RoleName.USER],
      iat: 1700000000,
      exp: 1700003600,
    };

    it('should return the validated payload on success', async () => {
      mockAuthService.validateJwtPayload.mockResolvedValue(
        mockValidatedPayload,
      );

      const result = await strategy.validate(incomingPayload);

      expect(mockAuthService.validateJwtPayload).toHaveBeenCalledWith(
        incomingPayload,
      );
      expect(result).toBe(mockValidatedPayload);
      expect(result.sub).toBe('user-uuid-001');
      expect(result.email).toBe('user@example.com');
    });

    it('should propagate UnauthorizedException when user is not found or inactive', async () => {
      mockAuthService.validateJwtPayload.mockRejectedValue(
        new UnauthorizedException('User not found or inactive'),
      );

      await expect(strategy.validate(incomingPayload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should propagate UnauthorizedException for invalid JWT payload (no sub)', async () => {
      const payloadWithoutSub: JwtPayloadEntity = {
        email: 'user@example.com',
      };
      mockAuthService.validateJwtPayload.mockRejectedValue(
        new UnauthorizedException('Invalid JWT payload'),
      );

      await expect(strategy.validate(payloadWithoutSub)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should propagate unexpected service errors', async () => {
      mockAuthService.validateJwtPayload.mockRejectedValue(
        new Error('Database connection lost'),
      );

      await expect(strategy.validate(incomingPayload)).rejects.toThrow(
        'Database connection lost',
      );
    });
  });

  describe('constructor', () => {
    it('should throw an error when JWT secret is not configured', () => {
      const configWithoutSecret = {
        get: jest.fn().mockReturnValue(undefined),
      };

      expect(() => {
        new JwtStrategy(
          configWithoutSecret as unknown as ConfigService,
          mockAuthService as unknown as AuthService,
        );
      }).toThrow('JWT secret is required');
    });
  });
});
