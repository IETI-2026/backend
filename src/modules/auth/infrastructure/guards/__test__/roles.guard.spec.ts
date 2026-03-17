import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { RoleName } from '@/database/enums';
import { ROLES_KEY } from '../../decorators/roles.decorator';
import { RolesGuard } from '../roles.guard';

// ---------------------------------------------------------------------------
// Helper: build a minimal ExecutionContext mock
// ---------------------------------------------------------------------------
function buildContext(
  _requiredRoles: RoleName[] | undefined,
  userRoles: RoleName[] | undefined,
): ExecutionContext {
  const handler = jest.fn();
  const classRef = jest.fn();

  const request = {
    user:
      userRoles !== undefined
        ? { sub: 'u-1', email: 'a@b.com', roles: userRoles }
        : undefined,
  };

  return {
    getHandler: () => handler,
    getClass: () => classRef,
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get(RolesGuard);
    reflector = module.get(Reflector);
  });

  // -------------------------------------------------------------------------
  // No metadata at all
  // -------------------------------------------------------------------------

  describe('when no roles metadata is defined', () => {
    it('returns true (allows the request)', () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);
      const ctx = buildContext(undefined, [RoleName.USER]);

      const result = guard.canActivate(ctx);

      expect(result).toBe(true);
    });

    it('returns true when metadata is an empty array', () => {
      reflector.getAllAndOverride.mockReturnValue([]);
      const ctx = buildContext([], [RoleName.USER]);

      const result = guard.canActivate(ctx);

      expect(result).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // User has the required role
  // -------------------------------------------------------------------------

  describe('when user has the required role', () => {
    it('returns true for a single matching role', () => {
      reflector.getAllAndOverride.mockReturnValue([RoleName.ADMIN]);
      const ctx = buildContext([RoleName.ADMIN], [RoleName.ADMIN]);

      const result = guard.canActivate(ctx);

      expect(result).toBe(true);
    });

    it('returns true when user has one of several required roles', () => {
      reflector.getAllAndOverride.mockReturnValue([
        RoleName.ADMIN,
        RoleName.MODERATOR,
      ]);
      const ctx = buildContext(
        [RoleName.ADMIN, RoleName.MODERATOR],
        [RoleName.MODERATOR, RoleName.USER],
      );

      const result = guard.canActivate(ctx);

      expect(result).toBe(true);
    });

    it('uses the ROLES_KEY when calling reflector', () => {
      reflector.getAllAndOverride.mockReturnValue([RoleName.USER]);
      const handler = jest.fn();
      const classRef = jest.fn();

      const ctx = {
        getHandler: () => handler,
        getClass: () => classRef,
        switchToHttp: () => ({
          getRequest: () => ({ user: { roles: [RoleName.USER] } }),
        }),
      } as unknown as ExecutionContext;

      guard.canActivate(ctx);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
        handler,
        classRef,
      ]);
    });
  });

  // -------------------------------------------------------------------------
  // User does not have the required role
  // -------------------------------------------------------------------------

  describe('when user is missing the required role', () => {
    it('throws ForbiddenException', () => {
      reflector.getAllAndOverride.mockReturnValue([RoleName.ADMIN]);
      const ctx = buildContext([RoleName.ADMIN], [RoleName.USER]);

      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('includes the missing role name in the error message', () => {
      reflector.getAllAndOverride.mockReturnValue([RoleName.ADMIN]);
      const ctx = buildContext([RoleName.ADMIN], [RoleName.USER]);

      expect(() => guard.canActivate(ctx)).toThrow(
        `User does not have required roles: ${RoleName.ADMIN}`,
      );
    });

    it('lists all required roles in the error message when multiple are specified', () => {
      reflector.getAllAndOverride.mockReturnValue([
        RoleName.ADMIN,
        RoleName.MODERATOR,
      ]);
      const ctx = buildContext(
        [RoleName.ADMIN, RoleName.MODERATOR],
        [RoleName.USER],
      );

      expect(() => guard.canActivate(ctx)).toThrow(
        `User does not have required roles: ${RoleName.ADMIN}, ${RoleName.MODERATOR}`,
      );
    });
  });

  // -------------------------------------------------------------------------
  // User object is absent or incomplete
  // -------------------------------------------------------------------------

  describe('when the request user is absent or has no roles', () => {
    it('throws ForbiddenException when request.user is undefined', () => {
      reflector.getAllAndOverride.mockReturnValue([RoleName.USER]);

      const ctx = {
        getHandler: () => jest.fn(),
        getClass: () => jest.fn(),
        switchToHttp: () => ({
          getRequest: () => ({ user: undefined }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(ctx)).toThrow('User roles not found');
    });

    it('throws ForbiddenException when user.roles is undefined', () => {
      reflector.getAllAndOverride.mockReturnValue([RoleName.USER]);

      const ctx = {
        getHandler: () => jest.fn(),
        getClass: () => jest.fn(),
        switchToHttp: () => ({
          getRequest: () => ({
            user: { sub: 'u-1', email: 'a@b.com', roles: undefined },
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(ctx)).toThrow('User roles not found');
    });
  });
});
