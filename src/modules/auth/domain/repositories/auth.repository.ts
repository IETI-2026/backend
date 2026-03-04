import type {
  OAuthAccountEntity,
  RefreshTokenEntity,
  RoleEntity,
  UserEntity,
  UserRoleEntity,
} from '@/database/entities';

// Type for User with populated roles
export type UserWithRoles = UserEntity & {
  roles: Array<UserRoleEntity & { role: RoleEntity }>;
};

export interface IAuthRepository {
  findUserByEmail(email: string): Promise<UserEntity | null>;
  findUserById(userId: string): Promise<UserEntity | null>;
  findUserWithRoles(userId: string): Promise<UserWithRoles | null>;

  createUser(data: {
    email: string;
    fullName: string;
    passwordHash?: string;
    phoneNumber?: string;
    emailVerified?: boolean;
  }): Promise<UserEntity>;

  updateUser(
    userId: string,
    data: Partial<{
      passwordHash: string;
      emailVerified: boolean;
      lastLoginAt: Date;
    }>,
  ): Promise<UserEntity>;

  findOAuthAccount(
    provider: string,
    providerUserId: string,
  ): Promise<OAuthAccountEntity | null>;
  createOAuthAccount(data: {
    userId: string;
    provider: string;
    providerUserId: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: Date;
  }): Promise<OAuthAccountEntity>;

  findRefreshToken(token: string): Promise<RefreshTokenEntity | null>;
  createRefreshToken(data: {
    userId: string;
    token: string;
    expiresAt: Date;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<RefreshTokenEntity>;
  revokeRefreshToken(tokenId: string): Promise<void>;

  assignRoleToUser(
    userId: string,
    roleName: string,
    assignedBy?: string,
  ): Promise<void>;
  getUserRoles(userId: string): Promise<string[]>;

  revokeAllUserRefreshTokens(userId: string): Promise<void>;
  findUserByPhone(phone: string): Promise<UserEntity | null>;

  createPasswordResetToken(data: {
    userId: string;
    token: string;
    expiresAt: Date;
  }): Promise<{ id: string; token: string; expiresAt: Date }>;
  findValidPasswordResetToken(token: string): Promise<{
    id: string;
    userId: string;
    expiresAt: Date;
  } | null>;
  markPasswordResetTokenUsed(tokenId: string): Promise<void>;

  createOtpCode(data: {
    userId?: string;
    phone: string;
    code: string;
    expiresAt: Date;
  }): Promise<void>;
  findValidOtpCode(
    phone: string,
    code: string,
  ): Promise<{
    id: string;
    userId: string | null;
    phone: string;
    attempts: number;
  } | null>;
  incrementOtpAttempts(otpId: string): Promise<void>;
  markOtpUsed(otpId: string): Promise<void>;
  invalidateOtpCodesForPhone(phone: string): Promise<void>;
}
