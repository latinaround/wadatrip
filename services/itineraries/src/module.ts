import { Module } from '@nestjs/common';
import { ItinerariesController } from './routes';
import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  health() {
    return { ok: true, service: 'itineraries', ts: new Date().toISOString() };
  }
}

@Module({
  controllers: [ItinerariesController, HealthController],
})
export class AppModule {}

