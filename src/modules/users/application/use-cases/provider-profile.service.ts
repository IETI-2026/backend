import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadGatewayException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';
import { DataSource, Repository } from 'typeorm';
import {
  UserEntity as DbUserEntity,
  ProviderProfileEntity,
} from '@/database/entities';
import { ProviderVerificationStatus, RoleName } from '@/database/enums';
import { TENANT_DATA_SOURCE, TenantContext } from '@/tenant';
import { AUTH_REPOSITORY } from '../../../auth/domain/repositories';
import type { IAuthRepository } from '../../../auth/domain/repositories/auth.repository';
import type { CreateProviderProfileDto } from '../dtos/create-provider-profile.dto';
import { ProviderProfileResponseDto } from '../dtos/provider-profile-response.dto';
import { ProviderSearchResultDto } from '../dtos/provider-search-result.dto';
import type { UpdateProviderProfileDto } from '../dtos/update-provider-profile.dto';
import { VerificationAction } from '../dtos/verify-provider.dto';

@Injectable()
export class ProviderProfileService {
  private readonly logger = new Logger(ProviderProfileService.name);
  private readonly profileRepo: Repository<ProviderProfileEntity>;
  private readonly userRepo: Repository<DbUserEntity>;

  private readonly documentVerificationUrl: string;

  constructor(
    @Inject(TENANT_DATA_SOURCE)
    dataSource: DataSource,
    @Inject(AUTH_REPOSITORY)
    private readonly authRepository: IAuthRepository,
    private readonly httpService: HttpService,
    @Inject(CACHE_MANAGER)
    private readonly cache: Cache,
    private readonly configService: ConfigService,
    private readonly tenantContext: TenantContext,
  ) {
    this.profileRepo = dataSource.getRepository(ProviderProfileEntity);
    this.userRepo = dataSource.getRepository(DbUserEntity);
    this.documentVerificationUrl = this.configService.get<string>(
      'app.documentVerificationUrl',
      '',
    );
  }

  async create(
    userId: string,
    dto: CreateProviderProfileDto,
  ): Promise<ProviderProfileResponseDto> {
    const existing = await this.profileRepo.findOne({ where: { userId } });
    if (existing) {
      throw new ConflictException(
        'Provider profile already exists for this user',
      );
    }

    const profile = this.profileRepo.create({
      userId,
      bio: dto.bio ?? null,
      isAvailable: dto.isAvailable ?? false,
      nequiNumber: dto.nequiNumber ?? null,
      daviplataNumber: dto.daviplataNumber ?? null,
      verificationStatus: ProviderVerificationStatus.UNVERIFIED,
    });
    const saved = await this.profileRepo.save(profile);

    if (dto.skills?.length) {
      await this.userRepo.update(userId, { skills: dto.skills });
    }

    await this.authRepository.assignRoleToUser(userId, RoleName.PROVIDER);

    this.logger.log(`Provider profile created for user ${userId}`);
    return this.mapToResponse(saved, dto.skills ?? []);
  }

  async findByUserId(userId: string): Promise<ProviderProfileResponseDto> {
    const profile = await this.profileRepo.findOne({
      where: { userId },
      relations: ['user'],
    });
    if (!profile) {
      throw new NotFoundException('Provider profile not found');
    }
    return this.mapToResponse(profile, profile.user?.skills ?? []);
  }

  async update(
    userId: string,
    dto: UpdateProviderProfileDto,
  ): Promise<ProviderProfileResponseDto> {
    const existing = await this.profileRepo.findOne({ where: { userId } });
    if (!existing) {
      throw new NotFoundException('Provider profile not found');
    }

    if (
      dto.isAvailable === true &&
      existing.verificationStatus !== ProviderVerificationStatus.VERIFIED
    ) {
      throw new ForbiddenException(
        'Cannot set availability: provider is not verified',
      );
    }

    const updateData: Record<string, unknown> = {};
    if (dto.bio !== undefined) updateData.bio = dto.bio;
    if (dto.isAvailable !== undefined) updateData.isAvailable = dto.isAvailable;
    if (dto.nequiNumber !== undefined) updateData.nequiNumber = dto.nequiNumber;
    if (dto.daviplataNumber !== undefined)
      updateData.daviplataNumber = dto.daviplataNumber;
    if (
      dto.currentLatitude !== undefined ||
      dto.currentLongitude !== undefined
    ) {
      if (dto.currentLatitude !== undefined)
        updateData.currentLatitude = dto.currentLatitude;
      if (dto.currentLongitude !== undefined)
        updateData.currentLongitude = dto.currentLongitude;
      updateData.lastLocationUpdate = new Date();
    }

    await this.profileRepo.update({ userId }, updateData);
    const profile = await this.profileRepo.findOneOrFail({
      where: { userId },
    });

    // Invalidate rating cache on update
    await this.invalidateRatingCache(userId);

    let skills: string[] = [];
    if (dto.skills !== undefined) {
      await this.userRepo.update(userId, { skills: dto.skills });
      const user = await this.userRepo.findOneOrFail({
        where: { id: userId },
      });
      skills = user.skills;
    } else {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      skills = user?.skills ?? [];
    }

    this.logger.log(`Provider profile updated for user ${userId}`);
    return this.mapToResponse(profile, skills);
  }

