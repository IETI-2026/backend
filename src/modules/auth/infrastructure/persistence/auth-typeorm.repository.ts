import { Injectable } from '@nestjs/common';
import { DataSource, IsNull, Repository } from 'typeorm';
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
import {
  IAuthRepository,
  UserWithRoles,
} from '../../domain/repositories/auth.repository';

/**
 * Tenant-aware auth repository.
 *
 * We resolve the DataSource lazily on every call (via AsyncLocalStorage)
 * instead of injecting TENANT_DATA_SOURCE (REQUEST-scoped) because
 * AuthService is consumed by JwtStrategy, which is a Passport singleton.
 */
@Injectable()
export class AuthTypeOrmRepository implements IAuthRepository {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly tenantDataSourceService: TenantDataSourceService,
  ) {}

  /* ---------------------------------------------------------- */
  /*  Helpers                                                    */
  /* ---------------------------------------------------------- */

  private async ds(): Promise<DataSource> {
    const tenantId = this.tenantContext.getTenantId() ?? 'public';
    return this.tenantDataSourceService.getDataSource(tenantId);
  }

  private async repo<T extends object>(
    entity: new () => T,
  ): Promise<Repository<T>> {
    const dataSource = await this.ds();
    return dataSource.getRepository(entity);
  }

  private async repoInPublic<T extends object>(
    entity: new () => T,
  ): Promise<Repository<T>> {
    const dataSource =
      await this.tenantDataSourceService.getDataSource('public');
    return dataSource.getRepository(entity);
  }

  /* ---------------------------------------------------------- */
  /*  Users                                                      */
  /* ---------------------------------------------------------- */

  async findUserByEmail(email: string): Promise<UserEntity | null> {
    const r = await this.repo(UserEntity);
    return r.findOne({ where: { email } });
  }

  async findUserById(userId: string): Promise<UserEntity | null> {
    const r = await this.repoInPublic(UserEntity);
    return r.findOne({ where: { id: userId } });
  }

  async ensureUserInCurrentTenant(userId: string): Promise<void> {
    const tenantId = this.tenantContext.getTenantId() ?? 'public';
    if (tenantId === 'public') {
      return;
    }

    const publicRepo = await this.repoInPublic(UserEntity);
    const sourceUser = await publicRepo.findOne({ where: { id: userId } });
    if (!sourceUser) {
      return;
    }

    const tenantDataSource =
      await this.tenantDataSourceService.getDataSource(tenantId);
    const tenantUserRepo = tenantDataSource.getRepository(UserEntity);
    const existingUser = await tenantUserRepo.findOne({
      where: { id: userId },
    });

    const projectionData = {
      email: sourceUser.email,
      phoneNumber: sourceUser.phoneNumber,
      passwordHash: sourceUser.passwordHash,
      fullName: sourceUser.fullName,
      documentId: sourceUser.documentId,
      profilePhotoUrl: sourceUser.profilePhotoUrl,
      skills: sourceUser.skills,
      currentLatitude: sourceUser.currentLatitude,
      currentLongitude: sourceUser.currentLongitude,
      lastLocationUpdate: sourceUser.lastLocationUpdate,
      status: sourceUser.status,
      emailVerified: sourceUser.emailVerified,
      phoneVerified: sourceUser.phoneVerified,
      primaryRole: sourceUser.primaryRole,
      lastLoginAt: sourceUser.lastLoginAt,
      deletedAt: sourceUser.deletedAt,
    };

    if (existingUser) {
      await tenantUserRepo.update(userId, projectionData);
      return;
    }

    const projection = tenantUserRepo.create({
      id: sourceUser.id,
      ...projectionData,
    });
    await tenantUserRepo.save(projection);
  }

  async findUserWithRoles(userId: string): Promise<UserWithRoles | null> {
    const r = await this.repoInPublic(UserEntity);
    const user = await r.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.role'],
    });
    return user as UserWithRoles | null;
  }

  async createUser(data: {
    email: string;
    fullName: string;
    passwordHash?: string;
    phoneNumber?: string;
    emailVerified?: boolean;
  }): Promise<UserEntity> {
    const r = await this.repo(UserEntity);
    const user = r.create({
      email: data.email,
      fullName: data.fullName,
      passwordHash: data.passwordHash ?? null,
      phoneNumber: data.phoneNumber ?? null,
      emailVerified: data.emailVerified ?? false,
      status: UserStatus.ACTIVE,
    });
    const saved = await r.save(user);

    await this.assignRoleToUser(saved.id, RoleName.USER);

    return saved;
  }

  async updateUser(
    userId: string,
    data: Partial<{
      passwordHash: string;
      emailVerified: boolean;
      lastLoginAt: Date;
    }>,
  ): Promise<UserEntity> {
    const r = await this.repo(UserEntity);
    await r.update(userId, data);
    return r.findOneOrFail({ where: { id: userId } });
  }

  /* ---------------------------------------------------------- */
  /*  OAuth                                                      */
  /* ---------------------------------------------------------- */

  async findOAuthAccount(
    provider: string,
    providerUserId: string,
  ): Promise<OAuthAccountEntity | null> {
    const r = await this.repo(OAuthAccountEntity);
    return r.findOne({
      where: {
        provider: provider as AuthProvider,
        providerUserId,
      },
      relations: ['user'],
    });
  }

  async createOAuthAccount(data: {
    userId: string;
    provider: string;
    providerUserId: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: Date;
  }): Promise<OAuthAccountEntity> {
    const r = await this.repo(OAuthAccountEntity);
    const account = r.create({
      userId: data.userId,
      provider: data.provider as AuthProvider,
      providerUserId: data.providerUserId,
      accessToken: data.accessToken ?? null,
      refreshToken: data.refreshToken ?? null,
      expiresAt: data.expiresAt ?? null,
    });
    return r.save(account);
  }

  /* ---------------------------------------------------------- */
  /*  Refresh tokens                                             */
  /* ---------------------------------------------------------- */

  async findRefreshToken(token: string): Promise<RefreshTokenEntity | null> {
    const r = await this.repo(RefreshTokenEntity);
    return r.findOne({ where: { token }, relations: ['user'] });
  }

  async createRefreshToken(data: {
    userId: string;
    token: string;
    expiresAt: Date;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<RefreshTokenEntity> {
    const r = await this.repo(RefreshTokenEntity);
    const rt = r.create({
      userId: data.userId,
      token: data.token,
      expiresAt: data.expiresAt,
      userAgent: data.userAgent ?? null,
      ipAddress: data.ipAddress ?? null,
      isRevoked: false,
    });
    return r.save(rt);
  }

  async revokeRefreshToken(tokenId: string): Promise<void> {
    const r = await this.repo(RefreshTokenEntity);
    await r.update(tokenId, { isRevoked: true });
  }

  async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    const r = await this.repo(RefreshTokenEntity);
    await r.update({ userId, isRevoked: false }, { isRevoked: true });
  }

  /* ---------------------------------------------------------- */
  /*  Roles                                                      */
  /* ---------------------------------------------------------- */

  async findUserByPhone(phone: string): Promise<UserEntity | null> {
    const r = await this.repo(UserEntity);
    return r.findOne({ where: { phoneNumber: phone } });
  }

  async assignRoleToUser(userId: string, roleName: string): Promise<void> {
    const roleRepo = await this.repo(RoleEntity);
    const role = await roleRepo.findOne({
      where: { name: roleName as RoleName },
    });

    if (!role) {
      throw new Error(`Role ${roleName} not found`);
    }

    const urRepo = await this.repo(UserRoleEntity);
    const existing = await urRepo.findOne({
      where: { userId, roleId: role.id },
    });

    if (!existing) {
      const userRole = urRepo.create({ userId, roleId: role.id });
      await urRepo.save(userRole);
    }
  }

  async getUserRoles(userId: string): Promise<string[]> {
    const r = await this.repoInPublic(UserRoleEntity);
    const userRoles = await r.find({
      where: { userId },
      relations: ['role'],
    });
    return userRoles.map((ur) => ur.role.name);
  }

  /* ---------------------------------------------------------- */
  /*  Password reset                                             */
  /* ---------------------------------------------------------- */

  async createPasswordResetToken(data: {
    userId: string;
    token: string;
    expiresAt: Date;
  }): Promise<PasswordResetTokenEntity> {
    const r = await this.repo(PasswordResetTokenEntity);
    const entity = r.create({
      userId: data.userId,
      token: data.token,
      expiresAt: data.expiresAt,
    });
    return r.save(entity);
  }

  async findValidPasswordResetToken(token: string): Promise<{
    id: string;
    userId: string;
    expiresAt: Date;
  } | null> {
    const r = await this.repo(PasswordResetTokenEntity);
    const record = await r.findOne({ where: { token } });
    if (!record || record.usedAt || new Date() > record.expiresAt) {
      return null;
    }
    return {
      id: record.id,
      userId: record.userId,
      expiresAt: record.expiresAt,
    };
  }

  async markPasswordResetTokenUsed(tokenId: string): Promise<void> {
    const r = await this.repo(PasswordResetTokenEntity);
    await r.update(tokenId, { usedAt: new Date() });
  }

  /* ---------------------------------------------------------- */
  /*  OTP codes                                                  */
  /* ---------------------------------------------------------- */

  async createOtpCode(data: {
    userId?: string;
    phone: string;
    code: string;
    expiresAt: Date;
  }): Promise<void> {
    const r = await this.repo(OtpCodeEntity);
    const entity = r.create({
      userId: data.userId ?? null,
      phone: data.phone,
      code: data.code,
      expiresAt: data.expiresAt,
    });
    await r.save(entity);
  }

  async findValidOtpCode(
    phone: string,
    code: string,
  ): Promise<{
    id: string;
    userId: string | null;
    phone: string;
    attempts: number;
  } | null> {
    const r = await this.repo(OtpCodeEntity);
    const record = await r.findOne({
      where: { phone, code, usedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    if (!record || new Date() > record.expiresAt) {
      return null;
    }
    return {
      id: record.id,
      userId: record.userId,
      phone: record.phone,
      attempts: record.attempts,
    };
  }

  async incrementOtpAttempts(otpId: string): Promise<void> {
    const r = await this.repo(OtpCodeEntity);
    await r.increment({ id: otpId }, 'attempts', 1);
  }

  async markOtpUsed(otpId: string): Promise<void> {
    const r = await this.repo(OtpCodeEntity);
    await r.update(otpId, { usedAt: new Date() });
  }

  async invalidateOtpCodesForPhone(phone: string): Promise<void> {
    const r = await this.repo(OtpCodeEntity);
    await r.update({ phone, usedAt: IsNull() }, { usedAt: new Date() });
  }
}
