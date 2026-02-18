import { RoleName } from '@prisma/client';

export class JwtPayloadEntity {
  sub?: string;
  email?: string;
  roles?: RoleName[];
  iat?: number;
  exp?: number;
}
