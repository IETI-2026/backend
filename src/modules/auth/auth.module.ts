import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '@/prisma/prisma.module';
import { AuthPrismaRepository } from './infrastructure/persistence';
import {
  JwtStrategy,
  JwtRefreshStrategy,
  GoogleOAuthStrategy,
} from './infrastructure/strategies';

import { AuthService } from './application/services/auth.service';
import { AUTH_REPOSITORY } from './domain/repositories';
import { JwtAuthGuard, RolesGuard } from './infrastructure/guards';
import { AuthController } from './presentation';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => {
        const expiresIn = configService.get<string>('jwt.expiresIn') ?? '15m';
        return {
          secret: configService.get<string>('jwt.secret'),
          signOptions: { expiresIn: expiresIn as any },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      provide: AUTH_REPOSITORY,
      useClass: AuthPrismaRepository,
    },
    JwtStrategy,
    JwtRefreshStrategy,
    GoogleOAuthStrategy,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [AuthService, JwtAuthGuard, RolesGuard, AUTH_REPOSITORY],
})
export class AuthModule {}
