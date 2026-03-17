import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator';
import { JwtAuthGuard } from '../jwt-auth.guard';

// ─── helpers ─────────────────────────────────────────────────────────────────

function buildContext(
  overrides: { handler?: object; classRef?: object } = {},
): ExecutionContext {
  return {
    getHandler: jest.fn().mockReturnValue(overrides.handler ?? {}),
    getClass: jest.fn().mockReturnValue(overrides.classRef ?? {}),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue({ headers: {} }),
      getResponse: jest.fn().mockReturnValue({}),
    }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
    reflector = module.get<Reflector>(Reflector);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  // ─── canActivate ─────────────────────────────────────────────────────────────

  describe('canActivate', () => {
    it('should return true immediately for routes marked as public', () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);
      const context = buildContext();

      const result = guard.canActivate(context);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      expect(result).toBe(true);
    });

    it('should call super.canActivate for non-public routes', () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
      const superCanActivate = jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(guard)),
          'canActivate',
        )
        .mockReturnValue(true);
      const context = buildContext();

      const result = guard.canActivate(context);

      expect(superCanActivate).toHaveBeenCalledWith(context);
      expect(result).toBe(true);

      superCanActivate.mockRestore();
    });

    it('should call super.canActivate when public metadata is undefined', () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
      const superCanActivate = jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(guard)),
          'canActivate',
        )
        .mockReturnValue(true);
      const context = buildContext();

      guard.canActivate(context);

      expect(superCanActivate).toHaveBeenCalledWith(context);
      superCanActivate.mockRestore();
    });
  });

  // ─── handleRequest ────────────────────────────────────────────────────────────

  describe('handleRequest', () => {
    it('should return the user when no error and user is present', () => {
      const user = { sub: 'user-uuid-001', email: 'test@example.com' };

      const result = guard.handleRequest(null, user, undefined);

      expect(result).toBe(user);
    });

    it('should throw UnauthorizedException when user is null', () => {
      expect(() => guard.handleRequest(null, null, undefined)).toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user is undefined', () => {
      expect(() => guard.handleRequest(null, undefined, undefined)).toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when err is provided', () => {
      const error = new Error('Token expired');

      expect(() => guard.handleRequest(error, null, undefined)).toThrow(
        UnauthorizedException,
      );
    });

    it('should use info.message in the UnauthorizedException when info is provided', () => {
      const info = new Error('jwt expired');

      let thrownError: UnauthorizedException | undefined;
      try {
        guard.handleRequest(null, null, info);
      } catch (e) {
        thrownError = e as UnauthorizedException;
      }

      expect(thrownError).toBeInstanceOf(UnauthorizedException);
      expect(thrownError?.message).toBe('jwt expired');
    });

    it('should use default message when info is undefined and no user', () => {
      let thrownError: UnauthorizedException | undefined;
      try {
        guard.handleRequest(null, null, undefined);
      } catch (e) {
        thrownError = e as UnauthorizedException;
      }

      expect(thrownError).toBeInstanceOf(UnauthorizedException);
      expect(thrownError?.message).toBe('Access token is missing or invalid');
    });
  });
});
