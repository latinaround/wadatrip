import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';

@Module({
  imports: [],
  controllers: [HealthController, PricingController],
  providers: [PricingService],
})
export class AppModule {}
