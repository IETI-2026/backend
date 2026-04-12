import { configs } from '@config/index';
import { mailConfigSchema } from '@config/mail.config';
import { CacheModule } from '@nestjs/cache-manager';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { redisStore } from 'cache-manager-redis-store';
import * as Joi from 'joi';
import type { RedisClientOptions } from 'redis';
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
    CacheModule.registerAsync<RedisClientOptions>({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const cacheConfig = configService.get('cache');

        if (cacheConfig.isTest) {
          return {
            ttl: cacheConfig.ttl,
          };
        }

        return {
          store: redisStore as unknown as string,
          url: cacheConfig.url,
          ttl: cacheConfig.ttl,
        } as RedisClientOptions;
      },
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
