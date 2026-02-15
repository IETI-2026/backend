import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import type {
  CreateUserEntity,
  IUserRepository,
  UpdateUserEntity,
  UserEntity,
} from '@users/domain';
import * as UserMapper from '../adapters/user.mapper';

@Injectable()
export class UserPrismaRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateUserEntity): Promise<UserEntity> {
    const prismaData = UserMapper.toPrismaCreate(data);
    const user = await this.prisma.user.create({
      data: prismaData,
    });
    return UserMapper.toDomain(user);
  }

  async findById(id: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    return user ? UserMapper.toDomain(user) : null;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    return user ? UserMapper.toDomain(user) : null;
  }

  async findByPhoneNumber(phoneNumber: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({
      where: { phoneNumber },
    });
    return user ? UserMapper.toDomain(user) : null;
  }

  async findByDocumentId(documentId: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({
      where: { documentId },
    });
    return user ? UserMapper.toDomain(user) : null;
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    status?: string;
  }): Promise<{ users: UserEntity[]; total: number }> {
    const { skip = 0, take = 10, status } = params;

    const where = status ? { status: status as never } : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users: users.map(UserMapper.toDomain),
      total,
    };
  }

  async update(id: string, data: UpdateUserEntity): Promise<UserEntity> {
    const prismaData = UserMapper.toPrismaUpdate(data);

    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: prismaData,
      });
      return UserMapper.toDomain(user);
    } catch (_error) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.user.delete({
        where: { id },
      });
    } catch (_error) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  async softDelete(id: string): Promise<UserEntity> {
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          status: 'DELETED',
        },
      });
      return UserMapper.toDomain(user);
    } catch (_error) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: { id },
    });
    return count > 0;
  }
}
