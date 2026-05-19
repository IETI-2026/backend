import { MailModule } from '@mail/mail.module';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { BlobStorageService } from '@/common/services/blob-storage.service';
import { TenantModule } from '@/tenant';
import { AuthService } from './application/services/auth.service';
import { AUTH_REPOSITORY } from './domain/repositories';
import { JwtAuthGuard, RolesGuard } from './infrastructure/guards';
import { AuthTypeOrmRepository } from './infrastructure/persistence';
import {
  GoogleOAuthStrategy,
  JwtRefreshStrategy,
  JwtStrategy,
} from './infrastructure/strategies';
import { AuthController } from './presentation';

@Module({
  imports: [
    TenantModule,
    MailModule,
    PassportModule,
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => {
        const expiresIn = configService.get('jwt.expiresIn') ?? '15m';
        const secret = configService.get<string>('jwt.secret');
        if (!secret) {
          throw new Error('JWT secret is required');
        }
        return {
          secret,
          signOptions: { expiresIn },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    BlobStorageService,
    {
      provide: AUTH_REPOSITORY,
      useClass: AuthTypeOrmRepository,
    },
    JwtStrategy,
    JwtRefreshStrategy,
    GoogleOAuthStrategy,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [AuthService, JwtAuthGuard, RolesGuard, AUTH_REPOSITORY, JwtModule],
})
export class AuthModule {}
