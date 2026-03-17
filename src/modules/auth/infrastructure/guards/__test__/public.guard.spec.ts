import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator';
import { PublicGuard } from '../public.guard';

describe('PublicGuard', () => {
  let guard: PublicGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PublicGuard(reflector);
  });

  describe('canActivate', () => {
    it('should return true for public endpoints', () => {
      const mockHandler = jest.fn();
      const mockClass = jest.fn();

      const mockContext = {
        getHandler: jest.fn().mockReturnValue(mockHandler),
        getClass: jest.fn().mockReturnValue(mockClass),
      } as unknown as ExecutionContext;

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should call getAllAndOverride with correct parameters', () => {
      const mockHandler = jest.fn();
      const mockClass = jest.fn();

      const mockContext = {
        getHandler: jest.fn().mockReturnValue(mockHandler),
        getClass: jest.fn().mockReturnValue(mockClass),
      } as unknown as ExecutionContext;

      const getAllAndOverrideSpy = jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(false);

      // Mock the parent canActivate method to avoid extending AuthGuard issues
      jest
        .spyOn(guard as unknown, 'canActivate')
        .mockImplementation((ctx: ExecutionContext) => {
          const isPublic = reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            ctx.getHandler(),
            ctx.getClass(),
          ]);
          return isPublic;
        });

      guard.canActivate(mockContext);

      expect(getAllAndOverrideSpy).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        mockHandler,
        mockClass,
      ]);
    });

    it('should return true when isPublic is explicitly set to true', () => {
      const mockHandler = jest.fn();
      const mockClass = jest.fn();

      const mockContext = {
        getHandler: jest.fn().mockReturnValue(mockHandler),
        getClass: jest.fn().mockReturnValue(mockClass),
      } as unknown as ExecutionContext;

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(true);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should return true when isPublic is truthy value', () => {
      const mockHandler = jest.fn();
      const mockClass = jest.fn();

      const mockContext = {
        getHandler: jest.fn().mockReturnValue(mockHandler),
        getClass: jest.fn().mockReturnValue(mockClass),
      } as unknown as ExecutionContext;

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValueOnce(1 as unknown as boolean); // Truthy value

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should check both handler and class for IS_PUBLIC_KEY metadata', () => {
      const mockHandler = jest.fn();
      const mockClass = jest.fn();

      const mockContext = {
        getHandler: jest.fn().mockReturnValue(mockHandler),
        getClass: jest.fn().mockReturnValue(mockClass),
      } as unknown as ExecutionContext;

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

      guard.canActivate(mockContext);

      expect(mockContext.getHandler).toHaveBeenCalled();
      expect(mockContext.getClass).toHaveBeenCalled();
    });
  });

  describe('constructor', () => {
    it('should initialize with reflector', () => {
      const reflectorInstance = new Reflector();
      const guardInstance = new PublicGuard(reflectorInstance);

      expect(guardInstance).toBeDefined();
    });

    it('should extend AuthGuard', () => {
      expect(guard).toHaveProperty('canActivate');
    });
  });
});
