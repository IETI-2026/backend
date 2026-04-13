import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not defined');
  }
  if (!process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_REFRESH_SECRET environment variable is not defined');
  }

  const secret: string = process.env.JWT_SECRET;
  const refreshSecret: string = process.env.JWT_REFRESH_SECRET;

  return {
    secret,
    refreshSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  };
});
