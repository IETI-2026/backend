import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient<Socket>();

    try {
      const token = this.extractToken(client);
      if (!token) {
        this.logger.warn(`WsJwtGuard: no token from client=${client.id}`);
        client.disconnect();
        return false;
      }

      const secret = this.configService.get<string>('jwt.secret');
      const payload = this.jwtService.verify(token, { secret });
      if (!payload?.sub) {
        this.logger.warn(
          `WsJwtGuard: token missing sub from client=${client.id}`,
        );
        client.disconnect();
        return false;
      }
      client.data.user = payload;
      return true;
    } catch (err) {
      this.logger.warn(
        `WsJwtGuard: invalid token from client=${client.id}: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      client.disconnect();
      return false;
    }
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token as string | undefined;
    if (authToken) {
      return authToken;
    }

    const authHeader = client.handshake.headers?.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    return null;
  }
}
