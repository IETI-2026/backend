import { RoleName } from '@/database/enums';

export class JwtPayloadEntity {
  sub?: string;
  email?: string;
  roles?: RoleName[];
  iat?: number;
  exp?: number;
}
