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
export class AdminUserSeed implements OnModuleInit {
  private readonly logger = new Logger(AdminUserSeed.name);
  private readonly bcryptRounds = 10;

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
    @InjectRepository(UserRoleEntity)
    private readonly userRoleRepo: Repository<UserRoleEntity>,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const email = this.configService.get<string>('ADMIN_EMAIL');
    const password = this.configService.get<string>('ADMIN_PASSWORD');
    const fullName =
      this.configService.get<string>('ADMIN_FULLNAME') ?? 'Admin User';
    const phoneNumber = this.configService.get<string>('ADMIN_PHONE') ?? null;

    if (!email || !password) {
      this.logger.warn(
        'ADMIN_EMAIL or ADMIN_PASSWORD not set — skipping admin seed',
      );
      return;
    }

    const adminRole = await this.roleRepo.findOne({
      where: { name: RoleName.ADMIN },
    });
    if (!adminRole) {
      this.logger.error('ADMIN role not found — run the roles seed first');
      return;
    }

    let user = await this.userRepo.findOne({ where: { email } });

    if (!user) {
      const passwordHash = await bcrypt.hash(password, this.bcryptRounds);
      user = this.userRepo.create({
        email,
        fullName,
        passwordHash,
        phoneNumber,
        emailVerified: true,
        status: UserStatus.ACTIVE,
      });
      user = await this.userRepo.save(user);
      this.logger.log(`Admin user created: ${email}`);
    } else {
      this.logger.log(
        `Admin user already exists, ensuring ADMIN role: ${email}`,
      );
    }

    const existingRole = await this.userRoleRepo.findOne({
      where: { userId: user.id, roleId: adminRole.id },
    });

    if (!existingRole) {
      const userRole = this.userRoleRepo.create({
        userId: user.id,
        roleId: adminRole.id,
      });
      await this.userRoleRepo.save(userRole);
      this.logger.log(`ADMIN role assigned to: ${email}`);
    } else {
      this.logger.log(`ADMIN role already assigned to: ${email}`);
    }
  }
}
