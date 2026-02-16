import { UserStatus, RoleName, User } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { IAuthRepository } from '../../domain/repositories/auth.repository';

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

  async findUserWithRoles(userId: string): Promise<(User & { roles: any[] }) | null> {
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

  async findOAuthAccount(provider: string, providerUserId: string): Promise<any | null> {
    return this.prisma.oAuthAccount.findFirst({
      where: {
        provider: provider as any,
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
  }): Promise<any> {
    return this.prisma.oAuthAccount.create({
      data: {
        userId: data.userId,
        provider: data.provider as any,
        providerUserId: data.providerUserId,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findRefreshToken(token: string): Promise<any | null> {
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
  }): Promise<any> {
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

  async revokeRefreshToken(tokenId: string): Promise<any> {
    return this.prisma.refreshToken.update({
      where: { id: tokenId },
      data: { isRevoked: true },
    });
  }

  async assignRoleToUser(userId: string, roleName: string): Promise<any> {
    const role = await this.prisma.role.findUnique({
      where: { name: roleName as RoleName },
    });

    if (!role) {
      throw new Error(`Role ${roleName} not found`);
    }

    return this.prisma.userRole.upsert({
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
}
