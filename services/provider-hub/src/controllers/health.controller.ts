import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  health() {
    return {
      ok: true,
      service: 'provider-hub',
      ts: new Date().toISOString(),
    };
  }
}
