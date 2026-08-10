import { Body, Controller, Post } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type { AxiosResponse } from 'axios';
import type {
  PricingPredictRequest,
  PricingPredictResponse,
} from '@wadatrip/common/dtos/shared.dtos';

@Controller('pricing')
export class PricingController {
  constructor(private readonly http: HttpService) {}

  @Post('predict')
  async predict(
    @Body() body: PricingPredictRequest,
  ): Promise<PricingPredictResponse> {
    const baseUrl = process.env.PRICING_SERVICE_URL || 'http://localhost:3012';
    const response: AxiosResponse<PricingPredictResponse> =
      await firstValueFrom(
        this.http.post<PricingPredictResponse>(
          `${baseUrl}/pricing/predict`,
          body,
        ),
      );

    return response.data;
  }
}
