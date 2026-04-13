import { registerAs } from '@nestjs/config';

export default registerAs('googleMaps', () => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_MAPS_API_KEY environment variable is not defined');
  }
  return { apiKey };
});
