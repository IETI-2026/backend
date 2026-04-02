import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ALL_ENTITIES } from './entities';
import { RolesSeed, ServiceCategorySeed } from './seeds';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const url = configService.get<string>('database.url');
        return {
          type: 'postgres' as const,
          url,
          entities: ALL_ENTITIES,
          synchronize: true,
        };
      },
    }),
    TypeOrmModule.forFeature(ALL_ENTITIES),
  ],
  providers: [RolesSeed, ServiceCategorySeed],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
