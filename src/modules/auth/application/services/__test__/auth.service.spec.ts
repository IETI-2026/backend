import { MailService } from '@mail/application/mail.service';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { RoleName } from '../../../../../database/enums';
import {
  AUTH_REPOSITORY,
  type IAuthRepository,
} from '../../../domain/repositories';
import { AuthService } from '../auth.service';

jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  let service: AuthService;
  let authRepository: jest.Mocked<IAuthRepository>;

  const mockUser = {
    id: 'user-uuid-001',
    email: 'test@example.com',
    fullName: 'Test User',
    passwordHash: '$2b$10$hashedpassword',
    phoneNumber: '+573001234567',
    profilePhotoUrl: null,
    emailVerified: false,
    phoneVerified: false,
    status: 'ACTIVE',
    skills: [],
    currentLatitude: null,
    currentLongitude: null,
    lastLocationUpdate: null,
    lastLoginAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
  };

  const mockRefreshTokenRecord = {
    id: 'token-uuid-001',
    userId: 'user-uuid-001',
    token: 'mock.refresh.token',
    isRevoked: false,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
  };

  const mockAuthRepository: jest.Mocked<IAuthRepository> = {
    findUserByEmail: jest.fn(),
    findUserById: jest.fn(),
    ensureUserInCurrentTenant: jest.fn(),
    findUserWithRoles: jest.fn(),
    createUser: jest.fn(),
    updateUser: jest.fn(),
    findOAuthAccount: jest.fn(),
    createOAuthAccount: jest.fn(),
    findRefreshToken: jest.fn(),
    createRefreshToken: jest.fn(),
    revokeRefreshToken: jest.fn(),
    assignRoleToUser: jest.fn(),
    getUserRoles: jest.fn(),
    revokeAllUserRefreshTokens: jest.fn(),
    findUserByPhone: jest.fn(),
    createPasswordResetToken: jest.fn(),
    findValidPasswordResetToken: jest.fn(),
    markPasswordResetTokenUsed: jest.fn(),
    createOtpCode: jest.fn(),
    findValidOtpCode: jest.fn(),
    incrementOtpAttempts: jest.fn(),
    markOtpUsed: jest.fn(),
    invalidateOtpCodesForPhone: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock.access.token'),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('mock-secret'),
  };

  const mockMailService = {
    sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    sendOtpEmail: jest.fn().mockResolvedValue(undefined),
  };

  // ─── module setup ──────────────────────────────────────────────────────────

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AUTH_REPOSITORY, useValue: mockAuthRepository },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    authRepository = module.get(AUTH_REPOSITORY);

    jest.clearAllMocks();

    mockAuthRepository.getUserRoles.mockResolvedValue([RoleName.USER]);
    mockAuthRepository.createRefreshToken.mockResolvedValue(
      mockRefreshTokenRecord as unknown,
    );
    mockAuthRepository.findUserById.mockResolvedValue(mockUser as unknown);
    mockJwtService.sign.mockReturnValue('mock.access.token');
    mockConfigService.get.mockReturnValue('mock-secret');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('signUp', () => {
    it('should create a new user and return auth tokens on success', async () => {
      mockAuthRepository.findUserByEmail.mockResolvedValue(null);
      mockAuthRepository.createUser.mockResolvedValue(mockUser as unknown);
      (mockedBcrypt.hash as jest.Mock).mockResolvedValue(
        '$2b$10$newhashedpassword',
      );

      const result = await service.signUp({
        email: 'test@example.com',
        password: 'Secret123!',
        fullName: 'Test User',
      });

      expect(authRepository.findUserByEmail).toHaveBeenCalledWith(
        'test@example.com',
      );
      expect(authRepository.createUser).toHaveBeenCalled();
      expect(result.accessToken).toBe('mock.access.token');
      expect(result.tokenType).toBe('Bearer');
    });

    it('should throw ConflictException when email is already registered', async () => {
      mockAuthRepository.findUserByEmail.mockResolvedValue(mockUser as unknown);

      await expect(
        service.signUp({
          email: 'test@example.com',
          password: 'Secret123!',
          fullName: 'Test User',
        }),
      ).rejects.toThrow(ConflictException);

      expect(authRepository.createUser).not.toHaveBeenCalled();
    });

    it('should hash the plain-text password before persisting the user', async () => {
      mockAuthRepository.findUserByEmail.mockResolvedValue(null);
      mockAuthRepository.createUser.mockResolvedValue(mockUser as unknown);
      (mockedBcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$hashed');

      await service.signUp({
        email: 'new@example.com',
        password: 'PlainText',
        fullName: 'New User',
      });

      expect(mockedBcrypt.hash).toHaveBeenCalledWith('PlainText', 10);
    });
  });

  describe('login', () => {
    it('should return auth tokens when credentials are valid', async () => {
      mockAuthRepository.findUserByEmail.mockResolvedValue(mockUser as unknown);
      mockAuthRepository.updateUser.mockResolvedValue(mockUser as unknown);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: 'test@example.com',
        password: 'Secret123!',
      });

      expect(authRepository.updateUser).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({ lastLoginAt: expect.any(Date) }),
      );
      expect(result.accessToken).toBe('mock.access.token');
    });

    it('should throw UnauthorizedException when user does not exist', async () => {
      mockAuthRepository.findUserByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user has no password hash (OAuth-only)', async () => {
      mockAuthRepository.findUserByEmail.mockResolvedValue({
        ...mockUser,
        passwordHash: null,
      } as unknown);

      await expect(
        service.login({ email: 'test@example.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password does not match', async () => {
      mockAuthRepository.findUserByEmail.mockResolvedValue(mockUser as unknown);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'test@example.com', password: 'wrongpass' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshToken', () => {
    it('should return new auth tokens for a valid refresh token', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-uuid-001' });
      mockAuthRepository.findRefreshToken.mockResolvedValue(
        mockRefreshTokenRecord as unknown,
      );
      mockAuthRepository.findUserById.mockResolvedValue(mockUser as unknown);

      const result = await service.refreshToken('mock.refresh.token');

      expect(mockJwtService.verify).toHaveBeenCalledWith(
        'mock.refresh.token',
        expect.objectContaining({ secret: expect.any(String) }),
      );
      expect(result.accessToken).toBe('mock.access.token');
    });

    it('should throw UnauthorizedException when token record is not found', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-uuid-001' });
      mockAuthRepository.findRefreshToken.mockResolvedValue(null);

      await expect(service.refreshToken('bad.token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when token has been revoked', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-uuid-001' });
      mockAuthRepository.findRefreshToken.mockResolvedValue({
        ...mockRefreshTokenRecord,
        isRevoked: true,
      } as unknown);

      await expect(service.refreshToken('revoked.token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when token is past its expiry date', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-uuid-001' });
      mockAuthRepository.findRefreshToken.mockResolvedValue({
        ...mockRefreshTokenRecord,
        expiresAt: new Date(Date.now() - 1000),
      } as unknown);

      await expect(service.refreshToken('expired.token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when jwt.verify throws', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt malformed');
      });

      await expect(service.refreshToken('invalid.token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should revoke all user sessions and return a success message', async () => {
      mockAuthRepository.revokeAllUserRefreshTokens.mockResolvedValue(
        undefined,
      );

      const result = await service.logout('user-uuid-001');

      expect(authRepository.revokeAllUserRefreshTokens).toHaveBeenCalledWith(
        'user-uuid-001',
      );
      expect(result.message).toContain('Logout successful');
    });
  });

  describe('sendOtp', () => {
    it('should invalidate old codes, create a new OTP and return expiry info', async () => {
      mockAuthRepository.invalidateOtpCodesForPhone.mockResolvedValue(
        undefined,
      );
      mockAuthRepository.findUserByPhone.mockResolvedValue(mockUser as unknown);
      mockAuthRepository.createOtpCode.mockResolvedValue(undefined);

      const result = await service.sendOtp({ phone: '+573001234567' });

      expect(authRepository.invalidateOtpCodesForPhone).toHaveBeenCalledWith(
        '+573001234567',
      );
      expect(authRepository.createOtpCode).toHaveBeenCalled();
      expect(result.expiresInSeconds).toBe(5 * 60);
      expect(result.message).toContain('+573001234567');
    });

    it('should create OTP without a userId when phone is not yet linked to a user', async () => {
      mockAuthRepository.invalidateOtpCodesForPhone.mockResolvedValue(
        undefined,
      );
      mockAuthRepository.findUserByPhone.mockResolvedValue(null);
      mockAuthRepository.createOtpCode.mockResolvedValue(undefined);

      await service.sendOtp({ phone: '+573009999999' });

      expect(authRepository.createOtpCode).toHaveBeenCalledWith(
        expect.objectContaining({ userId: undefined }),
      );
    });
  });

  describe('verifyOtpAndLogin', () => {
    const mockOtp = {
      id: 'otp-001',
      userId: 'user-uuid-001',
      phone: '+573001234567',
      attempts: 0,
    };

    it('should verify OTP, update lastLoginAt and return tokens for an existing user', async () => {
      mockAuthRepository.findValidOtpCode.mockResolvedValue(mockOtp);
      mockAuthRepository.incrementOtpAttempts.mockResolvedValue(undefined);
      mockAuthRepository.markOtpUsed.mockResolvedValue(undefined);
      mockAuthRepository.findUserByPhone.mockResolvedValue(mockUser as unknown);
      mockAuthRepository.updateUser.mockResolvedValue(mockUser as unknown);

      const result = await service.verifyOtpAndLogin({
        phone: '+573001234567',
        code: '123456',
      });

      expect(authRepository.incrementOtpAttempts).toHaveBeenCalledWith(
        'otp-001',
      );
      expect(authRepository.markOtpUsed).toHaveBeenCalledWith('otp-001');
      expect(result.accessToken).toBe('mock.access.token');
    });

    it('should create a new user when phone is not yet registered', async () => {
      mockAuthRepository.findValidOtpCode.mockResolvedValue(mockOtp);
      mockAuthRepository.incrementOtpAttempts.mockResolvedValue(undefined);
      mockAuthRepository.markOtpUsed.mockResolvedValue(undefined);
      mockAuthRepository.findUserByPhone.mockResolvedValue(null);
      mockAuthRepository.createUser.mockResolvedValue(mockUser as unknown);
      mockAuthRepository.updateUser.mockResolvedValue(mockUser as unknown);

      await service.verifyOtpAndLogin({
        phone: '+573001234567',
        code: '123456',
      });

      expect(authRepository.createUser).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when OTP code is invalid or expired', async () => {
      mockAuthRepository.findValidOtpCode.mockResolvedValue(null);

      await expect(
        service.verifyOtpAndLogin({ phone: '+573001234567', code: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when max attempts are exceeded', async () => {
      mockAuthRepository.findValidOtpCode.mockResolvedValue({
        ...mockOtp,
        attempts: 3,
      });
      mockAuthRepository.markOtpUsed.mockResolvedValue(undefined);

      await expect(
        service.verifyOtpAndLogin({ phone: '+573001234567', code: '123456' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('forgotPassword', () => {
    it('should create a reset token and return a generic message when the email is found', async () => {
      mockAuthRepository.findUserByEmail.mockResolvedValue(mockUser as unknown);
      mockAuthRepository.createPasswordResetToken.mockResolvedValue({
        id: 'reset-001',
        token: 'random-hex-token',
        expiresAt: new Date(),
      });

      const result = await service.forgotPassword({
        email: 'test@example.com',
      });

      expect(authRepository.createPasswordResetToken).toHaveBeenCalled();
      expect(result.message).toContain('If the email exists');
    });

    it('should return the same generic message when email is not found (no user exposure)', async () => {
      mockAuthRepository.findUserByEmail.mockResolvedValue(null);

      const result = await service.forgotPassword({
        email: 'nobody@example.com',
      });

      expect(authRepository.createPasswordResetToken).not.toHaveBeenCalled();
      expect(result.message).toContain('If the email exists');
    });

    it('should return generic message without creating token for OAuth-only accounts', async () => {
      mockAuthRepository.findUserByEmail.mockResolvedValue({
        ...mockUser,
        passwordHash: null,
      } as unknown);

      const result = await service.forgotPassword({
        email: 'oauth@example.com',
      });

      expect(authRepository.createPasswordResetToken).not.toHaveBeenCalled();
      expect(result.message).toContain('If the email exists');
    });
  });

  describe('resetPassword', () => {
    it('should update password hash and mark the token as used on success', async () => {
      mockAuthRepository.findValidPasswordResetToken.mockResolvedValue({
        id: 'reset-001',
        userId: 'user-uuid-001',
        expiresAt: new Date(Date.now() + 3_600_000),
      });
      mockAuthRepository.updateUser.mockResolvedValue(mockUser as unknown);
      mockAuthRepository.markPasswordResetTokenUsed.mockResolvedValue(
        undefined,
      );
      (mockedBcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$newhash');

      const result = await service.resetPassword({
        token: 'valid-token',
        newPassword: 'NewPass123!',
      });

      expect(authRepository.updateUser).toHaveBeenCalledWith(
        'user-uuid-001',
        expect.objectContaining({ passwordHash: '$2b$10$newhash' }),
      );
      expect(authRepository.markPasswordResetTokenUsed).toHaveBeenCalledWith(
        'reset-001',
      );
      expect(result.message).toContain('reset successfully');
    });

    it('should throw BadRequestException when the reset token is invalid or expired', async () => {
      mockAuthRepository.findValidPasswordResetToken.mockResolvedValue(null);

      await expect(
        service.resetPassword({
          token: 'expired-token',
          newPassword: 'NewPass123!',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('changePassword', () => {
    it('should update the password when the current password is correct', async () => {
      mockAuthRepository.findUserById.mockResolvedValue(mockUser as unknown);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);
      (mockedBcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$newhash');
      mockAuthRepository.updateUser.mockResolvedValue(mockUser as unknown);

      const result = await service.changePassword('user-uuid-001', {
        currentPassword: 'OldPass123!',
        newPassword: 'NewPass456!',
      });

      expect(authRepository.updateUser).toHaveBeenCalledWith(
        'user-uuid-001',
        expect.objectContaining({ passwordHash: '$2b$10$newhash' }),
      );
      expect(result.message).toContain('changed successfully');
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      mockAuthRepository.findUserById.mockResolvedValue(null);

      await expect(
        service.changePassword('nonexistent', {
          currentPassword: 'old',
          newPassword: 'new',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user has no password hash', async () => {
      mockAuthRepository.findUserById.mockResolvedValue({
        ...mockUser,
        passwordHash: null,
      } as unknown);

      await expect(
        service.changePassword('user-uuid-001', {
          currentPassword: 'old',
          newPassword: 'new',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when current password does not match', async () => {
      mockAuthRepository.findUserById.mockResolvedValue(mockUser as unknown);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword('user-uuid-001', {
          currentPassword: 'wrongpass',
          newPassword: 'new',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('handleGoogleOAuthCallback', () => {
    const googleProfile = {
      providerId: 'google-id-123',
      email: 'google@example.com',
      fullName: 'Google User',
      accessToken: 'google-access-token',
      refreshToken: 'google-refresh-token',
    };

    it('should return tokens for a returning Google user with existing OAuth account', async () => {
      const oauthAccount = {
        id: 'oauth-001',
        userId: 'user-uuid-001',
        provider: 'GOOGLE',
      };
      mockAuthRepository.findOAuthAccount.mockResolvedValue(
        oauthAccount as unknown,
      );
      mockAuthRepository.findUserById.mockResolvedValue(mockUser as unknown);
      mockAuthRepository.createOAuthAccount.mockResolvedValue(
        oauthAccount as unknown,
      );

      const result = await service.handleGoogleOAuthCallback(googleProfile);

      expect(result.accessToken).toBe('mock.access.token');
    });

    it('should throw UnauthorizedException when OAuth account exists but linked user is missing', async () => {
      const oauthAccount = {
        id: 'oauth-001',
        userId: 'deleted-user',
        provider: 'GOOGLE',
      };
      mockAuthRepository.findOAuthAccount.mockResolvedValue(
        oauthAccount as unknown,
      );
      mockAuthRepository.findUserById.mockResolvedValue(null);

      await expect(
        service.handleGoogleOAuthCallback(googleProfile),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should create a new user when there is no OAuth account and no matching email', async () => {
      mockAuthRepository.findOAuthAccount.mockResolvedValue(null);
      mockAuthRepository.findUserByEmail.mockResolvedValue(null);
      mockAuthRepository.createUser.mockResolvedValue(mockUser as unknown);
      mockAuthRepository.createOAuthAccount.mockResolvedValue({} as unknown);

      const result = await service.handleGoogleOAuthCallback(googleProfile);

      expect(authRepository.createUser).toHaveBeenCalled();
      expect(result.accessToken).toBe('mock.access.token');
    });

    it('should reuse an existing user when email matches but OAuth account is new', async () => {
      mockAuthRepository.findOAuthAccount.mockResolvedValue(null);
      mockAuthRepository.findUserByEmail.mockResolvedValue(mockUser as unknown);
      mockAuthRepository.createOAuthAccount.mockResolvedValue({} as unknown);

      const result = await service.handleGoogleOAuthCallback(googleProfile);

      expect(authRepository.createUser).not.toHaveBeenCalled();
      expect(result.accessToken).toBe('mock.access.token');
    });
  });

  describe('validateJwtPayload', () => {
    it('should return an enriched payload for an active user', async () => {
      mockAuthRepository.findUserById.mockResolvedValue({
        ...mockUser,
        status: 'ACTIVE',
      } as unknown);
      mockAuthRepository.getUserRoles.mockResolvedValue([RoleName.USER]);

      const result = await service.validateJwtPayload({
        sub: 'user-uuid-001',
        email: 'test@example.com',
        roles: [RoleName.USER],
      });

      expect(result.sub).toBe('user-uuid-001');
      expect(result.roles).toContain(RoleName.USER);
    });

    it('should throw UnauthorizedException when payload has no sub field', async () => {
      await expect(
        service.validateJwtPayload({ sub: '', email: '', roles: [] }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user status is not ACTIVE', async () => {
      mockAuthRepository.findUserById.mockResolvedValue({
        ...mockUser,
        status: 'SUSPENDED',
      } as unknown);

      await expect(
        service.validateJwtPayload({
          sub: 'user-uuid-001',
          email: '',
          roles: [],
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      mockAuthRepository.findUserById.mockResolvedValue(null);

      await expect(
        service.validateJwtPayload({ sub: 'missing-id', email: '', roles: [] }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getCurrentUser', () => {
    it('should return a full user profile including roles', async () => {
      const userWithRoles = {
        ...mockUser,
        roles: [{ role: { name: RoleName.USER } }],
      };
      mockAuthRepository.findUserWithRoles.mockResolvedValue(
        userWithRoles as unknown,
      );

      const result = await service.getCurrentUser('user-uuid-001');

      expect(result.id).toBe(mockUser.id);
      expect(result.roles).toContain(RoleName.USER);
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      mockAuthRepository.findUserWithRoles.mockResolvedValue(null);

      await expect(service.getCurrentUser('nonexistent')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return an empty roles array when user has no assigned roles', async () => {
      const userWithRoles = { ...mockUser, roles: [] };
      mockAuthRepository.findUserWithRoles.mockResolvedValue(
        userWithRoles as unknown,
      );

      const result = await service.getCurrentUser('user-uuid-001');

      expect(result.roles).toHaveLength(0);
    });
  });

  describe('revokeRefreshToken', () => {
    it('should delegate to the repository', async () => {
      mockAuthRepository.revokeRefreshToken.mockResolvedValue(undefined);

      await service.revokeRefreshToken('token-uuid-001');

      expect(authRepository.revokeRefreshToken).toHaveBeenCalledWith(
        'token-uuid-001',
      );
    });
  });

  describe('loginWithGoogleIdToken', () => {
    function buildMockGoogleClient(
      payloadOverrides: Record<string, unknown> = {},
    ) {
      const payload = {
        sub: 'google-sub-001',
        email: 'google@example.com',
        email_verified: true,
        name: 'Google User',
        picture: 'https://photo.url',
        iss: 'accounts.google.com',
        ...payloadOverrides,
      };
      return {
        verifyIdToken: jest
          .fn()
          .mockResolvedValue({ getPayload: () => payload }),
      };
    }

    beforeEach(() => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'oauth.google.clientId') return 'configured-client-id';
        return 'mock-secret';
      });
      process.env.GOOGLE_WEB_CLIENT_ID = 'web-client-id';
      process.env.GOOGLE_ANDROID_CLIENT_ID = '';
      process.env.GOOGLE_IOS_CLIENT_ID = '';
      process.env.GOOGLE_MOBILE_CLIENT_IDS = '';
    });

    it('should throw BadRequestException when idToken is empty', async () => {
      await expect(service.loginWithGoogleIdToken('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw UnauthorizedException when no audiences are configured', async () => {
      mockConfigService.get.mockReturnValue('');
      process.env.GOOGLE_WEB_CLIENT_ID = '';
      process.env.GOOGLE_ANDROID_CLIENT_ID = '';
      process.env.GOOGLE_IOS_CLIENT_ID = '';
      process.env.GOOGLE_MOBILE_CLIENT_IDS = '';

      await expect(
        service.loginWithGoogleIdToken('some-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when verifyIdToken throws', async () => {
      const mockClient = {
        verifyIdToken: jest.fn().mockRejectedValue(new Error('invalid token')),
      };
      (service as unknown as Record<string, unknown>)['googleOAuthClient'] =
        mockClient;

      await expect(service.loginWithGoogleIdToken('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when payload is missing sub', async () => {
      const mockClient = buildMockGoogleClient({ sub: undefined });
      (service as unknown as Record<string, unknown>)['googleOAuthClient'] =
        mockClient;

      await expect(
        service.loginWithGoogleIdToken('valid-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when email is not verified', async () => {
      const mockClient = buildMockGoogleClient({ email_verified: false });
      (service as unknown as Record<string, unknown>)['googleOAuthClient'] =
        mockClient;

      await expect(
        service.loginWithGoogleIdToken('valid-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when issuer is invalid', async () => {
      const mockClient = buildMockGoogleClient({ iss: 'evil.com' });
      (service as unknown as Record<string, unknown>)['googleOAuthClient'] =
        mockClient;

      await expect(
        service.loginWithGoogleIdToken('valid-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should succeed and return auth response for a valid token (new user)', async () => {
      const mockClient = buildMockGoogleClient();
      (service as unknown as Record<string, unknown>)['googleOAuthClient'] =
        mockClient;

      mockAuthRepository.findOAuthAccount.mockResolvedValue(null);
      mockAuthRepository.findUserByEmail.mockResolvedValue(null);
      mockAuthRepository.createUser.mockResolvedValue(mockUser as unknown);
      mockAuthRepository.createOAuthAccount.mockResolvedValue(undefined);
      mockAuthRepository.assignRoleToUser.mockResolvedValue(undefined);
      mockAuthRepository.getUserRoles.mockResolvedValue([RoleName.USER]);
      mockAuthRepository.createRefreshToken.mockResolvedValue(
        mockRefreshTokenRecord as unknown,
      );
      mockJwtService.sign.mockReturnValue('access.token');

      const result = await service.loginWithGoogleIdToken('valid-token');

      expect(result.accessToken).toBeDefined();
    });
  });
});
