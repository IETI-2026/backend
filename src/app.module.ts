import { configs } from '@config/index';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@/prisma/prisma.module';
import { HealthController } from './common/health.controller';
import { GeocodingModule } from './modules/geocoding';
import { AuthModule } from './modules/auth';
import { ServiceRequestsModule } from './modules/service-requests';
import { UsersModule } from './modules/users';
import { TenantMiddleware, TenantModule } from './tenant';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: configs,
      envFilePath: '.env',
    }),
    PrismaModule,
    TenantModule,
    GeocodingModule,
    AuthModule,
    UsersModule,
    ServiceRequestsModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
