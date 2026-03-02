import { Module } from "@nestjs/common";
import { TenantModule } from "@/tenant";
import { AuthModule } from "../auth";
import { ServiceRequestsService } from "./application";
import { ServiceRequestsController } from "./presentation";

@Module({
  imports: [TenantModule, AuthModule],
  controllers: [ServiceRequestsController],
  providers: [ServiceRequestsService],
  exports: [ServiceRequestsService],
})
export class ServiceRequestsModule {}
