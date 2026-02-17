import { RoleName } from '@prisma/client';

export class AuthResponseDto {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType: string = 'Bearer';
  user?: {
    id: string;
    email: string;
    fullName: string;
    profilePhotoUrl?: string;
    roles: RoleName[];
  };
}
