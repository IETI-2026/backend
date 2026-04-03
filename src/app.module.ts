import { configs } from '@config/index';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@/database/database.module';
import { HealthController } from './common/health.controller';
import { AuthModule } from './modules/auth';
import { GeocodingModule } from './modules/geocoding';
import { MailModule } from './modules/mail';
import { PaymentsModule } from './modules/payments';
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
    DatabaseModule,
    TenantModule,
    MailModule,
    GeocodingModule,
    AuthModule,
    UsersModule,
    ServiceRequestsModule,
    PaymentsModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
