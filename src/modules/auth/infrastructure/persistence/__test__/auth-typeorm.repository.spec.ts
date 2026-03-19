import { Test, TestingModule } from '@nestjs/testing';
import {
  OAuthAccountEntity,
  OtpCodeEntity,
  PasswordResetTokenEntity,
  RefreshTokenEntity,
  RoleEntity,
  UserEntity,
  UserRoleEntity,
} from '@/database/entities';
import { AuthProvider, RoleName, UserStatus } from '@/database/enums';
import { TenantContext, TenantDataSourceService } from '@/tenant';
import { AuthTypeOrmRepository } from '../auth-typeorm.repository';

function makeRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    increment: jest.fn(),
    ...overrides,
  };
}

function makeUserEntity(partial: Partial<UserEntity> = {}): UserEntity {
  return {
    id: 'user-1',
    email: 'test@example.com',
    fullName: 'Test User',
    passwordHash: 'hash',
    phoneNumber: null,
    documentId: null,
    profilePhotoUrl: null,
    skills: [],
    currentLatitude: null,
    currentLongitude: null,
    lastLocationUpdate: null,
    status: UserStatus.ACTIVE,
    emailVerified: false,
    phoneVerified: false,
    primaryRole: RoleName.USER,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null,
    deletedAt: null,
    roles: [],
    oauthAccounts: [],
    refreshTokens: [],
    passwordResetTokens: [],
    otpCodes: [],
    providerProfile: null as unknown,
    addresses: [],
    serviceRequests: [],
    assignedRequests: [],
    payments: [],
    ratingsGiven: [],
    ratingsReceived: [],
    notifications: [],
    auditLogs: [],
    chatMessages: [],
    subscriptions: [],
    technicianResponses: [],
    ...partial,
  };
}

