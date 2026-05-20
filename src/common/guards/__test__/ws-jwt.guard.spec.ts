import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { WsJwtGuard } from '../ws-jwt.guard';

function buildMockSocket(overrides: Record<string, unknown> = {}) {
  return {
    id: 'socket-001',
    data: {},
    disconnect: jest.fn(),
    handshake: {
      auth: {},
      headers: {},
      ...overrides,
    },
  };
}

function buildContext(
  client: ReturnType<typeof buildMockSocket>,
): ExecutionContext {
  return {
    switchToWs: () => ({
      getClient: () => client,
    }),
  } as unknown as ExecutionContext;
}

describe('WsJwtGuard', () => {
  let guard: WsJwtGuard;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        WsJwtGuard,
        { provide: JwtService, useValue: { verify: jest.fn() } },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-secret') },
        },
      ],
    }).compile();

    guard = module.get(WsJwtGuard);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate — no token', () => {
    it('should disconnect and return false when no token is present', () => {
      const client = buildMockSocket();
      const ctx = buildContext(client);

      const result = guard.canActivate(ctx);

      expect(result).toBe(false);
      expect(client.disconnect).toHaveBeenCalled();
    });
  });

  describe('canActivate — Bearer token', () => {
    it('should authenticate and attach user from Authorization header', () => {
      const payload = { sub: 'user-001', email: 'u@test.com' };
      jwtService.verify.mockReturnValue(payload);

      const client = buildMockSocket({
        headers: { authorization: 'Bearer valid-token' },
      });
      const ctx = buildContext(client);

      const result = guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(jwtService.verify).toHaveBeenCalledWith('valid-token', {
        secret: 'test-secret',
      });
      expect(client.data.user).toEqual(payload);
    });
  });

  describe('canActivate — handshake auth token', () => {
    it('should authenticate from handshake.auth.token', () => {
      const payload = { sub: 'user-002' };
      jwtService.verify.mockReturnValue(payload);

      const client = buildMockSocket({ auth: { token: 'handshake-token' } });
      const ctx = buildContext(client);

      const result = guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(jwtService.verify).toHaveBeenCalledWith('handshake-token', {
        secret: 'test-secret',
      });
    });
  });

  describe('canActivate — invalid token', () => {
    it('should disconnect and return false when jwt.verify throws', () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      const client = buildMockSocket({ auth: { token: 'bad-token' } });
      const ctx = buildContext(client);

      const result = guard.canActivate(ctx);

      expect(result).toBe(false);
      expect(client.disconnect).toHaveBeenCalled();
    });
  });

  describe('canActivate — token missing sub', () => {
    it('should disconnect and return false when payload has no sub', () => {
      jwtService.verify.mockReturnValue({ email: 'u@test.com' });

      const client = buildMockSocket({ auth: { token: 'no-sub-token' } });
      const ctx = buildContext(client);

      const result = guard.canActivate(ctx);

      expect(result).toBe(false);
      expect(client.disconnect).toHaveBeenCalled();
    });
  });

  describe('canActivate — non-Bearer Authorization header', () => {
    it('should disconnect when Authorization header lacks Bearer prefix', () => {
      const client = buildMockSocket({
        headers: { authorization: 'Basic abc123' },
      });
      const ctx = buildContext(client);

      const result = guard.canActivate(ctx);

      expect(result).toBe(false);
      expect(client.disconnect).toHaveBeenCalled();
    });
  });

  describe('canActivate — configService behavior', () => {
    it('should call configService to retrieve jwt.secret', () => {
      jwtService.verify.mockReturnValue({ sub: 'user-003' });

      const client = buildMockSocket({ auth: { token: 'token-x' } });
      const ctx = buildContext(client);

      guard.canActivate(ctx);

      expect(configService.get).toHaveBeenCalledWith('jwt.secret');
    });
  });
});
