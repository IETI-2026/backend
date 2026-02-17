import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { type Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayloadEntity } from '../../domain/entities';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(configService: ConfigService) {
    const refreshSecret = configService.get<string>('jwt.refreshSecret');
    if (!refreshSecret) {
      throw new Error('JWT refresh secret is required');
    }

    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: refreshSecret,
      passReqToCallback: true,
    });
  }

  async validate(
    _req: Request,
    payload: JwtPayloadEntity & { type: string },
  ): Promise<JwtPayloadEntity> {
    if (payload.type !== 'refresh') {
      throw new BadRequestException('Invalid refresh token');
    }

    return {
      sub: payload.sub,
      email: payload.email,
      roles: payload.roles,
    };
  }
}
