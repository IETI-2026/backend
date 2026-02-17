import { RoleName } from '@prisma/client';

export class AuthResponseEntity {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
  user?: {
    id: string;
    email: string;
    fullName: string;
    profilePhotoUrl?: string;
    roles: RoleName[];
  };
}
