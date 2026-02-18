import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayloadEntity } from '../../domain/entities';

export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayloadEntity | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: JwtPayloadEntity = request.user;

    return data ? user?.[data] : user;
  },
);
