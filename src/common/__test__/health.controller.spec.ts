import { HealthController } from '../health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(() => {
    controller = new HealthController();
  });

  describe('check', () => {
    it('should return health status with ok status', () => {
      const result = controller.check();

      expect(result).toHaveProperty('status');
      expect(result.status).toBe('ok');
    });

    it('should return health status with timestamp in ISO format', () => {
      const result = controller.check();

      expect(result).toHaveProperty('timestamp');
      expect(typeof result.timestamp).toBe('string');
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });

    it('should return uptime as a positive number', () => {
      const result = controller.check();

      expect(result).toHaveProperty('uptime');
      expect(typeof result.uptime).toBe('number');
      expect(result.uptime).toBeGreaterThan(0);
    });

    it('should return all required properties', () => {
      const result = controller.check();

      expect(Object.keys(result)).toContain('status');
      expect(Object.keys(result)).toContain('timestamp');
      expect(Object.keys(result)).toContain('uptime');
    });

    it('should return consistent response structure on multiple calls', () => {
      const result1 = controller.check();
      const result2 = controller.check();

      expect(result1).toHaveProperty('status', result2.status);
      expect(result1).toHaveProperty('uptime');
      expect(result2).toHaveProperty('uptime');
      // uptime should increase between calls
      expect(result2.uptime).toBeGreaterThanOrEqual(result1.uptime);
    });
  });
});