describe('AuthTypeOrmRepository', () => {
  let repository: AuthTypeOrmRepository;
  let tenantContext: jest.Mocked<TenantContext>;
  let tenantDataSourceService: jest.Mocked<TenantDataSourceService>;
  let userRepo: ReturnType<typeof makeRepo>;
  let oauthRepo: ReturnType<typeof makeRepo>;
  let refreshRepo: ReturnType<typeof makeRepo>;
  let roleRepo: ReturnType<typeof makeRepo>;
  let userRoleRepo: ReturnType<typeof makeRepo>;
  let passwordResetRepo: ReturnType<typeof makeRepo>;
  let otpRepo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    userRepo = makeRepo();
    oauthRepo = makeRepo();
    refreshRepo = makeRepo();
    roleRepo = makeRepo();
    userRoleRepo = makeRepo();
    passwordResetRepo = makeRepo();
    otpRepo = makeRepo();

    const mockDataSource = {
      getRepository: jest.fn((entity: new () => unknown) => {
        if (entity === UserEntity) return userRepo;
        if (entity === OAuthAccountEntity) return oauthRepo;
        if (entity === RefreshTokenEntity) return refreshRepo;
        if (entity === RoleEntity) return roleRepo;
        if (entity === UserRoleEntity) return userRoleRepo;
        if (entity === PasswordResetTokenEntity) return passwordResetRepo;
        if (entity === OtpCodeEntity) return otpRepo;
        throw new Error(`Unknown entity: ${entity}`);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthTypeOrmRepository,
        {
          provide: TenantContext,
          useValue: {
            getTenantId: jest.fn().mockReturnValue('public'),
          },
        },
        {
          provide: TenantDataSourceService,
          useValue: {
            getDataSource: jest.fn().mockResolvedValue(mockDataSource),
          },
        },
      ],
    }).compile();

    repository = module.get(AuthTypeOrmRepository);
    tenantContext = module.get(TenantContext);
    tenantDataSourceService = module.get(TenantDataSourceService);
  });

  describe('findUserByEmail', () => {
    it('returns the user when found', async () => {
      const user = makeUserEntity();
      userRepo.findOne.mockResolvedValue(user);

      const result = await repository.findUserByEmail('test@example.com');

      expect(result).toBe(user);
      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('returns null when not found', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const result = await repository.findUserByEmail('missing@example.com');
      expect(result).toBeNull();
    });
  });

  describe('findUserById', () => {
    it('returns the user when found', async () => {
      const user = makeUserEntity();
      userRepo.findOne.mockResolvedValue(user);

      const result = await repository.findUserById('user-1');

      expect(result).toBe(user);
      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
    });

    it('returns null when user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const result = await repository.findUserById('no-such-user');
      expect(result).toBeNull();
    });
  });

  describe('findUserWithRoles', () => {
    it('returns the user with roles when found', async () => {
      const user = makeUserEntity();
      userRepo.findOne.mockResolvedValue(user);

      const result = await repository.findUserWithRoles('user-1');

      expect(result).toBe(user);
      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        relations: ['roles', 'roles.role'],
      });
    });

    it('returns null when user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const result = await repository.findUserWithRoles('missing');
      expect(result).toBeNull();
    });
  });

  describe('createUser', () => {
    it('creates, saves and assigns default role', async () => {
      const user = makeUserEntity({ id: 'new-user' });
      userRepo.create.mockReturnValue(user);
      userRepo.save.mockResolvedValue(user);
      const roleEntity: Partial<RoleEntity> = {
        id: 'role-id',
        name: RoleName.USER,
      };
      roleRepo.findOne.mockResolvedValue(roleEntity);
      userRoleRepo.findOne.mockResolvedValue(null);
      const userRoleEntity: Partial<UserRoleEntity> = {
        userId: user.id,
        roleId: 'role-id',
      };
      userRoleRepo.create.mockReturnValue(userRoleEntity);
      userRoleRepo.save.mockResolvedValue(userRoleEntity);

      const result = await repository.createUser({
        email: 'new@example.com',
        fullName: 'New User',
        passwordHash: 'hashed',
      });

      expect(result).toBe(user);
      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          status: UserStatus.ACTIVE,
        }),
      );
      expect(userRepo.save).toHaveBeenCalledWith(user);
      expect(userRoleRepo.save).toHaveBeenCalledWith(userRoleEntity);
    });

    it('uses defaults for optional fields', async () => {
      const user = makeUserEntity({
        id: 'u2',
        passwordHash: null,
        phoneNumber: null,
        emailVerified: false,
      });
      userRepo.create.mockReturnValue(user);
      userRepo.save.mockResolvedValue(user);

      const roleEntity: Partial<RoleEntity> = {
        id: 'role-id',
        name: RoleName.USER,
      };
      roleRepo.findOne.mockResolvedValue(roleEntity);
      userRoleRepo.findOne.mockResolvedValue(null);
      userRoleRepo.create.mockReturnValue({});
      userRoleRepo.save.mockResolvedValue({});

      await repository.createUser({ email: 'a@b.com', fullName: 'Minimal' });

      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          passwordHash: null,
          phoneNumber: null,
          emailVerified: false,
        }),
      );
    });
  });

  describe('updateUser', () => {
    it('updates and returns the updated user', async () => {
      const updatedUser = makeUserEntity({ emailVerified: true });
      userRepo.update.mockResolvedValue({ affected: 1 });
      userRepo.findOneOrFail.mockResolvedValue(updatedUser);

      const result = await repository.updateUser('user-1', {
        emailVerified: true,
      });

      expect(userRepo.update).toHaveBeenCalledWith('user-1', {
        emailVerified: true,
      });
      expect(userRepo.findOneOrFail).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(result).toBe(updatedUser);
    });

    it('propagates error when findOneOrFail throws', async () => {
      userRepo.update.mockResolvedValue({ affected: 0 });
      userRepo.findOneOrFail.mockRejectedValue(new Error('Entity not found'));

      await expect(repository.updateUser('bad-id', {})).rejects.toThrow(
        'Entity not found',
      );
    });
  });

  describe('findUserByPhone', () => {
    it('returns user when phone matches', async () => {
      const user = makeUserEntity({ phoneNumber: '+57123' });
      userRepo.findOne.mockResolvedValue(user);

      const result = await repository.findUserByPhone('+57123');

      expect(result).toBe(user);
      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { phoneNumber: '+57123' },
      });
    });

    it('returns null when phone not found', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const result = await repository.findUserByPhone('+000');
      expect(result).toBeNull();
    });
  });

  describe('findOAuthAccount', () => {
    it('returns oauth account when found', async () => {
      const oauthAccount: Partial<OAuthAccountEntity> = {
        id: 'oa-1',
        provider: AuthProvider.GOOGLE,
        providerUserId: 'g-123',
      };
      oauthRepo.findOne.mockResolvedValue(oauthAccount);

      const result = await repository.findOAuthAccount('GOOGLE', 'g-123');

      expect(result).toBe(oauthAccount);
      expect(oauthRepo.findOne).toHaveBeenCalledWith({
        where: { provider: AuthProvider.GOOGLE, providerUserId: 'g-123' },
        relations: ['user'],
      });
    });

    it('returns null when not found', async () => {
      oauthRepo.findOne.mockResolvedValue(null);
      const result = await repository.findOAuthAccount('GOOGLE', 'unknown');
      expect(result).toBeNull();
    });
  });

  describe('createOAuthAccount', () => {
    it('creates and saves an oauth account', async () => {
      const account: Partial<OAuthAccountEntity> = { id: 'oa-2' };
      oauthRepo.create.mockReturnValue(account);
      oauthRepo.save.mockResolvedValue(account);

      const result = await repository.createOAuthAccount({
        userId: 'user-1',
        provider: 'GOOGLE',
        providerUserId: 'g-456',
        accessToken: 'at',
        refreshToken: 'rt',
      });

      expect(result).toBe(account);
      expect(oauthRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: AuthProvider.GOOGLE,
          providerUserId: 'g-456',
          accessToken: 'at',
          refreshToken: 'rt',
        }),
      );
    });

    it('uses null defaults for optional token fields', async () => {
      const account: Partial<OAuthAccountEntity> = { id: 'oa-3' };
      oauthRepo.create.mockReturnValue(account);
      oauthRepo.save.mockResolvedValue(account);

      await repository.createOAuthAccount({
        userId: 'user-1',
        provider: 'GOOGLE',
        providerUserId: 'g-789',
      });

      expect(oauthRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: null,
          refreshToken: null,
          expiresAt: null,
        }),
      );
    });
  });

  describe('findRefreshToken', () => {
    it('returns token when found', async () => {
      const token: Partial<RefreshTokenEntity> = { id: 'rt-1', token: 'tok' };
      refreshRepo.findOne.mockResolvedValue(token);

      const result = await repository.findRefreshToken('tok');

      expect(result).toBe(token);
      expect(refreshRepo.findOne).toHaveBeenCalledWith({
        where: { token: 'tok' },
        relations: ['user'],
      });
    });

    it('returns null when not found', async () => {
      refreshRepo.findOne.mockResolvedValue(null);
      const result = await repository.findRefreshToken('bad-tok');
      expect(result).toBeNull();
    });
  });

  describe('createRefreshToken', () => {
    it('creates and saves a refresh token', async () => {
      const rt: Partial<RefreshTokenEntity> = { id: 'rt-2' };
      refreshRepo.create.mockReturnValue(rt);
      refreshRepo.save.mockResolvedValue(rt);

      const expiresAt = new Date(Date.now() + 86400000);
      const result = await repository.createRefreshToken({
        userId: 'user-1',
        token: 'new-tok',
        expiresAt,
        userAgent: 'Mozilla',
        ipAddress: '127.0.0.1',
      });

      expect(result).toBe(rt);
      expect(refreshRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          token: 'new-tok',
          expiresAt,
          isRevoked: false,
          userAgent: 'Mozilla',
          ipAddress: '127.0.0.1',
        }),
      );
    });

    it('defaults optional fields to null', async () => {
      const rt: Partial<RefreshTokenEntity> = { id: 'rt-3' };
      refreshRepo.create.mockReturnValue(rt);
      refreshRepo.save.mockResolvedValue(rt);

      await repository.createRefreshToken({
        userId: 'user-1',
        token: 'tok-2',
        expiresAt: new Date(),
      });

      expect(refreshRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userAgent: null, ipAddress: null }),
      );
    });
  });

  describe('revokeRefreshToken', () => {
    it('updates isRevoked to true', async () => {
      refreshRepo.update.mockResolvedValue({ affected: 1 });

      await repository.revokeRefreshToken('rt-1');

      expect(refreshRepo.update).toHaveBeenCalledWith('rt-1', {
        isRevoked: true,
      });
    });
  });

  describe('revokeAllUserRefreshTokens', () => {
    it('revokes all active tokens for a user', async () => {
      refreshRepo.update.mockResolvedValue({ affected: 3 });

      await repository.revokeAllUserRefreshTokens('user-1');

      expect(refreshRepo.update).toHaveBeenCalledWith(
        { userId: 'user-1', isRevoked: false },
        { isRevoked: true },
      );
    });
  });

  describe('assignRoleToUser', () => {
    it('assigns role when role exists and user does not have it', async () => {
      const role: Partial<RoleEntity> = { id: 'role-id', name: RoleName.ADMIN };
      roleRepo.findOne.mockResolvedValue(role);
      userRoleRepo.findOne.mockResolvedValue(null);
      const userRole: Partial<UserRoleEntity> = {
        userId: 'user-1',
        roleId: 'role-id',
      };
      userRoleRepo.create.mockReturnValue(userRole);
      userRoleRepo.save.mockResolvedValue(userRole);

      await repository.assignRoleToUser('user-1', RoleName.ADMIN);

      expect(userRoleRepo.save).toHaveBeenCalledWith(userRole);
    });

    it('skips save when user already has the role', async () => {
      const role: Partial<RoleEntity> = { id: 'role-id', name: RoleName.USER };
      roleRepo.findOne.mockResolvedValue(role);
      const existing: Partial<UserRoleEntity> = {
        userId: 'user-1',
        roleId: 'role-id',
      };
      userRoleRepo.findOne.mockResolvedValue(existing);

      await repository.assignRoleToUser('user-1', RoleName.USER);

      expect(userRoleRepo.save).not.toHaveBeenCalled();
    });

    it('throws when role does not exist', async () => {
      roleRepo.findOne.mockResolvedValue(null);

      await expect(
        repository.assignRoleToUser('user-1', 'NONEXISTENT'),
      ).rejects.toThrow('Role NONEXISTENT not found');
    });
  });

  describe('getUserRoles', () => {
    it('returns role names for the user', async () => {
      const userRoles = [
        { role: { name: RoleName.USER } },
        { role: { name: RoleName.PROVIDER } },
      ] as UserRoleEntity[];
      userRoleRepo.find.mockResolvedValue(userRoles);

      const result = await repository.getUserRoles('user-1');

      expect(result).toEqual([RoleName.USER, RoleName.PROVIDER]);
      expect(userRoleRepo.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        relations: ['role'],
      });
    });

    it('returns empty array when user has no roles', async () => {
      userRoleRepo.find.mockResolvedValue([]);
      const result = await repository.getUserRoles('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('createPasswordResetToken', () => {
    it('creates and saves a password reset token', async () => {
      const entity: Partial<PasswordResetTokenEntity> = { id: 'prt-1' };
      passwordResetRepo.create.mockReturnValue(entity);
      passwordResetRepo.save.mockResolvedValue(entity);

      const expiresAt = new Date(Date.now() + 3600000);
      const result = await repository.createPasswordResetToken({
        userId: 'user-1',
        token: 'reset-tok',
        expiresAt,
      });

      expect(result).toBe(entity);
      expect(passwordResetRepo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        token: 'reset-tok',
        expiresAt,
      });
    });
  });

  describe('findValidPasswordResetToken', () => {
    it('returns token data when token is valid and not expired', async () => {
      const future = new Date(Date.now() + 3600000);
      const record: Partial<PasswordResetTokenEntity> = {
        id: 'prt-1',
        userId: 'user-1',
        expiresAt: future,
        usedAt: null,
      };
      passwordResetRepo.findOne.mockResolvedValue(record);

      const result = await repository.findValidPasswordResetToken('reset-tok');

      expect(result).toEqual({
        id: 'prt-1',
        userId: 'user-1',
        expiresAt: future,
      });
    });

    it('returns null when record not found', async () => {
      passwordResetRepo.findOne.mockResolvedValue(null);
      const result = await repository.findValidPasswordResetToken('bad-tok');
      expect(result).toBeNull();
    });

    it('returns null when token has already been used', async () => {
      const record: Partial<PasswordResetTokenEntity> = {
        id: 'prt-2',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: new Date(),
      };
      passwordResetRepo.findOne.mockResolvedValue(record);
      const result = await repository.findValidPasswordResetToken('used-tok');
      expect(result).toBeNull();
    });

    it('returns null when token is expired', async () => {
      const past = new Date(Date.now() - 1000);
      const record: Partial<PasswordResetTokenEntity> = {
        id: 'prt-3',
        userId: 'user-1',
        expiresAt: past,
        usedAt: null,
      };
      passwordResetRepo.findOne.mockResolvedValue(record);
      const result =
        await repository.findValidPasswordResetToken('expired-tok');
      expect(result).toBeNull();
    });
  });

  describe('markPasswordResetTokenUsed', () => {
    it('updates usedAt field', async () => {
      passwordResetRepo.update.mockResolvedValue({ affected: 1 });

      await repository.markPasswordResetTokenUsed('prt-1');

      expect(passwordResetRepo.update).toHaveBeenCalledWith(
        'prt-1',
        expect.objectContaining({ usedAt: expect.any(Date) }),
      );
    });
  });

  describe('createOtpCode', () => {
    it('creates and saves an OTP record', async () => {
      const entity: Partial<OtpCodeEntity> = { id: 'otp-1' };
      otpRepo.create.mockReturnValue(entity);
      otpRepo.save.mockResolvedValue(entity);

      const expiresAt = new Date(Date.now() + 300000);
      await repository.createOtpCode({
        userId: 'user-1',
        phone: '+57123',
        code: '123456',
        expiresAt,
      });

      expect(otpRepo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        phone: '+57123',
        code: '123456',
        expiresAt,
      });
      expect(otpRepo.save).toHaveBeenCalledWith(entity);
    });

    it('sets userId to null when not provided', async () => {
      const entity: Partial<OtpCodeEntity> = { id: 'otp-2' };
      otpRepo.create.mockReturnValue(entity);
      otpRepo.save.mockResolvedValue(entity);

      await repository.createOtpCode({
        phone: '+57999',
        code: '654321',
        expiresAt: new Date(),
      });

      expect(otpRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: null }),
      );
    });
  });

  describe('findValidOtpCode', () => {
    it('returns otp data when valid and not expired', async () => {
      const future = new Date(Date.now() + 300000);
      const record: Partial<OtpCodeEntity> = {
        id: 'otp-1',
        userId: 'user-1',
        phone: '+57123',
        code: '123456',
        expiresAt: future,
        attempts: 0,
        usedAt: null,
      };
      otpRepo.findOne.mockResolvedValue(record);

      const result = await repository.findValidOtpCode('+57123', '123456');

      expect(result).toEqual({
        id: 'otp-1',
        userId: 'user-1',
        phone: '+57123',
        attempts: 0,
      });
    });

    it('returns null when record not found', async () => {
      otpRepo.findOne.mockResolvedValue(null);
      const result = await repository.findValidOtpCode('+57000', '000000');
      expect(result).toBeNull();
    });

    it('returns null when otp is expired', async () => {
      const past = new Date(Date.now() - 1000);
      const record: Partial<OtpCodeEntity> = {
        id: 'otp-2',
        userId: null,
        phone: '+57123',
        code: '999999',
        expiresAt: past,
        attempts: 1,
        usedAt: null,
      };
      otpRepo.findOne.mockResolvedValue(record);
      const result = await repository.findValidOtpCode('+57123', '999999');
      expect(result).toBeNull();
    });
  });

  describe('incrementOtpAttempts', () => {
    it('increments the attempts counter', async () => {
      otpRepo.increment.mockResolvedValue({ affected: 1 });

      await repository.incrementOtpAttempts('otp-1');

      expect(otpRepo.increment).toHaveBeenCalledWith(
        { id: 'otp-1' },
        'attempts',
        1,
      );
    });
  });

  describe('markOtpUsed', () => {
    it('updates usedAt for the otp record', async () => {
      otpRepo.update.mockResolvedValue({ affected: 1 });

      await repository.markOtpUsed('otp-1');

      expect(otpRepo.update).toHaveBeenCalledWith(
        'otp-1',
        expect.objectContaining({ usedAt: expect.any(Date) }),
      );
    });
  });

  describe('invalidateOtpCodesForPhone', () => {
    it('marks all unused codes for a phone as used', async () => {
      otpRepo.update.mockResolvedValue({ affected: 2 });

      await repository.invalidateOtpCodesForPhone('+57123');

      expect(otpRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ phone: '+57123' }),
        expect.objectContaining({ usedAt: expect.any(Date) }),
      );
    });
  });

  describe('tenantContext fallback', () => {
    it('falls back to public schema when getTenantId returns undefined', async () => {
      tenantContext.getTenantId.mockReturnValue(undefined as unknown);

      userRepo.findOne.mockResolvedValue(null);
      await repository.findUserById('any');

      expect(tenantDataSourceService.getDataSource).toHaveBeenCalledWith(
        'public',
      );
    });
  });
});
