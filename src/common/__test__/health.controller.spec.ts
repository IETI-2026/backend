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

    it('should only return status property', () => {
      const result = controller.check();

      expect(Object.keys(result)).toEqual(['status']);
    });

    it('should return consistent response structure on multiple calls', () => {
      const result1 = controller.check();
      const result2 = controller.check();

      expect(result1).toHaveProperty('status', result2.status);
      expect(result1.status).toBe('ok');
      expect(result2.status).toBe('ok');
    });
  });
});
