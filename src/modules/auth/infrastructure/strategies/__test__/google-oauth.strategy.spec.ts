import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { GoogleOAuthStrategy } from '../google-oauth.strategy';

// ---------------------------------------------------------------------------
// Mock passport-google-oauth20 so the PassportStrategy super() call does not
// attempt real OAuth registration during unit tests.
// ---------------------------------------------------------------------------
jest.mock('passport-google-oauth20', () => {
  class MockStrategy {}
  return { Strategy: MockStrategy };
});

describe('GoogleOAuthStrategy', () => {
  let strategy: GoogleOAuthStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleOAuthStrategy,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              const map: Record<string, string> = {
                'oauth.google.clientId': 'mock-client-id',
                'oauth.google.clientSecret': 'mock-client-secret',
                'oauth.google.callbackUrl':
                  'http://localhost/auth/google/callback',
              };
              if (key in map) return map[key];
              throw new Error(`Missing config key: ${key}`);
            }),
          },
        },
      ],
    }).compile();

    strategy = module.get(GoogleOAuthStrategy);
  });

  // -------------------------------------------------------------------------
  // validate
  // -------------------------------------------------------------------------

  describe('validate', () => {
    const mockRequest = {} as unknown;
    const accessToken = 'access-token-abc';
    const refreshToken = 'refresh-token-xyz';

    const fullProfile = {
      id: 'google-123',
      name: { givenName: 'John', familyName: 'Doe' },
      emails: [{ value: 'john.doe@gmail.com' }],
      photos: [{ value: 'https://photo.url/pic.jpg' }],
    };

    it('calls done with a correctly shaped user object', async () => {
      const done = jest.fn();

      await strategy.validate(
        mockRequest,
        accessToken,
        refreshToken,
        fullProfile,
        done,
      );

      expect(done).toHaveBeenCalledWith(null, {
        provider: 'google',
        providerId: 'google-123',
        email: 'john.doe@gmail.com',
        fullName: 'John Doe',
        profilePhotoUrl: 'https://photo.url/pic.jpg',
        accessToken,
        refreshToken,
      });
    });

    it('handles missing email gracefully (sets undefined)', async () => {
      const done = jest.fn();
      const profileNoEmail = { ...fullProfile, emails: undefined };

      await strategy.validate(
        mockRequest,
        accessToken,
        refreshToken,
        profileNoEmail as unknown,
        done,
      );

      expect(done).toHaveBeenCalledWith(
        null,
        expect.objectContaining({ email: undefined }),
      );
    });

    it('handles missing photos gracefully (sets undefined profilePhotoUrl)', async () => {
      const done = jest.fn();
      const profileNoPhoto = { ...fullProfile, photos: undefined };

      await strategy.validate(
        mockRequest,
        accessToken,
        refreshToken,
        profileNoPhoto as unknown,
        done,
      );

      expect(done).toHaveBeenCalledWith(
        null,
        expect.objectContaining({ profilePhotoUrl: undefined }),
      );
    });

    it('handles missing name fields with empty strings', async () => {
      const done = jest.fn();
      const profileNoName = { ...fullProfile, name: undefined };

      await strategy.validate(
        mockRequest,
        accessToken,
        refreshToken,
        profileNoName as unknown,
        done,
      );

      expect(done).toHaveBeenCalledWith(
        null,
        expect.objectContaining({ fullName: ' ' }),
      );
    });

    it('constructs fullName from given and family name parts', async () => {
      const done = jest.fn();
      const profilePartialName = {
        ...fullProfile,
        name: { givenName: 'Alice', familyName: undefined },
      };

      await strategy.validate(
        mockRequest,
        accessToken,
        refreshToken,
        profilePartialName as unknown,
        done,
      );

      const calledUser = done.mock.calls[0][1];
      expect(calledUser.fullName).toBe('Alice ');
    });

    it('passes the accessToken through', async () => {
      const done = jest.fn();

      await strategy.validate(
        mockRequest,
        'my-special-token',
        refreshToken,
        fullProfile,
        done,
      );

      expect(done).toHaveBeenCalledWith(
        null,
        expect.objectContaining({ accessToken: 'my-special-token' }),
      );
    });

    it('passes the refreshToken through', async () => {
      const done = jest.fn();

      await strategy.validate(
        mockRequest,
        accessToken,
        'my-special-refresh',
        fullProfile,
        done,
      );

      expect(done).toHaveBeenCalledWith(
        null,
        expect.objectContaining({ refreshToken: 'my-special-refresh' }),
      );
    });
  });
});
