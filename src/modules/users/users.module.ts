import { Module } from '@nestjs/common';
import { TenantModule } from '@/tenant';
import { AuthModule } from '../auth';
import {
  AdminUsersService,
  ProviderDocumentsService,
  ProviderProfileService,
  UsersService,
} from './application';
import { USER_REPOSITORY } from './domain';
import { UserTypeOrmRepository } from './infrastructure';
import {
  AdminUsersController,
  ProviderDocumentsController,
  ProviderProfileController,
  UsersController,
} from './presentation';

@Module({
  imports: [TenantModule, AuthModule],
  controllers: [
    UsersController,
    ProviderProfileController,
    AdminUsersController,
    ProviderDocumentsController,
  ],
  providers: [
    UsersService,
    AdminUsersService,
    ProviderProfileService,
    ProviderDocumentsService,
    {
      provide: USER_REPOSITORY,
      useClass: UserTypeOrmRepository,
    },
  ],
  exports: [UsersService, ProviderProfileService],
})
export class UsersModule {}
