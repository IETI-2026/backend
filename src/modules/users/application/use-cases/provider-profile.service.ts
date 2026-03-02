import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { DataSource, Repository } from "typeorm";
import {
  ProviderProfileEntity,
  UserEntity as DbUserEntity,
} from "@/database/entities";
import { ProviderVerificationStatus, RoleName } from "@/database/enums";
import { TENANT_DATA_SOURCE } from "@/tenant";
import { AUTH_REPOSITORY } from "../../../auth/domain/repositories";
import type { IAuthRepository } from "../../../auth/domain/repositories/auth.repository";
import type { CreateProviderProfileDto } from "../dtos/create-provider-profile.dto";
import { ProviderProfileResponseDto } from "../dtos/provider-profile-response.dto";
import type { UpdateProviderProfileDto } from "../dtos/update-provider-profile.dto";
import { VerificationAction } from "../dtos/verify-provider.dto";

@Injectable()
export class ProviderProfileService {
  private readonly logger = new Logger(ProviderProfileService.name);
  private readonly profileRepo: Repository<ProviderProfileEntity>;
  private readonly userRepo: Repository<DbUserEntity>;

  constructor(
    @Inject(TENANT_DATA_SOURCE)
    dataSource: DataSource,
    @Inject(AUTH_REPOSITORY)
    private readonly authRepository: IAuthRepository,
  ) {
    this.profileRepo = dataSource.getRepository(ProviderProfileEntity);
    this.userRepo = dataSource.getRepository(DbUserEntity);
  }

  async create(
    userId: string,
    dto: CreateProviderProfileDto,
  ): Promise<ProviderProfileResponseDto> {
    const existing = await this.profileRepo.findOne({ where: { userId } });
    if (existing) {
      throw new ConflictException(
        "Provider profile already exists for this user",
      );
    }

    const profile = this.profileRepo.create({
      userId,
      bio: dto.bio ?? null,
      coverageRadiusKm: dto.coverageRadiusKm ?? 10.0,
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
      relations: ["user"],
    });
    if (!profile) {
      throw new NotFoundException("Provider profile not found");
    }
    return this.mapToResponse(profile, profile.user?.skills ?? []);
  }

  async update(
    userId: string,
    dto: UpdateProviderProfileDto,
  ): Promise<ProviderProfileResponseDto> {
    const existing = await this.profileRepo.findOne({ where: { userId } });
    if (!existing) {
      throw new NotFoundException("Provider profile not found");
    }

    const updateData: Record<string, unknown> = {};
    if (dto.bio !== undefined) updateData.bio = dto.bio;
    if (dto.coverageRadiusKm !== undefined)
      updateData.coverageRadiusKm = dto.coverageRadiusKm;
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
      relations: ["user"],
    });
    if (!profile) {
      throw new NotFoundException("Provider profile not found");
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
    const updated = await this.profileRepo.findOneOrFail({
      where: { userId: providerUserId },
    });

    this.logger.log(
      `Provider ${providerUserId} verification: ${action} → ${statusMap[action]}`,
    );
    return this.mapToResponse(updated, profile.user?.skills ?? []);
  }

  private mapToResponse(
    profile: {
      id: string;
      userId: string;
      bio: string | null;
      verificationStatus: string;
      averageRating: number;
      totalRatings: number;
      totalCompletedServices: number;
      totalCancelledServices: number;
      isAvailable: boolean;
      currentLatitude: number | null;
      currentLongitude: number | null;
      coverageRadiusKm: number;
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
    dto.coverageRadiusKm = profile.coverageRadiusKm;
    dto.nequiNumber = profile.nequiNumber;
    dto.daviplataNumber = profile.daviplataNumber;
    dto.skills = skills;
    dto.createdAt = profile.createdAt;
    dto.updatedAt = profile.updatedAt;
    return dto;
  }
}
