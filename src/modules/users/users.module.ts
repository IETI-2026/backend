import { Module } from '@nestjs/common';
import { TenantModule } from '@/tenant';
import { AuthModule } from '../auth';
import { ProviderProfileService, UsersService } from './application';
import { USER_REPOSITORY } from './domain';
import { UserTypeOrmRepository } from './infrastructure';
import { ProviderProfileController, UsersController } from './presentation';

@Module({
  imports: [
    TenantModule,
    AuthModule,
  ],
  controllers: [UsersController, ProviderProfileController],
  providers: [
    UsersService,
    ProviderProfileService,
    {
      provide: USER_REPOSITORY,
      useClass: UserTypeOrmRepository,
    },
  ],
  exports: [UsersService, ProviderProfileService],
})
export class UsersModule {}
