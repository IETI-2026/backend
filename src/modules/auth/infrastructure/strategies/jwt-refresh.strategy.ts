import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtPayloadEntity } from '../../domain/entities';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.refreshSecret'),
      passReqToCallback: true,
    } as any);
  }

  async validate(req: Request, payload: JwtPayloadEntity & { type: string }): Promise<JwtPayloadEntity> {
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
