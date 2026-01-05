import { Body, Controller, Post } from '@nestjs/common';
import { PricingPredictRequest, PricingPredictResponse } from '@wadatrip/common/dtos';
import { PricingService } from '../services/pricing.service';

@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Post('predict')
  async predict(@Body() body: PricingPredictRequest): Promise<PricingPredictResponse> {
    return this.pricingService.predict(body);
  }
}
