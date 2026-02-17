import { configs } from '@config/index';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@/prisma/prisma.module';
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
    UsersModule,
    ServiceRequestsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Aplica el middleware de tenant a todas las rutas
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
