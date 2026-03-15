import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { LoggingInterceptor } from '../logging.interceptor';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let mockContext: { switchToHttp: jest.Mock };
  let mockCallHandler: { handle: jest.Mock };
  let mockRequest: { method: string; url: string };
  let mockResponse: { statusCode: number };

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
    mockRequest = { method: 'GET', url: '/api/test' };
    mockResponse = { statusCode: 200 };
    mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
    };
    mockCallHandler = { handle: jest.fn() };
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => { jest.restoreAllMocks(); });

  describe('intercept()', () => {
    it('calls next.handle() and returns an Observable', (done) => {
      mockCallHandler.handle.mockReturnValue(of({}));
      const result$ = interceptor.intercept(mockContext as any, mockCallHandler as any);
      expect(mockCallHandler.handle).toHaveBeenCalled();
      result$.subscribe({ complete: () => done() });
    });

    it('logs on success via tap', (done) => {
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
      mockCallHandler.handle.mockReturnValue(of({ data: true }));
      interceptor.intercept(mockContext as any, mockCallHandler as any).subscribe({
        complete: () => {
          expect(logSpy).toHaveBeenCalledWith(
            expect.stringMatching(/GET \/api\/test 200 \d+ms/),
          );
          done();
        },
      });
    });

    it('calls logger.warn for 4xx HttpException', (done) => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const err = new HttpException('Not found', HttpStatus.NOT_FOUND);
      mockCallHandler.handle.mockReturnValue(throwError(() => err));
      interceptor.intercept(mockContext as any, mockCallHandler as any).subscribe({
        error: () => {
          expect(warnSpy).toHaveBeenCalledWith(
            expect.stringMatching(/GET \/api\/test 404 \d+ms/),
          );
          done();
        },
      });
    });

    it('calls logger.error for 5xx HttpException', (done) => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const err = new HttpException('Internal', HttpStatus.INTERNAL_SERVER_ERROR);
      mockCallHandler.handle.mockReturnValue(throwError(() => err));
      interceptor.intercept(mockContext as any, mockCallHandler as any).subscribe({
        error: () => {
          expect(errorSpy).toHaveBeenCalledWith(
            expect.stringMatching(/GET \/api\/test 500 \d+ms/),
          );
          done();
        },
      });
    });

    it('calls logger.error and uses 500 for non-HttpException', (done) => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const err = new Error('Unknown error');
      mockCallHandler.handle.mockReturnValue(throwError(() => err));
      interceptor.intercept(mockContext as any, mockCallHandler as any).subscribe({
        error: () => {
          expect(errorSpy).toHaveBeenCalledWith(
            expect.stringMatching(/GET \/api\/test 500 \d+ms/),
          );
          done();
        },
      });
    });

    it('re-throws the original error after logging', (done) => {
      const originalError = new Error('must propagate');
      mockCallHandler.handle.mockReturnValue(throwError(() => originalError));
      interceptor.intercept(mockContext as any, mockCallHandler as any).subscribe({
        error: (err: unknown) => {
          expect(err).toBe(originalError);
          done();
        },
      });
    });

    it('logs 400 as warn not error', (done) => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const err = new HttpException('Bad Request', HttpStatus.BAD_REQUEST);
      mockCallHandler.handle.mockReturnValue(throwError(() => err));
      interceptor.intercept(mockContext as any, mockCallHandler as any).subscribe({
        error: () => {
          expect(warnSpy).toHaveBeenCalled();
          expect(errorSpy).not.toHaveBeenCalled();
          done();
        },
      });
    });
  });
});
