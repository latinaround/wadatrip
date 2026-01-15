import { Module } from '@nestjs/common';
import { PricingModule } from '../../pricing/src/pricing.module';
import { ItinerariesController } from './routes';

@Module({
  imports: [PricingModule],
  controllers: [ItinerariesController],
})
export class ItinerariesModule {}
