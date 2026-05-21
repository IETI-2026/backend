import { registerAs } from '@nestjs/config';

export default registerAs('oauth', () => {
  const callbackUrl = process.env.GOOGLE_CALLBACK_URL;
  if (!callbackUrl) {
    throw new Error('GOOGLE_CALLBACK_URL environment variable is not defined');
  }

  const frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl) {
    throw new Error('FRONTEND_URL environment variable is not defined');
  }

  return {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackUrl,
    },
    frontend: {
      url: frontendUrl,
    },
  };
});
