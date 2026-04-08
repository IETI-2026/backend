import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { UserEntity as DbUserEntity } from '@/database/entities';
import { RoleName } from '@/database/enums';
import { TENANT_DATA_SOURCE } from '@/tenant';
import {
  AUTH_REPOSITORY,
  type IAuthRepository,
} from '../../../auth/domain/repositories';
import { CreateAdminUserDto, UserResponseDto } from '../dtos';
import { UsersService } from './users.service';

@Injectable()
export class AdminUsersService {
  private readonly userRepo: Repository<DbUserEntity>;

  constructor(
    private readonly usersService: UsersService,
    @Inject(AUTH_REPOSITORY)
    private readonly authRepository: IAuthRepository,
    @Inject(TENANT_DATA_SOURCE)
    dataSource: DataSource,
  ) {
    this.userRepo = dataSource.getRepository(DbUserEntity);
  }

  async createAdminUser(dto: CreateAdminUserDto): Promise<UserResponseDto> {
    if (![RoleName.ADMIN, RoleName.MODERATOR].includes(dto.role)) {
      throw new BadRequestException(
        'Only ADMIN or MODERATOR roles are allowed',
      );
    }

    const created = await this.usersService.create(dto);

    await this.authRepository.assignRoleToUser(created.id, dto.role);
    await this.userRepo.update(created.id, { primaryRole: dto.role });

    return this.usersService.findOne(created.id);
  }
}
