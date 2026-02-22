import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { TenantModule } from '@/tenant';
import { BlobStorageModule } from '@common/blob-storage.module';
import { AuthModule } from '../auth';
import { ProviderProfileService, UsersService } from './application';
import { USER_REPOSITORY } from './domain';
import { UserPrismaRepository } from './infrastructure';
import { ProviderProfileController, UsersController } from './presentation';

@Module({
  imports: [PrismaModule, TenantModule, AuthModule, BlobStorageModule],
  controllers: [UsersController, ProviderProfileController],
  providers: [
    UsersService,
    ProviderProfileService,
    {
      provide: USER_REPOSITORY,
      useClass: UserPrismaRepository,
    },
  ],
  exports: [UsersService, ProviderProfileService],
})
export class UsersModule {}
