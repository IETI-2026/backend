import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { ProviderProfileEntity, UserEntity } from '@/database/entities';
import { ProviderVerificationStatus, RoleName } from '@/database/enums';
import { TENANT_DATA_SOURCE, TenantContext } from '@/tenant';
import type { IAuthRepository } from '../../../../auth/domain/repositories';
import { AUTH_REPOSITORY } from '../../../../auth/domain/repositories';
import { VerificationAction } from '../../dtos/verify-provider.dto';
import { ProviderProfileService } from '../provider-profile.service';

function buildMockRepo() {
  return {
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };
}

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

  nequiNumber: null,
  daviplataNumber: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  user: { id: USER_ID, skills: ['plomeria'] },
};

const mockUserEntity = { id: USER_ID, skills: ['plomeria'] };

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
      getRepository: jest.fn(
        (entity: unknown) => repoMap.get(entity) ?? buildMockRepo(),
      ),
    };

    const mockCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'cache') {
          return {
            ttls: {
              provider_rating: 3600 * 4,
              user_profile: 1800,
            },
            ttl: 300,
          };
        }
        if (key === 'externalServices') {
          return {
            skillSuggestionEndpointUrl:
              'https://example.com/api/skill-suggestions',
            documentVerificationUrl:
              'https://example.com/api/document-verification',
          };
        }
        return undefined;
      }),
    };

    const mockTenantContext = {
      getTenantId: jest.fn().mockReturnValue('public'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderProfileService,
        { provide: TENANT_DATA_SOURCE, useValue: mockDataSource },
        { provide: AUTH_REPOSITORY, useValue: mockAuthRepository },
        {
          provide: HttpService,
          useValue: { axiosRef: { post: jest.fn() } },
        },
        { provide: CACHE_MANAGER, useValue: mockCache },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: TenantContext, useValue: mockTenantContext },
      ],
    }).compile();

    service = module.get<ProviderProfileService>(ProviderProfileService);
    authRepository = module.get(AUTH_REPOSITORY);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      bio: 'Experienced plumber',

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
      expect(userRepo.update).toHaveBeenCalledWith(USER_ID, {
        skills: createDto.skills,
      });
      expect(authRepository.assignRoleToUser).toHaveBeenCalledWith(
        USER_ID,
        RoleName.PROVIDER,
      );
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

      await expect(service.create(USER_ID, createDto)).rejects.toThrow(
        ConflictException,
      );

      expect(profileRepo.save).not.toHaveBeenCalled();
    });
  });

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

      await expect(service.findByUserId('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should use an empty skills array when the related user entity has no skills', async () => {
      profileRepo.findOne.mockResolvedValue({
        ...mockProviderProfile,
        user: null,
      });

      const result = await service.findByUserId(USER_ID);

      expect(result.skills).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update profile fields and return the updated profile', async () => {
      const updateDto = { bio: 'Updated bio', isAvailable: true };
      const verifiedProfile = {
        ...mockProviderProfile,
        verificationStatus: ProviderVerificationStatus.VERIFIED,
      };
      const updatedProfile = {
        ...verifiedProfile,
        bio: 'Updated bio',
        isAvailable: true,
      };

      profileRepo.findOne.mockResolvedValue(verifiedProfile);
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
      userRepo.findOneOrFail.mockResolvedValue({
        ...mockUserEntity,
        skills: updateDto.skills,
      });

      await service.update(USER_ID, updateDto);

      expect(userRepo.update).toHaveBeenCalledWith(USER_ID, {
        skills: updateDto.skills,
      });
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

      await expect(
        service.update('nonexistent', { bio: 'new bio' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('verifyProvider', () => {
    it('should set verification status to VERIFIED when action is APPROVE', async () => {
      profileRepo.findOne.mockResolvedValue(mockProviderProfile);
      profileRepo.update.mockResolvedValue({});
      profileRepo.findOneOrFail.mockResolvedValue({
        ...mockProviderProfile,
        verificationStatus: ProviderVerificationStatus.VERIFIED,
      });

      const result = await service.verifyProvider(
        USER_ID,
        VerificationAction.APPROVE,
      );

      expect(profileRepo.update).toHaveBeenCalledWith(
        { userId: USER_ID },
        { verificationStatus: ProviderVerificationStatus.VERIFIED },
      );
      expect(result.verificationStatus).toBe(
        ProviderVerificationStatus.VERIFIED,
      );
    });

    it('should set verification status to REJECTED when action is REJECT', async () => {
      profileRepo.findOne.mockResolvedValue(mockProviderProfile);
      profileRepo.update.mockResolvedValue({});
      profileRepo.findOneOrFail.mockResolvedValue({
        ...mockProviderProfile,
        verificationStatus: ProviderVerificationStatus.REJECTED,
      });

      const result = await service.verifyProvider(
        USER_ID,
        VerificationAction.REJECT,
      );

      expect(profileRepo.update).toHaveBeenCalledWith(
        { userId: USER_ID },
        { verificationStatus: ProviderVerificationStatus.REJECTED },
      );
      expect(result.verificationStatus).toBe(
        ProviderVerificationStatus.REJECTED,
      );
    });

    it('should set verification status to SUSPENDED when action is SUSPEND', async () => {
      profileRepo.findOne.mockResolvedValue(mockProviderProfile);
      profileRepo.update.mockResolvedValue({});
      profileRepo.findOneOrFail.mockResolvedValue({
        ...mockProviderProfile,
        verificationStatus: ProviderVerificationStatus.SUSPENDED,
      });

      const result = await service.verifyProvider(
        USER_ID,
        VerificationAction.SUSPEND,
      );

      expect(profileRepo.update).toHaveBeenCalledWith(
        { userId: USER_ID },
        { verificationStatus: ProviderVerificationStatus.SUSPENDED },
      );
      expect(result.verificationStatus).toBe(
        ProviderVerificationStatus.SUSPENDED,
      );
    });

    it('should throw NotFoundException when no profile exists for the provider', async () => {
      profileRepo.findOne.mockResolvedValue(null);

      await expect(
        service.verifyProvider('nonexistent', VerificationAction.APPROVE),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update — additional edge cases', () => {
    it('should throw ForbiddenException when setting availability on unverified provider', async () => {
      profileRepo.findOne.mockResolvedValue({
        ...mockProviderProfile,
        verificationStatus: ProviderVerificationStatus.UNVERIFIED,
      });

      await expect(
        service.update(USER_ID, { isAvailable: true }),
      ).rejects.toThrow();
    });

    it('should update profile with nequiNumber and daviplataNumber', async () => {
      const verifiedProfile = {
        ...mockProviderProfile,
        verificationStatus: ProviderVerificationStatus.VERIFIED,
      };
      const updateDto = {
        nequiNumber: '3001234567',
        daviplataNumber: '3009999999',
      };

      profileRepo.findOne.mockResolvedValue(verifiedProfile);
      profileRepo.update.mockResolvedValue({});
      profileRepo.findOneOrFail.mockResolvedValue({
        ...verifiedProfile,
        ...updateDto,
      });
      userRepo.findOne.mockResolvedValue(mockUserEntity);

      const result = await service.update(USER_ID, updateDto);

      expect(profileRepo.update).toHaveBeenCalledWith(
        { userId: USER_ID },
        expect.objectContaining({ nequiNumber: '3001234567' }),
      );
      expect(result).toBeDefined();
    });
  });

  describe('searchBySkill', () => {
    it('should return matching provider profiles for the given skill', async () => {
      const mockQb = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            userId: USER_ID,
            bio: 'Experienced plumber',
            averageRating: 4.5,
            totalRatings: 10,
            isAvailable: true,
            verificationStatus: ProviderVerificationStatus.VERIFIED,
            user: {
              fullName: 'Test Provider',
              profilePhotoUrl: null,
              skills: ['plomeria'],
            },
          },
        ]),
      };
      profileRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      const result = await service.searchBySkill('plomeria');

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(USER_ID);
      expect(result[0].skills).toContain('plomeria');
    });

    it('should return empty array when no providers match the skill', async () => {
      const mockQb = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      profileRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      const result = await service.searchBySkill('nonexistent-skill');

      expect(result).toHaveLength(0);
    });
  });

  describe('forwardIdentityDocument', () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'id_document.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      buffer: Buffer.from('fake-pdf-content'),
      size: 16,
      stream: null as unknown,
      destination: '',
      filename: 'id_document.pdf',
      path: '',
    };

    it('should return success message after forwarding document', async () => {
      const mockHttpService = {
        axiosRef: { post: jest.fn().mockResolvedValue({}) },
      };
      (service as unknown as Record<string, unknown>)['httpService'] =
        mockHttpService;

      const result = await service.forwardIdentityDocument(USER_ID, mockFile);

      expect(result).toEqual({ message: 'Document sent for verification' });
    });

    it('should still return success when forwarding fails (resilient)', async () => {
      const mockHttpService = {
        axiosRef: { post: jest.fn().mockRejectedValue(new Error('timeout')) },
      };
      (service as unknown as Record<string, unknown>)['httpService'] =
        mockHttpService;

      const result = await service.forwardIdentityDocument(USER_ID, mockFile);

      expect(result).toEqual({ message: 'Document sent for verification' });
    });
  });

  describe('getCachedRating', () => {
    it('should return cached rating when available in cache', async () => {
      const mockCache = {
        get: jest.fn().mockResolvedValue(4.5),
        set: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
      };
      (service as unknown as Record<string, unknown>)['cache'] = mockCache;

      const result = await service.getCachedRating(USER_ID);

      expect(result).toBe(4.5);
      expect(mockCache.get).toHaveBeenCalled();
    });

    it('should compute rating from DB and cache it when cache misses', async () => {
      const mockCache = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
      };
      (service as unknown as Record<string, unknown>)['cache'] = mockCache;

      profileRepo.findOne.mockResolvedValue({
        ...mockProviderProfile,
        averageRating: 3.8,
      });

      const result = await service.getCachedRating(USER_ID);

      expect(result).toBe(3.8);
      expect(mockCache.set).toHaveBeenCalled();
    });

    it('should return null when provider profile is not found', async () => {
      const mockCache = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
      };
      (service as unknown as Record<string, unknown>)['cache'] = mockCache;

      profileRepo.findOne.mockResolvedValue(null);

      const result = await service.getCachedRating(USER_ID);

      expect(result).toBeNull();
    });
  });
});
