import { configs } from '@config/index';
import { mailConfigSchema } from '@config/mail.config';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import * as Joi from 'joi';
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
      validationSchema: Joi.object(mailConfigSchema),
      validationOptions: { abortEarly: false },
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60,
        limit: 60,
      },
    ]),
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
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
