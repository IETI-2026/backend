import { registerAs } from '@nestjs/config';

export default registerAs('cache', () => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const nodeEnv = process.env.NODE_ENV || 'development';

  // Para testing: usar in-memory cache
  if (nodeEnv === 'test') {
    return {
      isTest: true,
      ttl: 300, // 5 minutes default
    };
  }

  // Para production/development: usar Redis Cloud
  return {
    isTest: false,
    url: redisUrl,
    ttl: 300, // 5 minutes default
    // TTLs específicos por tipo de cache
    ttls: {
      provider_rating: 3600 * 4, // 4 horas
      geocoding: 3600 * 24, // 24 horas
      user_profile: 1800, // 30 minutos
      payment_methods: 3600, // 1 hora
      available_technicians: 900, // 15 minutos
      otp: 600, // 10 minutos
    },
  };
});
