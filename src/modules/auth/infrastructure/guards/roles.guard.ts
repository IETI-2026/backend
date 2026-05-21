import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleName } from '@/database/enums';
import { JwtPayloadEntity } from '../../domain/entities';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RoleName[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: JwtPayloadEntity = request.user;

    if (!user || !user.roles) {
      this.logger.warn('Roles guard: user roles not found in request');
      throw new ForbiddenException('User roles not found');
    }

    const hasRole = requiredRoles.some((role) => user.roles?.includes(role));

    if (!hasRole) {
      this.logger.warn(
        `Roles guard: user ${user.sub} denied - required: [${requiredRoles.join(', ')}], has: [${user.roles.join(', ')}]`,
      );
      throw new ForbiddenException(
        `User does not have required roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
