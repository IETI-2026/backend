import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { RoleName } from '../../../../database/enums';
import { AuthService } from '../../application/services/auth.service';
import { JwtPayloadEntity } from '../../domain/entities';
import { JwtAuthGuard } from '../../infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../infrastructure/guards/roles.guard';
import { AuthController } from '../auth.controller';

// ─── shared fixtures ──────────────────────────────────────────────────────────

const mockAuthResponse = {
  accessToken: 'mock.access.token',
  refreshToken: 'mock.refresh.token',
  tokenType: 'Bearer',
  expiresIn: 3600,
  user: {
    id: 'user-uuid-001',
    email: 'test@example.com',
    fullName: 'Test User',
    roles: [RoleName.USER],
  },
};

const mockUser: JwtPayloadEntity = {
  sub: 'user-uuid-001',
  email: 'test@example.com',
  roles: [RoleName.USER],
};

const mockAuthService = {
  signUp: jest.fn(),
  login: jest.fn(),
  refreshToken: jest.fn(),
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
  changePassword: jest.fn(),
  sendOtp: jest.fn(),
  verifyOtpAndLogin: jest.fn(),
  handleGoogleOAuthCallback: jest.fn(),
  getCurrentUser: jest.fn(),
  logout: jest.fn(),
};

const mockConfigService = {
  get: jest.fn(),
};

