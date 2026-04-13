import { configs } from '@config/index';
import { CacheModule } from '@nestjs/cache-manager';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-store';
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
    }),
    CacheModule.registerAsync<RedisClientOptions>({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const cacheConfig = configService.get('cache');

        // Para testing: usar in-memory cache
        if (cacheConfig.isTest) {
          return {
            ttl: cacheConfig.ttl,
          };
        }

        // Para production/development: usar Redis Cloud
        return {
          store: redisStore as unknown as string,
          url: cacheConfig.url,
          ttl: cacheConfig.ttl,
        } as RedisClientOptions;
      },
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
