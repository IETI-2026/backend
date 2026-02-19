import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        const duration = Date.now() - now;
        this.logger.log(
          `${method} ${url} ${response.statusCode} ${duration}ms`,
        );
      }),
      catchError((error) => {
        const duration = Date.now() - now;
        const status = error instanceof HttpException ? error.getStatus() : 500;

        if (status >= 500) {
          this.logger.error(`${method} ${url} ${status} ${duration}ms`);
        } else {
          this.logger.warn(`${method} ${url} ${status} ${duration}ms`);
        }

        return throwError(() => error);
      }),
    );
  }
}
