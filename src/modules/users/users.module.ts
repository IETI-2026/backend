import { Module } from '@nestjs/common';
import { PrismaModule } from '@prisma/prisma.module';
import { TenantModule } from '@/tenant';
import { UsersService } from './application';
import { USER_REPOSITORY } from './domain';
import { UserPrismaRepository } from './infrastructure';
import { UsersController } from './presentation';

@Module({
  imports: [PrismaModule, TenantModule],
  controllers: [UsersController],
  providers: [
    UsersService,
    {
      provide: USER_REPOSITORY,
      useClass: UserPrismaRepository,
    },
  ],
  exports: [UsersService],
})
export class UsersModule {}
