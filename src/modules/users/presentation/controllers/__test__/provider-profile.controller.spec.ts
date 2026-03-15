import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ProviderProfileController } from '../provider-profile.controller';
import { ProviderProfileService } from '../../../application/use-cases/provider-profile.service';
import { JwtAuthGuard } from '../../../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../auth/infrastructure/guards/roles.guard';
import { JwtPayloadEntity } from '../../../../auth/domain/entities';
import { RoleName } from '../../../../../database/enums';
import { VerificationAction } from '../../../application/dtos/verify-provider.dto';

// ─── shared fixtures ──────────────────────────────────────────────────────────

const mockProviderProfileResponse = {
  id: 'profile-uuid-001',
  userId: 'user-uuid-001',
  bio: 'Electricista con 10 años de experiencia',
  verificationStatus: 'UNVERIFIED',
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
  skills: ['electricidad'],
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const authenticatedUser: JwtPayloadEntity = {
  sub: 'user-uuid-001',
  email: 'provider@example.com',
  roles: [RoleName.USER],
};

const adminUser: JwtPayloadEntity = {
  sub: 'admin-uuid-001',
  email: 'admin@example.com',
  roles: [RoleName.ADMIN],
};

const mockProviderProfileService = {
  create: jest.fn(),
  findByUserId: jest.fn(),
  update: jest.fn(),
  verifyProvider: jest.fn(),
};

const allowAllGuard = { canActivate: () => true };

describe('ProviderProfileController', () => {
  let controller: ProviderProfileController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProviderProfileController],
      providers: [
        { provide: ProviderProfileService, useValue: mockProviderProfileService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(allowAllGuard)
      .overrideGuard(RolesGuard)
      .useValue(allowAllGuard)
      .compile();

    controller = module.get<ProviderProfileController>(ProviderProfileController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── createMyProfile ─────────────────────────────────────────────────────────

  describe('createMyProfile', () => {
    const createDto = {
      bio: 'Electricista con 10 años de experiencia',
      coverageRadiusKm: 15,
      isAvailable: true,
      skills: ['electricidad'],
    };

    it('should create and return a new provider profile', async () => {
      mockProviderProfileService.create.mockResolvedValue(mockProviderProfileResponse);

      const result = await controller.createMyProfile(authenticatedUser, createDto as any);

      expect(mockProviderProfileService.create).toHaveBeenCalledWith(
        authenticatedUser.sub,
        createDto,
      );
      expect(result).toBe(mockProviderProfileResponse);
    });

    it('should throw UnauthorizedException when user has no sub', async () => {
      const noSub: JwtPayloadEntity = { email: 'test@example.com' };

      await expect(
        controller.createMyProfile(noSub, createDto as any),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockProviderProfileService.create).not.toHaveBeenCalled();
    });

    it('should propagate ConflictException when provider profile already exists', async () => {
      mockProviderProfileService.create.mockRejectedValue(
        new ConflictException('Provider profile already exists for this user'),
      );

      await expect(
        controller.createMyProfile(authenticatedUser, createDto as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── getMyProfile ─────────────────────────────────────────────────────────────

  describe('getMyProfile', () => {
    it('should return the provider profile for the current user', async () => {
      mockProviderProfileService.findByUserId.mockResolvedValue(mockProviderProfileResponse);

      const result = await controller.getMyProfile(authenticatedUser);

      expect(mockProviderProfileService.findByUserId).toHaveBeenCalledWith(
        authenticatedUser.sub,
      );
      expect(result).toBe(mockProviderProfileResponse);
    });

    it('should throw UnauthorizedException when user has no sub', async () => {
      const noSub: JwtPayloadEntity = { email: 'test@example.com' };

      await expect(controller.getMyProfile(noSub)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(mockProviderProfileService.findByUserId).not.toHaveBeenCalled();
    });

    it('should propagate NotFoundException when provider profile does not exist', async () => {
      mockProviderProfileService.findByUserId.mockRejectedValue(
        new NotFoundException('Provider profile not found'),
      );

      await expect(controller.getMyProfile(authenticatedUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── updateMyProfile ──────────────────────────────────────────────────────────

  describe('updateMyProfile', () => {
    const updateDto = { bio: 'Descripción actualizada', isAvailable: true };

    it('should update and return the current user provider profile', async () => {
      const updated = { ...mockProviderProfileResponse, bio: 'Descripción actualizada' };
      mockProviderProfileService.update.mockResolvedValue(updated);

      const result = await controller.updateMyProfile(authenticatedUser, updateDto as any);

      expect(mockProviderProfileService.update).toHaveBeenCalledWith(
        authenticatedUser.sub,
        updateDto,
      );
      expect(result.bio).toBe('Descripción actualizada');
    });

    it('should throw UnauthorizedException when user has no sub', async () => {
      const noSub: JwtPayloadEntity = { email: 'test@example.com' };

      await expect(
        controller.updateMyProfile(noSub, updateDto as any),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockProviderProfileService.update).not.toHaveBeenCalled();
    });

    it('should propagate NotFoundException when provider profile does not exist', async () => {
      mockProviderProfileService.update.mockRejectedValue(
        new NotFoundException('Provider profile not found'),
      );

      await expect(
        controller.updateMyProfile(authenticatedUser, updateDto as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getProviderProfile (admin) ───────────────────────────────────────────────

  describe('getProviderProfile', () => {
    it('should return the provider profile for a given user ID', async () => {
      mockProviderProfileService.findByUserId.mockResolvedValue(mockProviderProfileResponse);

      const result = await controller.getProviderProfile('user-uuid-001');

      expect(mockProviderProfileService.findByUserId).toHaveBeenCalledWith(
        'user-uuid-001',
      );
      expect(result).toBe(mockProviderProfileResponse);
    });

    it('should propagate NotFoundException for unknown user ID', async () => {
      mockProviderProfileService.findByUserId.mockRejectedValue(
        new NotFoundException('Provider profile not found'),
      );

      await expect(
        controller.getProviderProfile('non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── verifyProvider ───────────────────────────────────────────────────────────

  describe('verifyProvider', () => {
    it('should approve a provider and return the updated profile', async () => {
      const approvedProfile = {
        ...mockProviderProfileResponse,
        verificationStatus: 'VERIFIED',
      };
      mockProviderProfileService.verifyProvider.mockResolvedValue(approvedProfile);
      const dto = { action: VerificationAction.APPROVE };

      const result = await controller.verifyProvider('user-uuid-001', dto as any);

      expect(mockProviderProfileService.verifyProvider).toHaveBeenCalledWith(
        'user-uuid-001',
        VerificationAction.APPROVE,
      );
      expect(result.verificationStatus).toBe('VERIFIED');
    });

    it('should reject a provider', async () => {
      const rejectedProfile = {
        ...mockProviderProfileResponse,
        verificationStatus: 'REJECTED',
      };
      mockProviderProfileService.verifyProvider.mockResolvedValue(rejectedProfile);
      const dto = { action: VerificationAction.REJECT };

      const result = await controller.verifyProvider('user-uuid-001', dto as any);

      expect(mockProviderProfileService.verifyProvider).toHaveBeenCalledWith(
        'user-uuid-001',
        VerificationAction.REJECT,
      );
      expect(result.verificationStatus).toBe('REJECTED');
    });

    it('should suspend a provider', async () => {
      const suspendedProfile = {
        ...mockProviderProfileResponse,
        verificationStatus: 'SUSPENDED',
      };
      mockProviderProfileService.verifyProvider.mockResolvedValue(suspendedProfile);
      const dto = { action: VerificationAction.SUSPEND };

      const result = await controller.verifyProvider('user-uuid-001', dto as any);

      expect(mockProviderProfileService.verifyProvider).toHaveBeenCalledWith(
        'user-uuid-001',
        VerificationAction.SUSPEND,
      );
      expect(result.verificationStatus).toBe('SUSPENDED');
    });

    it('should propagate NotFoundException when provider profile does not exist', async () => {
      mockProviderProfileService.verifyProvider.mockRejectedValue(
        new NotFoundException('Provider profile not found'),
      );
      const dto = { action: VerificationAction.APPROVE };

      await expect(
        controller.verifyProvider('non-existent-id', dto as any),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
