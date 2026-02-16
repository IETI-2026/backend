import { User } from '@prisma/client';
import { JwtPayloadEntity } from '../entities';

export interface IAuthRepository {
  findUserByEmail(email: string): Promise<User | null>;
  findUserById(userId: string): Promise<User | null>;
  findUserWithRoles(userId: string): Promise<(User & { roles: any[] }) | null>;

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
  ): Promise<any | null>;
  createOAuthAccount(data: {
    userId: string;
    provider: string;
    providerUserId: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: Date;
  }): Promise<any>;

  findRefreshToken(token: string): Promise<any | null>;
  createRefreshToken(data: {
    userId: string;
    token: string;
    expiresAt: Date;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<any>;
  revokeRefreshToken(tokenId: string): Promise<any>;

  assignRoleToUser(userId: string, roleName: string): Promise<any>;
  getUserRoles(userId: string): Promise<string[]>;
}
