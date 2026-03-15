import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProviderProfileEntity, UserEntity } from '@/database/entities';
import { ProviderVerificationStatus, RoleName } from '@/database/enums';
import { TENANT_DATA_SOURCE } from '@/tenant/tenant-datasource.provider';
import { AUTH_REPOSITORY } from '../../../../auth/domain/repositories';
import type { IAuthRepository } from '../../../../auth/domain/repositories';
import { ProviderProfileService } from '../provider-profile.service';
import { VerificationAction } from '../../dtos/verify-provider.dto';

// ─── helpers ──────────────────────────────────────────────────────────────────

function buildMockRepo() {
  return {
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };
}

// ─── fixtures ─────────────────────────────────────────────────────────────────

const USER_ID = 'user-uuid-001';
const PROFILE_ID = 'profile-uuid-001';

const mockProviderProfile = {
  id: PROFILE_ID,
  userId: USER_ID,
  bio: 'Experienced plumber',
  verificationStatus: ProviderVerificationStatus.UNVERIFIED,
  averageRating: 0,
  totalRatings: 0,
  totalCompletedServices: 0,
  totalCancelledServices: 0,
  isAvailable: false,
  currentLatitude: null,
  currentLongitude: null,
  coverageRadiusKm: 10,
  nequiNumber: null,
  daviplataNumber: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  user: { id: USER_ID, skills: ['plomeria'] },
};

const mockUserEntity = { id: USER_ID, skills: ['plomeria'] };

// ─── suite ────────────────────────────────────────────────────────────────────

