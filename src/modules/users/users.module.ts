import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TenantModule } from '@/tenant';
import { BlobStorageService } from '../../common/services/blob-storage.service';
import { AuthModule } from '../auth';
import { ProviderProfileService, UsersService } from './application';
import { USER_REPOSITORY } from './domain';
import { UserTypeOrmRepository } from './infrastructure';
import { ProviderProfileController, UsersController } from './presentation';

@Module({
  imports: [TenantModule, AuthModule, HttpModule],
  controllers: [UsersController, ProviderProfileController],
  providers: [
    UsersService,
    ProviderProfileService,
    BlobStorageService,
    {
      provide: USER_REPOSITORY,
      useClass: UserTypeOrmRepository,
    },
  ],
  exports: [UsersService, ProviderProfileService],
})
export class UsersModule {}
