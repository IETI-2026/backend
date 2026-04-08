import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { RoleEntity } from '../entities/role.entity';
import { UserEntity } from '../entities/user.entity';
import { UserRoleEntity } from '../entities/user-role.entity';
import { RoleName, UserStatus } from '../enums';

@Injectable()
export class AdminSeed implements OnModuleInit {
  private readonly logger = new Logger(AdminSeed.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
    @InjectRepository(UserRoleEntity)
    private readonly userRoleRepo: Repository<UserRoleEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    const email = this.configService.get<string>('ADMIN_EMAIL')?.trim();
    const password = this.configService.get<string>('ADMIN_PASSWORD')?.trim();
    const fullName =
      this.configService.get<string>('ADMIN_FULLNAME')?.trim() ?? 'Admin User';
    const phoneNumber =
      this.configService.get<string>('ADMIN_PHONE')?.trim() ?? null;

    if (!email || !password) {
      this.logger.warn(
        'Admin seed skipped: ADMIN_EMAIL or ADMIN_PASSWORD missing',
      );
      return;
    }

    let adminRole = await this.roleRepo.findOne({
      where: { name: RoleName.ADMIN },
    });
    if (!adminRole) {
      adminRole = await this.roleRepo.save(
        this.roleRepo.create({ name: RoleName.ADMIN }),
      );
    }

    const existingUser = await this.userRepo.findOne({ where: { email } });
    const passwordHash = await bcrypt.hash(password, 10);

    const user = existingUser
      ? await this.userRepo.save(
          this.userRepo.merge(existingUser, {
            fullName,
            phoneNumber,
            passwordHash,
            primaryRole: RoleName.ADMIN,
            status: UserStatus.ACTIVE,
          }),
        )
      : await this.userRepo.save(
          this.userRepo.create({
            email,
            fullName,
            phoneNumber,
            passwordHash,
            primaryRole: RoleName.ADMIN,
            status: UserStatus.ACTIVE,
            emailVerified: true,
          }),
        );

    const userRole = await this.userRoleRepo.findOne({
      where: { userId: user.id, roleId: adminRole.id },
    });

    if (!userRole) {
      await this.userRoleRepo.save(
        this.userRoleRepo.create({
          userId: user.id,
          roleId: adminRole.id,
          assignedBy: null,
        }),
      );
    }

    this.logger.log(`Admin seed ready for ${email}`);
  }
}
