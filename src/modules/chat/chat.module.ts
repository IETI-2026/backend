import { Module } from '@nestjs/common';
import { TenantModule } from '@tenant/tenant.module';
import { AuthModule } from '../auth';
import { ServiceRequestsModule } from '../service-requests';
import { ChatService } from './application/chat.service';
import { ChatController } from './presentation/chat.controller';

@Module({
  imports: [TenantModule, AuthModule, ServiceRequestsModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
