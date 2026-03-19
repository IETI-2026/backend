import { ExecutionContext } from '@nestjs/common';

describe('CurrentUser Decorator', () => {
  let mockContext: ExecutionContext;

  const createMockContext = (user: unknown): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
        }),
      }),
    } as unknown as ExecutionContext;
  };

  const getDecoratorFactory = () => {
    return (_data: unknown, ctx: ExecutionContext) => {
      const request = ctx.switchToHttp().getRequest();
      return request.user;
    };
  };

  it('should return the user from request object', () => {
    const userData = {
      sub: 'test-user-id',
      email: 'test@example.com',
      roles: ['user'],
    };

    mockContext = createMockContext(userData);
    const factory = getDecoratorFactory();
    const result = factory(undefined, mockContext);

    expect(result).toEqual(userData);
  });

  it('should handle context with user data correctly', () => {
    const userData = {
      sub: 'user-123',
      email: 'user@example.com',
      roles: ['provider'],
    };

    mockContext = createMockContext(userData);
    const factory = getDecoratorFactory();
    const result = factory(undefined, mockContext);

    expect(result).toEqual(userData);
    expect(result.sub).toBe('user-123');
    expect(result.email).toBe('user@example.com');
  });

  it('should return undefined when user is not set', () => {
    mockContext = createMockContext(undefined);
    const factory = getDecoratorFactory();
    const result = factory(undefined, mockContext);

    expect(result).toBeUndefined();
  });

  it('should work with various user objects', () => {
    const testCases = [
      { sub: '1', email: 'a@example.com' },
      { sub: '2', email: 'b@example.com', roles: ['admin'] },
      { sub: '3', email: 'c@example.com', roles: ['user', 'provider'] },
    ];

    const factory = getDecoratorFactory();

    testCases.forEach((userData) => {
      mockContext = createMockContext(userData);
      const result = factory(undefined, mockContext);

      expect(result).toEqual(userData);
    });
  });

  it('should work with null user value', () => {
    mockContext = createMockContext(null);
    const factory = getDecoratorFactory();
    const result = factory(undefined, mockContext);

    expect(result).toBeNull();
  });
});
