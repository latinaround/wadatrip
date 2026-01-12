import { Body, Controller, Post } from '@nestjs/common';
import { PricingService } from './pricing.service';

@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Post('predict')
  async predict(@Body() body: any) {
    return this.pricingService.predict(body);
  }
}
