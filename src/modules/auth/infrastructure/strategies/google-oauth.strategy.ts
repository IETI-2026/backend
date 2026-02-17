import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

interface GoogleProfile {
  id: string;
  name?: {
    givenName?: string;
    familyName?: string;
  };
  emails?: Array<{ value: string }>;
  photos?: Array<{ value: string }>;
}

interface GoogleOAuthUser {
  provider: string;
  providerId: string;
  email?: string;
  fullName: string;
  profilePhotoUrl?: string;
  accessToken: string;
  refreshToken?: string;
}

@Injectable()
export class GoogleOAuthStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    super({
      clientID: configService.getOrThrow<string>('oauth.google.clientId'),
      clientSecret: configService.getOrThrow<string>(
        'oauth.google.clientSecret',
      ),
      callbackURL: configService.getOrThrow<string>('oauth.google.callbackUrl'),
      scope: ['profile', 'email'],
      passReqToCallback: true,
    });
  }

  async validate(
    _req: Request,
    accessToken: string,
    refreshToken: string,
    profile: GoogleProfile,
    done: VerifyCallback,
  ): Promise<void> {
    const { id, name, emails, photos } = profile;

    const user: GoogleOAuthUser = {
      provider: 'google',
      providerId: id,
      email: emails?.[0]?.value,
      fullName: `${name?.givenName || ''} ${name?.familyName || ''}`,
      profilePhotoUrl: photos?.[0]?.value,
      accessToken,
      refreshToken,
    };

    done(null, user);
  }
}