  async verifyProvider(
    providerUserId: string,
    action: VerificationAction,
  ): Promise<ProviderProfileResponseDto> {
    const profile = await this.profileRepo.findOne({
      where: { userId: providerUserId },
      relations: ['user'],
    });
    if (!profile) {
      throw new NotFoundException('Provider profile not found');
    }

    const statusMap: Record<VerificationAction, ProviderVerificationStatus> = {
      [VerificationAction.APPROVE]: ProviderVerificationStatus.VERIFIED,
      [VerificationAction.REJECT]: ProviderVerificationStatus.REJECTED,
      [VerificationAction.SUSPEND]: ProviderVerificationStatus.SUSPENDED,
    };

    await this.profileRepo.update(
      { userId: providerUserId },
      { verificationStatus: statusMap[action] },
    );

    // Invalidate cache on verification status change
    await this.invalidateRatingCache(providerUserId);

    const updated = await this.profileRepo.findOneOrFail({
      where: { userId: providerUserId },
    });

    this.logger.log(
      `Provider ${providerUserId} verification: ${action} → ${statusMap[action]}`,
    );
    return this.mapToResponse(updated, profile.user?.skills ?? []);
  }

  async searchBySkill(skill: string): Promise<ProviderSearchResultDto[]> {
    const profiles = await this.profileRepo
      .createQueryBuilder('p')
      .innerJoinAndSelect('p.user', 'u')
      .where(
        `EXISTS (SELECT 1 FROM unnest(u.skills) AS s WHERE s ILIKE :pattern)`,
        { pattern: `%${skill}%` },
      )
      .getMany();

    return profiles.map((p) => {
      const dto = new ProviderSearchResultDto();
      dto.userId = p.userId;
      dto.fullName = p.user.fullName;
      dto.profilePhotoUrl = p.user.profilePhotoUrl;
      dto.bio = p.bio;
      dto.skills = p.user.skills;
      dto.averageRating = p.averageRating;
      dto.totalRatings = p.totalRatings;
      dto.isAvailable = p.isAvailable;
      dto.verificationStatus = p.verificationStatus;
      return dto;
    });
  }

  async forwardIdentityDocument(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ message: string }> {
    if (!this.documentVerificationUrl) {
      throw new BadGatewayException(
        'Document verification service is not configured',
      );
    }

    try {
      const payload = {
        userId,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileBase64: file.buffer.toString('base64'),
      };

      await this.httpService.axiosRef.post(
        this.documentVerificationUrl,
        payload,
      );
      this.logger.log(`Identity document forwarded for user ${userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to forward identity document for user ${userId}`,
        error,
      );
      throw new BadGatewayException(
        'Document verification service is unavailable',
      );
    }

    return { message: 'Document sent for verification' };
  }

  /**
   * Get cached provider rating
   */
  async getCachedRating(providerId: string): Promise<number | null> {
    const tenantId = this.tenantContext.getTenantId() || 'public';
    const cacheConfig = this.configService.get('cache');
    const ttl = cacheConfig.ttls?.provider_rating || cacheConfig.ttl;

    const cacheKey = `provider:${tenantId}:rating:${providerId}`;

    return (
      (await this.cache.get<number | null>(cacheKey)) ||
      (await this.computeAndCacheRating(providerId, cacheKey, ttl))
    );
  }

  /**
   * Compute and cache provider rating
   */
  private async computeAndCacheRating(
    providerId: string,
    cacheKey: string,
    ttl: number,
  ): Promise<number | null> {
    const profile = await this.profileRepo.findOne({
      where: { userId: providerId },
      select: ['averageRating'],
    });

    const rating = profile?.averageRating ?? null;
    await this.cache.set(cacheKey, rating, ttl);
    return rating;
  }

  /**
   * Invalidate rating cache for a provider
   */
  private async invalidateRatingCache(providerId: string): Promise<void> {
    const tenantId = this.tenantContext.getTenantId() || 'public';
    const cacheKey = `provider:${tenantId}:rating:${providerId}`;

    try {
      await this.cache.del(cacheKey);
    } catch {
      // Silently handle invalidation errors
    }
  }

  private mapToResponse(
    profile: {
      id: string;
      userId: string;
      bio: string | null;
      verificationStatus: string;
      averageRating: number | null;
      totalRatings: number;
      totalCompletedServices: number;
      totalCancelledServices: number;
      isAvailable: boolean;
      currentLatitude: number | null;
      currentLongitude: number | null;
      nequiNumber: string | null;
      daviplataNumber: string | null;
      createdAt: Date;
      updatedAt: Date;
    },
    skills: string[],
  ): ProviderProfileResponseDto {
    const dto = new ProviderProfileResponseDto();
    dto.id = profile.id;
    dto.userId = profile.userId;
    dto.bio = profile.bio;
    dto.verificationStatus = profile.verificationStatus;
    dto.averageRating = profile.averageRating;
    dto.totalRatings = profile.totalRatings;
    dto.totalCompletedServices = profile.totalCompletedServices;
    dto.totalCancelledServices = profile.totalCancelledServices;
    dto.isAvailable = profile.isAvailable;
    dto.currentLatitude = profile.currentLatitude;
    dto.currentLongitude = profile.currentLongitude;
    dto.nequiNumber = profile.nequiNumber;
    dto.daviplataNumber = profile.daviplataNumber;
    dto.skills = skills;
    dto.createdAt = profile.createdAt;
    dto.updatedAt = profile.updatedAt;
    return dto;
  }
}
