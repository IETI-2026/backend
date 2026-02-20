import {
  OAuthAccount,
  RefreshToken,
  Role,
  User,
  UserRole,
} from '@prisma/client';

// Type for User with populated roles
export type UserWithRoles = User & {
  roles: Array<UserRole & { role: Role }>;
};

export interface IAuthRepository {
  findUserByEmail(email: string): Promise<User | null>;
  findUserById(userId: string): Promise<User | null>;
  findUserWithRoles(userId: string): Promise<UserWithRoles | null>;

  createUser(data: {
    email: string;
    fullName: string;
    passwordHash?: string;
    phoneNumber?: string;
    emailVerified?: boolean;
  }): Promise<User>;

  updateUser(
    userId: string,
    data: Partial<{
      passwordHash: string;
      emailVerified: boolean;
      lastLoginAt: Date;
    }>,
  ): Promise<User>;

  findOAuthAccount(
    provider: string,
    providerUserId: string,
  ): Promise<OAuthAccount | null>;
  createOAuthAccount(data: {
    userId: string;
    provider: string;
    providerUserId: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: Date;
  }): Promise<OAuthAccount>;

  findRefreshToken(token: string): Promise<RefreshToken | null>;
  createRefreshToken(data: {
    userId: string;
    token: string;
    expiresAt: Date;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<RefreshToken>;
  revokeRefreshToken(tokenId: string): Promise<void>;

  assignRoleToUser(
    userId: string,
    roleName: string,
    assignedBy?: string,
  ): Promise<void>;
  getUserRoles(userId: string): Promise<string[]>;

  revokeAllUserRefreshTokens(userId: string): Promise<void>;
  findUserByPhone(phone: string): Promise<User | null>;

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
