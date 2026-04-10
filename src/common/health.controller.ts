import { Controller, Get, Logger } from '@nestjs/common';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  @Get()
  check() {
    this.logger.log('GET /health - Health check requested');
    return { status: 'ok' };
  }
}
