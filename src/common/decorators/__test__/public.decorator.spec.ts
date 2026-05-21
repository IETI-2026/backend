import 'reflect-metadata';
import { IS_PUBLIC_KEY, Public } from '../public.decorator';

describe('Public Decorator', () => {
  it('should set the IS_PUBLIC_KEY metadata to true on method', () => {
    class TestController {
      @Public()
      publicMethod() {
        return 'public';
      }
    }

    const metadata = Reflect.getMetadata(
      IS_PUBLIC_KEY,
      TestController.prototype.publicMethod,
    );
    expect(metadata).toBe(true);
  });

  it('should have the correct IS_PUBLIC_KEY constant', () => {
    expect(IS_PUBLIC_KEY).toBe('isPublic');
  });

  it('should be usable as a method decorator', () => {
    class TestController {
      @Public()
      publicMethod() {
        return 'public';
      }
    }

    const metadata = Reflect.getMetadata(
      IS_PUBLIC_KEY,
      TestController.prototype.publicMethod,
    );
    expect(metadata).toBe(true);
  });

  it('should be usable on multiple methods', () => {
    class TestController {
      @Public()
      method1() {}

      @Public()
      method2() {}

      regularMethod() {}
    }

    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, TestController.prototype.method1),
    ).toBe(true);
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, TestController.prototype.method2),
    ).toBe(true);
    expect(
      Reflect.getMetadata(
        IS_PUBLIC_KEY,
        TestController.prototype.regularMethod,
      ),
    ).toBeUndefined();
  });

  it('should set metadata on class level', () => {
    @Public()
    class TestClass {}

    const metadata = Reflect.getMetadata(IS_PUBLIC_KEY, TestClass);
    expect(metadata).toBe(true);
  });

  it('should not set metadata on methods without decorator', () => {
    class TestController {
      publicMethod() {
        return 'public';
      }
    }

    const metadata = Reflect.getMetadata(
      IS_PUBLIC_KEY,
      TestController.prototype.publicMethod,
    );
    expect(metadata).toBeUndefined();
  });
});
