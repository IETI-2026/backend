import { Injectable } from '@nestjs/common';
import {
  AuthProvider,
  OAuthAccount,
  PasswordResetToken,
  RefreshToken,
  RoleName,
  User,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import {
  IAuthRepository,
  UserWithRoles,
} from '../../domain/repositories/auth.repository';

@Injectable()
export class AuthPrismaRepository implements IAuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findUserById(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
    });
  }

  async findUserWithRoles(userId: string): Promise<UserWithRoles | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  async createUser(data: {
    email: string;
    fullName: string;
    passwordHash?: string;
    phoneNumber?: string;
    emailVerified?: boolean;
  }): Promise<User> {
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        fullName: data.fullName,
        passwordHash: data.passwordHash,
        phoneNumber: data.phoneNumber,
        emailVerified: data.emailVerified ?? false,
        status: UserStatus.ACTIVE,
      },
    });

    // Assign default USER role
    await this.assignRoleToUser(user.id, RoleName.USER);

    return user;
  }

  async updateUser(
    userId: string,
    data: Partial<{
      passwordHash: string;
      emailVerified: boolean;
      lastLoginAt: Date;
    }>,
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  async findOAuthAccount(
    provider: string,
    providerUserId: string,
  ): Promise<OAuthAccount | null> {
    return this.prisma.oAuthAccount.findFirst({
      where: {
        provider: provider as AuthProvider,
        providerUserId,
      },
      include: {
        user: true,
      },
    });
  }

  async createOAuthAccount(data: {
    userId: string;
    provider: string;
    providerUserId: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: Date;
  }): Promise<OAuthAccount> {
    return this.prisma.oAuthAccount.create({
      data: {
        userId: data.userId,
        provider: data.provider as AuthProvider,
        providerUserId: data.providerUserId,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findRefreshToken(token: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({
      where: { token },
      include: {
        user: true,
      },
    });
  }

  async createRefreshToken(data: {
    userId: string;
    token: string;
    expiresAt: Date;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({
      data: {
        userId: data.userId,
        token: data.token,
        expiresAt: data.expiresAt,
        userAgent: data.userAgent,
        ipAddress: data.ipAddress,
        isRevoked: false,
      },
    });
  }

  async revokeRefreshToken(tokenId: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id: tokenId },
      data: { isRevoked: true },
    });
  }

  async assignRoleToUser(userId: string, roleName: string): Promise<void> {
    const role = await this.prisma.role.findUnique({
      where: { name: roleName as RoleName },
    });

    if (!role) {
      throw new Error(`Role ${roleName} not found`);
    }

    await this.prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId,
          roleId: role.id,
        },
      },
      create: {
        userId,
        roleId: role.id,
      },
      update: {},
    });
  }

  async getUserRoles(userId: string): Promise<string[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: true,
      },
    });

    return userRoles.map((ur) => ur.role.name);
  }

  async createPasswordResetToken(data: {
    userId: string;
    token: string;
    expiresAt: Date;
  }): Promise<PasswordResetToken> {
    return this.prisma.passwordResetToken.create({
      data: {
        userId: data.userId,
        token: data.token,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findValidPasswordResetToken(token: string): Promise<{
    id: string;
    userId: string;
    expiresAt: Date;
  } | null> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { token },
    });
    if (
      !record ||
      record.usedAt ||
      new Date() > record.expiresAt
    ) {
      return null;
    }
    return {
      id: record.id,
      userId: record.userId,
      expiresAt: record.expiresAt,
    };
  }

  async markPasswordResetTokenUsed(tokenId: string): Promise<void> {
    await this.prisma.passwordResetToken.update({
      where: { id: tokenId },
      data: { usedAt: new Date() },
    });
  }
}
