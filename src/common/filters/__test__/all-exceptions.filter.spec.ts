import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { AllExceptionsFilter } from '../all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockResponse: { status: jest.Mock; json: jest.Mock };
  let mockRequest: { method: string; url: string };
  let mockHost: { switchToHttp: jest.Mock; getType: jest.Mock };

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    mockResponse = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    mockRequest = { method: 'GET', url: '/test-path' };
    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(mockResponse),
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
      getType: jest.fn().mockReturnValue('http'),
    };
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => { jest.restoreAllMocks(); });

  describe('HttpException 4xx', () => {
    it('returns 400 with string response message', () => {
      const ex = new HttpException('Bad request message', HttpStatus.BAD_REQUEST);
      filter.catch(ex, mockHost as any);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'Bad request message',
          path: '/test-path',
          method: 'GET',
        }),
      );
    });

    it('returns 404 with object response', () => {
      const ex = new HttpException(
        { message: 'Not found', error: 'Not Found' },
        HttpStatus.NOT_FOUND,
      );
      filter.catch(ex, mockHost as any);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 404, message: 'Not found', error: 'Not Found' }),
      );
    });

    it('returns array message for validation errors', () => {
      const ex = new HttpException(
        { message: ['must not be empty', 'must be a string'], error: 'Bad Request' },
        HttpStatus.BAD_REQUEST,
      );
      filter.catch(ex, mockHost as any);
      const arg = mockResponse.json.mock.calls[0][0];
      expect(Array.isArray(arg.message)).toBe(true);
      expect(arg.message).toContain('must not be empty');
    });

    it('calls logger.warn for 4xx status', () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      filter.catch(new HttpException('Forbidden', HttpStatus.FORBIDDEN), mockHost as any);
      expect(warnSpy).toHaveBeenCalled();
    });

    it('fallback error when object lacks error field', () => {
      const ex = new HttpException({ message: 'Unprocessable' }, HttpStatus.UNPROCESSABLE_ENTITY);
      filter.catch(ex, mockHost as any);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Internal Server Error' }),
      );
    });

    it('fallback message when object lacks message field', () => {
      const ex = new HttpException({ error: 'Bad Request' }, HttpStatus.BAD_REQUEST);
      filter.catch(ex, mockHost as any);
      const arg = mockResponse.json.mock.calls[0][0];
      expect(arg.message).toBe('Internal server error');
    });
  });

  describe('HttpException 5xx', () => {
    it('returns 500 for InternalServerError', () => {
      filter.catch(new HttpException('Server blew up', HttpStatus.INTERNAL_SERVER_ERROR), mockHost as any);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });

    it('calls logger.error for 5xx', () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      filter.catch(new HttpException('Service unavailable', HttpStatus.SERVICE_UNAVAILABLE), mockHost as any);
      expect(errorSpy).toHaveBeenCalled();
    });

    it('passes stack trace to logger.error', () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const ex = new HttpException('Gateway timeout', HttpStatus.GATEWAY_TIMEOUT);
      filter.catch(ex, mockHost as any);
      expect(errorSpy).toHaveBeenCalledWith(expect.any(String), expect.anything());
    });
  });

  describe('generic Error', () => {
    it('returns 500 for a plain Error', () => {
      filter.catch(new Error('Unexpected failure'), mockHost as any);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });

    it('uses error.message and error.name', () => {
      filter.catch(new TypeError('Cannot read property'), mockHost as any);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Cannot read property', error: 'TypeError' }),
      );
    });

    it('calls logger.error for generic Error', () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      filter.catch(new Error('Boom'), mockHost as any);
      expect(errorSpy).toHaveBeenCalled();
    });

    it('passes stack to logger.error', () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const ex = new Error('stack test');
      filter.catch(ex, mockHost as any);
      expect(errorSpy).toHaveBeenCalledWith(expect.any(String), ex.stack);
    });
  });

  describe('plain thrown objects (non-Error)', () => {
    it('returns 500 for plain object', () => {
      filter.catch({ code: 'ERR_CUSTOM' }, mockHost as any);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          message: 'Internal server error',
          error: 'Internal Server Error',
        }),
      );
    });

    it('returns 500 when a string is thrown', () => {
      filter.catch('some string error', mockHost as any);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });

    it('does NOT call logger.warn for plain objects', () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      filter.catch({ foo: 'bar' }, mockHost as any);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('calls logger.error for null thrown value', () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      filter.catch(null, mockHost as any);
      expect(errorSpy).toHaveBeenCalled();
    });

    it('passes undefined stack to logger.error for non-Error', () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      filter.catch('plain string', mockHost as any);
      expect(errorSpy).toHaveBeenCalledWith(expect.any(String), undefined);
    });
  });

  describe('response shape invariants', () => {
    it('includes timestamp, path and method', () => {
      filter.catch(new Error('any'), mockHost as any);
      const arg = mockResponse.json.mock.calls[0][0];
      expect(arg).toHaveProperty('timestamp');
      expect(arg).toHaveProperty('path', '/test-path');
      expect(arg).toHaveProperty('method', 'GET');
    });

    it('produces a valid ISO timestamp', () => {
      filter.catch(new Error('ts'), mockHost as any);
      const { timestamp } = mockResponse.json.mock.calls[0][0];
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });

    it('reflects HTTP method and URL', () => {
      mockRequest.method = 'POST';
      mockRequest.url = '/api/v1/resource';
      filter.catch(new HttpException('conflict', HttpStatus.CONFLICT), mockHost as any);
      const arg = mockResponse.json.mock.calls[0][0];
      expect(arg.method).toBe('POST');
      expect(arg.path).toBe('/api/v1/resource');
    });
  });
});
