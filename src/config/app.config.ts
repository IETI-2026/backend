import { Logger } from '@nestjs/common';
import { registerAs } from '@nestjs/config';

export default registerAs('app', () => {
  const logger = new Logger('AppConfig');
  let corsOrigins = process.env.CORS_ORIGINS;

  if (!corsOrigins) {
    corsOrigins = 'http://localhost:3000';
    logger.warn(
      'CORS_ORIGINS is not set — defaulting to http://localhost:3000',
    );
  }

  return {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigins,
    documentVerificationUrl: process.env.DOCUMENT_VERIFICATION_URL,
  };
});
