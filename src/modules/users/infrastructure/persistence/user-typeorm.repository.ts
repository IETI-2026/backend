import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { UserEntity as DbUserEntity } from '@/database/entities';
import { UserStatus as DbUserStatus } from '@/database/enums';
import { TENANT_DATA_SOURCE } from '@/tenant';
import type {
  CreateUserEntity,
  IUserRepository,
  UpdateUserEntity,
  UserEntity,
} from '@users/domain';
import * as UserMapper from '../adapters/user.mapper';

@Injectable()
export class UserTypeOrmRepository implements IUserRepository {
  private readonly userRepo: Repository<DbUserEntity>;

  constructor(
    @Inject(TENANT_DATA_SOURCE)
    dataSource: DataSource,
  ) {
    this.userRepo = dataSource.getRepository(DbUserEntity);
  }

  async create(data: CreateUserEntity): Promise<UserEntity> {
    const createData = UserMapper.toCreateData(data);
    const user = this.userRepo.create(createData);
    const saved = await this.userRepo.save(user);
    return UserMapper.toDomain(saved);
  }

  async findById(id: string): Promise<UserEntity | null> {
    const user = await this.userRepo.findOne({ where: { id } });
    return user ? UserMapper.toDomain(user) : null;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const user = await this.userRepo.findOne({ where: { email } });
    return user ? UserMapper.toDomain(user) : null;
  }

  async findByPhoneNumber(phoneNumber: string): Promise<UserEntity | null> {
    const user = await this.userRepo.findOne({ where: { phoneNumber } });
    return user ? UserMapper.toDomain(user) : null;
  }

  async findByDocumentId(documentId: string): Promise<UserEntity | null> {
    const user = await this.userRepo.findOne({ where: { documentId } });
    return user ? UserMapper.toDomain(user) : null;
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    status?: string;
  }): Promise<{ users: UserEntity[]; total: number }> {
    const { skip = 0, take = 10, status } = params;

    const where = status ? { status: status as DbUserStatus } : {};

    const [users, total] = await this.userRepo.findAndCount({
      where,
      skip,
      take,
      order: { createdAt: 'DESC' },
    });

    return {
      users: users.map(UserMapper.toDomain),
      total,
    };
  }

  async update(id: string, data: UpdateUserEntity): Promise<UserEntity> {
    const updateData = UserMapper.toUpdateData(data);

    const result = await this.userRepo.update(id, updateData);
    if (result.affected === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    const user = await this.userRepo.findOneOrFail({ where: { id } });
    return UserMapper.toDomain(user);
  }

  async delete(id: string): Promise<void> {
    const result = await this.userRepo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  async softDelete(id: string): Promise<UserEntity> {
    const result = await this.userRepo.update(id, {
      deletedAt: new Date(),
      status: DbUserStatus.DELETED,
    });
    if (result.affected === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    const user = await this.userRepo.findOneOrFail({ where: { id } });
    return UserMapper.toDomain(user);
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.userRepo.count({ where: { id } });
    return count > 0;
  }
}