describe('ProviderProfileService', () => {
  let service: ProviderProfileService;
  let profileRepo: ReturnType<typeof buildMockRepo>;
  let userRepo: ReturnType<typeof buildMockRepo>;
  let authRepository: jest.Mocked<IAuthRepository>;

  const mockAuthRepository: jest.Mocked<IAuthRepository> = {
    findUserByEmail: jest.fn(),
    findUserById: jest.fn(),
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

  beforeEach(async () => {
    profileRepo = buildMockRepo();
    userRepo = buildMockRepo();

    const repoMap = new Map<unknown, ReturnType<typeof buildMockRepo>>([
      [ProviderProfileEntity, profileRepo],
      [UserEntity, userRepo],
    ]);

    const mockDataSource = {
      getRepository: jest.fn((entity: unknown) => repoMap.get(entity) ?? buildMockRepo()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderProfileService,
        { provide: TENANT_DATA_SOURCE, useValue: mockDataSource },
        { provide: AUTH_REPOSITORY, useValue: mockAuthRepository },
      ],
    }).compile();

    service = module.get<ProviderProfileService>(ProviderProfileService);
    authRepository = module.get(AUTH_REPOSITORY);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── create ─────────────────────────────────────────────────────────────

  describe('create', () => {
    const createDto = {
      bio: 'Experienced plumber',
      coverageRadiusKm: 15,
      isAvailable: true,
      skills: ['plomeria', 'gas'],
    };

    it('should create a provider profile, update user skills and assign PROVIDER role', async () => {
      profileRepo.findOne.mockResolvedValue(null);
      profileRepo.create.mockReturnValue(mockProviderProfile);
      profileRepo.save.mockResolvedValue(mockProviderProfile);
      userRepo.update.mockResolvedValue({});
      mockAuthRepository.assignRoleToUser.mockResolvedValue(undefined);

      const result = await service.create(USER_ID, createDto);

      expect(profileRepo.save).toHaveBeenCalled();
      expect(userRepo.update).toHaveBeenCalledWith(USER_ID, { skills: createDto.skills });
      expect(authRepository.assignRoleToUser).toHaveBeenCalledWith(USER_ID, RoleName.PROVIDER);
      expect(result.userId).toBe(USER_ID);
    });

    it('should create a profile without updating skills when none are provided', async () => {
      profileRepo.findOne.mockResolvedValue(null);
      profileRepo.create.mockReturnValue(mockProviderProfile);
      profileRepo.save.mockResolvedValue(mockProviderProfile);
      mockAuthRepository.assignRoleToUser.mockResolvedValue(undefined);

      await service.create(USER_ID, { bio: 'No skills provided' });

      expect(userRepo.update).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when a profile already exists for the user', async () => {
      profileRepo.findOne.mockResolvedValue(mockProviderProfile);

      await expect(service.create(USER_ID, createDto)).rejects.toThrow(ConflictException);

      expect(profileRepo.save).not.toHaveBeenCalled();
    });
  });

  // ─── findByUserId ────────────────────────────────────────────────────────

  describe('findByUserId', () => {
    it('should return the provider profile for an existing user', async () => {
      profileRepo.findOne.mockResolvedValue(mockProviderProfile);

      const result = await service.findByUserId(USER_ID);

      expect(profileRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: USER_ID } }),
      );
      expect(result.userId).toBe(USER_ID);
    });

    it('should throw NotFoundException when no profile exists for the user', async () => {
      profileRepo.findOne.mockResolvedValue(null);

      await expect(service.findByUserId('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should use an empty skills array when the related user entity has no skills', async () => {
      profileRepo.findOne.mockResolvedValue({ ...mockProviderProfile, user: null });

      const result = await service.findByUserId(USER_ID);

      expect(result.skills).toEqual([]);
    });
  });

  // ─── update ──────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update profile fields and return the updated profile', async () => {
      const updateDto = { bio: 'Updated bio', isAvailable: true };
      const updatedProfile = { ...mockProviderProfile, bio: 'Updated bio', isAvailable: true };

      profileRepo.findOne.mockResolvedValue(mockProviderProfile);
      profileRepo.update.mockResolvedValue({});
      profileRepo.findOneOrFail.mockResolvedValue(updatedProfile);
      userRepo.findOne.mockResolvedValue(mockUserEntity);

      const result = await service.update(USER_ID, updateDto);

      expect(profileRepo.update).toHaveBeenCalledWith(
        { userId: USER_ID },
        expect.objectContaining({ bio: 'Updated bio', isAvailable: true }),
      );
      expect(result.bio).toBe('Updated bio');
    });

    it('should update user skills when skills are included in the dto', async () => {
      const updateDto = { skills: ['electricidad', 'gas'] };

      profileRepo.findOne.mockResolvedValue(mockProviderProfile);
      profileRepo.update.mockResolvedValue({});
      profileRepo.findOneOrFail.mockResolvedValue(mockProviderProfile);
      userRepo.update.mockResolvedValue({});
      userRepo.findOneOrFail.mockResolvedValue({ ...mockUserEntity, skills: updateDto.skills });

      await service.update(USER_ID, updateDto);

      expect(userRepo.update).toHaveBeenCalledWith(USER_ID, { skills: updateDto.skills });
    });

    it('should update location fields and set lastLocationUpdate when coordinates change', async () => {
      const updateDto = { currentLatitude: 4.6, currentLongitude: -74.08 };

      profileRepo.findOne.mockResolvedValue(mockProviderProfile);
      profileRepo.update.mockResolvedValue({});
      profileRepo.findOneOrFail.mockResolvedValue(mockProviderProfile);
      userRepo.findOne.mockResolvedValue(mockUserEntity);

      await service.update(USER_ID, updateDto);

      const callArg = profileRepo.update.mock.calls[0][1];
      expect(callArg.currentLatitude).toBe(4.6);
      expect(callArg.lastLocationUpdate).toBeInstanceOf(Date);
    });

    it('should throw NotFoundException when the profile does not exist', async () => {
      profileRepo.findOne.mockResolvedValue(null);

      await expect(service.update('nonexistent', { bio: 'new bio' })).rejects.toThrow(NotFoundException);
    });
  });

  // ─── verifyProvider ──────────────────────────────────────────────────────

  describe('verifyProvider', () => {
    it('should set verification status to VERIFIED when action is APPROVE', async () => {
      profileRepo.findOne.mockResolvedValue(mockProviderProfile);
      profileRepo.update.mockResolvedValue({});
      profileRepo.findOneOrFail.mockResolvedValue({
        ...mockProviderProfile,
        verificationStatus: ProviderVerificationStatus.VERIFIED,
      });

      const result = await service.verifyProvider(USER_ID, VerificationAction.APPROVE);

      expect(profileRepo.update).toHaveBeenCalledWith(
        { userId: USER_ID },
        { verificationStatus: ProviderVerificationStatus.VERIFIED },
      );
      expect(result.verificationStatus).toBe(ProviderVerificationStatus.VERIFIED);
    });

    it('should set verification status to REJECTED when action is REJECT', async () => {
      profileRepo.findOne.mockResolvedValue(mockProviderProfile);
      profileRepo.update.mockResolvedValue({});
      profileRepo.findOneOrFail.mockResolvedValue({
        ...mockProviderProfile,
        verificationStatus: ProviderVerificationStatus.REJECTED,
      });

      const result = await service.verifyProvider(USER_ID, VerificationAction.REJECT);

      expect(profileRepo.update).toHaveBeenCalledWith(
        { userId: USER_ID },
        { verificationStatus: ProviderVerificationStatus.REJECTED },
      );
      expect(result.verificationStatus).toBe(ProviderVerificationStatus.REJECTED);
    });

    it('should set verification status to SUSPENDED when action is SUSPEND', async () => {
      profileRepo.findOne.mockResolvedValue(mockProviderProfile);
      profileRepo.update.mockResolvedValue({});
      profileRepo.findOneOrFail.mockResolvedValue({
        ...mockProviderProfile,
        verificationStatus: ProviderVerificationStatus.SUSPENDED,
      });

      const result = await service.verifyProvider(USER_ID, VerificationAction.SUSPEND);

      expect(profileRepo.update).toHaveBeenCalledWith(
        { userId: USER_ID },
        { verificationStatus: ProviderVerificationStatus.SUSPENDED },
      );
      expect(result.verificationStatus).toBe(ProviderVerificationStatus.SUSPENDED);
    });

    it('should throw NotFoundException when no profile exists for the provider', async () => {
      profileRepo.findOne.mockResolvedValue(null);

      await expect(
        service.verifyProvider('nonexistent', VerificationAction.APPROVE),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
