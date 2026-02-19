import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '@/prisma/prisma.module';
import { AuthService } from './application/services/auth.service';
import { AUTH_REPOSITORY } from './domain/repositories';
import { JwtAuthGuard, RolesGuard } from './infrastructure/guards';
import { AuthPrismaRepository } from './infrastructure/persistence';
import {
  GoogleOAuthStrategy,
  JwtRefreshStrategy,
  JwtStrategy,
} from './infrastructure/strategies';
import { AuthController } from './presentation';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => {
        const expiresIn = configService.get<string>('jwt.expiresIn') ?? '15m';
        const secret = configService.get<string>('jwt.secret');
        if (!secret) {
          throw new Error('JWT secret is required');
        }
        return {
          secret,
          signOptions: { expiresIn: expiresIn },
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
