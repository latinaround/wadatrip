import { Controller, Get } from '@nestjs/common';

@Controller('providers')
export class HealthController {
  @Get('health')
  getHealth() {
    return {
      ok: true,
      service: 'provider-hub',
      ts: new Date().toISOString(),
    };
  }
}
