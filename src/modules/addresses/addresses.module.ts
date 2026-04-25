import { Module } from '@nestjs/common';
import { TenantModule } from '@/tenant';
import { AuthModule } from '../auth';
import { AddressesService } from './application';
import { AddressesController } from './presentation/controllers';

@Module({
  imports: [TenantModule, AuthModule],
  controllers: [AddressesController],
  providers: [AddressesService],
  exports: [AddressesService],
})
export class AddressesModule {}
