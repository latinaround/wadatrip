import { Body, Controller, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PricingService } from './pricing.service';

@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Post('predict')
  predict(@Body() body: any, @Res() res: Response) {
    const payload = this.pricingService.predictSync(body);
    return res.json(payload);
  }
}