// Override guards so controller logic runs without Passport strategy
const allowAllGuard = { canActivate: () => true };

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(allowAllGuard)
      .overrideGuard(RolesGuard)
      .useValue(allowAllGuard)
      .compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── signUp ──────────────────────────────────────────────────────────────────

  describe('signUp', () => {
    const dto = {
      email: 'test@example.com',
      password: 'Secret123!',
      fullName: 'Test User',
    };

    it('should return auth response on successful registration', async () => {
      mockAuthService.signUp.mockResolvedValue(mockAuthResponse);

      const result = await controller.signUp(dto as unknown);

      expect(mockAuthService.signUp).toHaveBeenCalledWith(dto);
      expect(result).toBe(mockAuthResponse);
    });

    it('should propagate errors thrown by AuthService', async () => {
      mockAuthService.signUp.mockRejectedValue(
        new Error('Email already taken'),
      );

      await expect(controller.signUp(dto as unknown)).rejects.toThrow(
        'Email already taken',
      );
    });
  });

  // ─── login ───────────────────────────────────────────────────────────────────

  describe('login', () => {
    const dto = { email: 'test@example.com', password: 'Secret123!' };

    it('should return auth response for valid credentials', async () => {
      mockAuthService.login.mockResolvedValue(mockAuthResponse);

      const result = await controller.login(dto as unknown);

      expect(mockAuthService.login).toHaveBeenCalledWith(dto);
      expect(result).toBe(mockAuthResponse);
    });

    it('should propagate UnauthorizedException for invalid credentials', async () => {
      mockAuthService.login.mockRejectedValue(
        new UnauthorizedException('Invalid credentials'),
      );

      await expect(controller.login(dto as unknown)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ─── refreshToken ─────────────────────────────────────────────────────────────

  describe('refreshToken', () => {
    it('should return new tokens for a valid refresh token', async () => {
      mockAuthService.refreshToken.mockResolvedValue(mockAuthResponse);

      const result = await controller.refreshToken({
        refreshToken: 'valid.refresh.token',
      } as unknown);

      expect(mockAuthService.refreshToken).toHaveBeenCalledWith(
        'valid.refresh.token',
      );
      expect(result).toBe(mockAuthResponse);
    });

    it('should throw UnauthorizedException when refreshToken field is empty', async () => {
      await expect(
        controller.refreshToken({ refreshToken: '' } as unknown),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockAuthService.refreshToken).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when refreshToken field is missing', async () => {
      await expect(controller.refreshToken({} as unknown)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should propagate service errors for an invalid token', async () => {
      mockAuthService.refreshToken.mockRejectedValue(
        new UnauthorizedException('Token revoked'),
      );

      await expect(
        controller.refreshToken({ refreshToken: 'bad.token' } as unknown),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── forgotPassword ───────────────────────────────────────────────────────────

  describe('forgotPassword', () => {
    it('should return a generic message regardless of whether email exists', async () => {
      mockAuthService.forgotPassword.mockResolvedValue({
        message: 'If the email exists, a reset link was sent',
      });

      const result = await controller.forgotPassword({
        email: 'any@example.com',
      } as unknown);

      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith({
        email: 'any@example.com',
      });
      expect(result.message).toContain('If the email exists');
    });

    it('should propagate service errors', async () => {
      mockAuthService.forgotPassword.mockRejectedValue(
        new Error('Mail service down'),
      );

      await expect(
        controller.forgotPassword({ email: 'a@b.com' } as unknown),
      ).rejects.toThrow('Mail service down');
    });
  });

  // ─── resetPassword ────────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    const dto = { token: 'valid-token', newPassword: 'NewPass123!' };

    it('should return success message when token is valid', async () => {
      mockAuthService.resetPassword.mockResolvedValue({
        message: 'Password reset successfully',
      });

      const result = await controller.resetPassword(dto as unknown);

      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(dto);
      expect(result.message).toContain('reset successfully');
    });

    it('should propagate BadRequestException for expired token', async () => {
      mockAuthService.resetPassword.mockRejectedValue(
        new BadRequestException('Token expired'),
      );

      await expect(controller.resetPassword(dto as unknown)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── changePassword ───────────────────────────────────────────────────────────

  describe('changePassword', () => {
    const dto = { currentPassword: 'OldPass123!', newPassword: 'NewPass456!' };

    it('should change password for an authenticated user', async () => {
      mockAuthService.changePassword.mockResolvedValue({
        message: 'Password changed successfully',
      });

      const result = await controller.changePassword(mockUser, dto as unknown);

      expect(mockAuthService.changePassword).toHaveBeenCalledWith(
        mockUser.sub,
        dto,
      );
      expect(result.message).toContain('changed successfully');
    });

    it('should throw UnauthorizedException when user has no sub', async () => {
      const userWithoutSub: JwtPayloadEntity = {
        email: 'test@example.com',
        roles: [],
      };

      await expect(
        controller.changePassword(userWithoutSub, dto as unknown),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockAuthService.changePassword).not.toHaveBeenCalled();
    });

    it('should propagate UnauthorizedException for wrong current password', async () => {
      mockAuthService.changePassword.mockRejectedValue(
        new UnauthorizedException('Current password incorrect'),
      );

      await expect(
        controller.changePassword(mockUser, dto as unknown),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── sendOtp ──────────────────────────────────────────────────────────────────

  describe('sendOtp', () => {
    it('should return OTP metadata on success', async () => {
      mockAuthService.sendOtp.mockResolvedValue({
        message: 'OTP sent to +573001234567',
        expiresInSeconds: 300,
      });

      const result = await controller.sendOtp({
        phone: '+573001234567',
      } as unknown);

      expect(mockAuthService.sendOtp).toHaveBeenCalledWith({
        phone: '+573001234567',
      });
      expect(result.expiresInSeconds).toBe(300);
    });

    it('should propagate service errors', async () => {
      mockAuthService.sendOtp.mockRejectedValue(new Error('SMS gateway error'));

      await expect(
        controller.sendOtp({ phone: '+1234567890' } as unknown),
      ).rejects.toThrow('SMS gateway error');
    });
  });

  // ─── verifyOtp ────────────────────────────────────────────────────────────────

  describe('verifyOtp', () => {
    const dto = { phone: '+573001234567', code: '123456' };

    it('should return auth tokens when OTP is valid', async () => {
      mockAuthService.verifyOtpAndLogin.mockResolvedValue(mockAuthResponse);

      const result = await controller.verifyOtp(dto as unknown);

      expect(mockAuthService.verifyOtpAndLogin).toHaveBeenCalledWith(dto);
      expect(result).toBe(mockAuthResponse);
    });

    it('should propagate UnauthorizedException for invalid OTP', async () => {
      mockAuthService.verifyOtpAndLogin.mockRejectedValue(
        new UnauthorizedException('Invalid or expired OTP'),
      );

      await expect(controller.verifyOtp(dto as unknown)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ─── getGoogleAuthUrl ─────────────────────────────────────────────────────────

  describe('getGoogleAuthUrl', () => {
    it('should return a properly formatted Google OAuth URL', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'oauth.google.clientId') return 'test-client-id';
        if (key === 'oauth.google.callbackUrl')
          return 'http://localhost:3001/auth/google/callback';
        return null;
      });

      const result = await controller.getGoogleAuthUrl();

      expect(result.authUrl).toContain('accounts.google.com');
      expect(result.authUrl).toContain('test-client-id');
      expect(result.authUrl).toContain('openid');
    });

    it('should throw an Error when callback URL is not configured', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'oauth.google.clientId') return 'test-client-id';
        if (key === 'oauth.google.callbackUrl') return undefined;
        return null;
      });

      await expect(controller.getGoogleAuthUrl()).rejects.toThrow(
        'Google OAuth callback URL is not configured',
      );
    });
  });

  // ─── googleCallback ───────────────────────────────────────────────────────────

  describe('googleCallback', () => {
    const makeRes = () => ({ redirect: jest.fn() }) as unknown;

    it('should redirect to frontend with tokens on successful OAuth callback', async () => {
      mockAuthService.handleGoogleOAuthCallback.mockResolvedValue(
        mockAuthResponse,
      );
      mockConfigService.get.mockReturnValue('http://localhost:3000');

      const req: unknown = {
        user: {
          provider: 'google',
          providerId: 'google-123',
          email: 'oauth@example.com',
          fullName: 'OAuth User',
          profilePhotoUrl: null,
          accessToken: 'goog-access',
          refreshToken: 'goog-refresh',
        },
      };
      const res = makeRes();

      await controller.googleCallback(req, res);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('accessToken=mock.access.token'),
      );
    });

    it('should throw UnauthorizedException when req.user is absent', async () => {
      const req: unknown = {};
      const res = makeRes();

      await expect(controller.googleCallback(req, res)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when OAuth user has no email', async () => {
      const req: unknown = {
        user: {
          provider: 'google',
          providerId: 'google-123',
          email: undefined,
          fullName: 'No Email User',
          accessToken: 'goog-access',
        },
      };
      const res = makeRes();

      await expect(controller.googleCallback(req, res)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should redirect to error page when handleGoogleOAuthCallback throws', async () => {
      mockAuthService.handleGoogleOAuthCallback.mockRejectedValue(
        new Error('OAuth failed'),
      );
      mockConfigService.get.mockReturnValue('http://localhost:3000');

      const req: unknown = {
        user: {
          provider: 'google',
          providerId: 'google-123',
          email: 'oauth@example.com',
          fullName: 'OAuth User',
          accessToken: 'goog-access',
        },
      };
      const res = makeRes();

      await controller.googleCallback(req, res);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/auth/error'),
      );
    });

    it('should throw UnauthorizedException when authResponse.user is absent', async () => {
      mockAuthService.handleGoogleOAuthCallback.mockResolvedValue({
        ...mockAuthResponse,
        user: undefined,
      });
      mockConfigService.get.mockReturnValue('http://localhost:3000');

      const req: unknown = {
        user: {
          provider: 'google',
          providerId: 'google-123',
          email: 'oauth@example.com',
          fullName: 'OAuth User',
          accessToken: 'goog-access',
        },
      };
      const res = makeRes();

      // The thrown error is caught inside and redirected to error page
      await controller.googleCallback(req, res);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/auth/error'),
      );
    });
  });

  // ─── getCurrentUser ───────────────────────────────────────────────────────────

  describe('getCurrentUser', () => {
    it('should return the current user profile', async () => {
      const userResponse = {
        id: 'user-uuid-001',
        email: 'test@example.com',
        roles: [RoleName.USER],
      };
      mockAuthService.getCurrentUser.mockResolvedValue(userResponse);

      const result = await controller.getCurrentUser(mockUser);

      expect(mockAuthService.getCurrentUser).toHaveBeenCalledWith(mockUser.sub);
      expect(result).toBe(userResponse);
    });

    it('should throw UnauthorizedException when user has no sub', async () => {
      const userWithoutSub: JwtPayloadEntity = { email: 'test@example.com' };

      await expect(controller.getCurrentUser(userWithoutSub)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(mockAuthService.getCurrentUser).not.toHaveBeenCalled();
    });

    it('should propagate service errors', async () => {
      mockAuthService.getCurrentUser.mockRejectedValue(
        new UnauthorizedException('User not found'),
      );

      await expect(controller.getCurrentUser(mockUser)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ─── logout ───────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('should revoke sessions and return success message', async () => {
      mockAuthService.logout.mockResolvedValue({
        message: 'Logout successful',
      });

      const result = await controller.logout(mockUser);

      expect(mockAuthService.logout).toHaveBeenCalledWith(mockUser.sub);
      expect(result.message).toContain('Logout successful');
    });

    it('should throw UnauthorizedException when user has no sub', async () => {
      const userWithoutSub: JwtPayloadEntity = { email: 'test@example.com' };

      await expect(controller.logout(userWithoutSub)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(mockAuthService.logout).not.toHaveBeenCalled();
    });

    it('should propagate service errors', async () => {
      mockAuthService.logout.mockRejectedValue(
        new Error('Token store unavailable'),
      );

      await expect(controller.logout(mockUser)).rejects.toThrow(
        'Token store unavailable',
      );
    });
  });
});
