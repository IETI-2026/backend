import { configs } from '@config/index';
import { mailConfigSchema } from '@config/mail.config';
import { CacheModule } from '@nestjs/cache-manager';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import * as Joi from 'joi';
import { DatabaseModule } from '@/database/database.module';
import { HealthController } from './common/health.controller';
import { AddressesModule } from './modules/addresses';
import { AuthModule } from './modules/auth';
import { GeocodingModule } from './modules/geocoding';
import { MailModule } from './modules/mail';
import { PaymentsModule } from './modules/payments';
import { ServiceRequestsModule } from './modules/service-requests';
import { SkillSuggestionsModule } from './modules/skill-suggestions';
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
    CacheModule.register({
      isGlobal: true,
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
    SkillSuggestionsModule,
    AddressesModule,
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
