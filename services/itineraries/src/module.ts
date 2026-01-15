import { Module } from '@nestjs/common';
import { ItinerariesController } from './routes';
import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  health() {
    return { status: 'ok' };
  }
}

@Module({
  controllers: [ItinerariesController, HealthController],
})
export class AppModule {}

