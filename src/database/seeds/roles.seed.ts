import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoleEntity } from '../entities/role.entity';
import { RoleName } from '../enums';

@Injectable()
export class RolesSeed implements OnModuleInit {
  private readonly logger = new Logger(RolesSeed.name);

  constructor(
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    for (const name of Object.values(RoleName)) {
      const exists = await this.roleRepo.findOne({ where: { name } });
      if (!exists) {
        await this.roleRepo.save(this.roleRepo.create({ name }));
        this.logger.log(`Seeded role: ${name}`);
      }
    }
  }
}
