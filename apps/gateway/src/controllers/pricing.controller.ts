import { Body, Controller, Post } from '@nestjs/common';
import axios from 'axios';
import { PricingPredictRequest, PricingPredictResponse } from '@wadatrip/common/dtos';

const PRICING_URL = process.env.PRICING_URL || 'http://localhost:3012';

@Controller('pricing')
export class PricingController {
  @Post('predict')
  async predict(@Body() body: PricingPredictRequest): Promise<PricingPredictResponse> {
    const { data } = await axios.post(`${PRICING_URL}/pricing/predict`, body);
    return data;
  }
}

