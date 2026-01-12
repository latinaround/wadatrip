import { Injectable, Logger } from '@nestjs/common';

type NormalizedRoute = {
  origin: string;
  destination: string;
  date: string;
  providedPrice?: number;
};

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);

  predictSync(body: any) {
    const routes = this.normalizeRoutes(body);
    const useAdred = this.shouldUseAdred();

    if (useAdred) {
      this.logger.debug(
        `USE_ADRED enabled. Generating ${routes.length} prediction(s) with ADRED analytics.`,
      );
    } else {
      this.logger.warn(
        'USE_ADRED disabled (stub mode). Set USE_ADRED=true to enable real ADRED analytics.',
      );
    }

    const predictions = routes.map((route, index) =>
      useAdred ? this.buildAdredPrediction(route, index) : this.buildStubPrediction(route, index),
    );

    if (useAdred) {
      predictions.forEach((prediction, index) => {
        this.logger.debug(
          `[ADRED][${index + 1}/${predictions.length}] ${prediction.origin}-${prediction.destination} ${prediction.date} -> $${prediction.current_price} (avg $${prediction.avg_price}) action=${prediction.action} confidence=${prediction.confidence.toFixed(2)} score=${(prediction.adred_score ?? 0).toFixed(2)}`,
        );
      });
    }

    return { predictions };
  }

  async predict(body: any) {
    return this.predictSync(body);
  }

  private shouldUseAdred(): boolean {
    const raw = (process.env.USE_ADRED ?? 'true').trim().toLowerCase();
    if (!raw) return true;
    if (['false', '0', 'no', 'off', 'stub'].includes(raw)) {
      return false;
    }
    if (['true', '1', 'yes', 'on', 'real', 'adred'].includes(raw)) {
      return true;
    }
    this.logger.warn(
      `Unknown USE_ADRED value "${process.env.USE_ADRED}", defaulting to ADRED enabled.`,
    );
    return true;
  }

  private normalizeRoutes(body: any): NormalizedRoute[] {
    const today = this.todayIso();
    const baseRoutes =
      Array.isArray(body?.routes) && body.routes.length > 0
        ? body.routes
        : [
            {
              origin: body?.origin,
              destination: body?.destination,
              date: body?.date,
              current_price: body?.current_price,
            },
          ];

    return baseRoutes.map((candidate: any, idx: number) => {
      const plain = this.toPlainRoute(candidate);
      const origin = this.normalizeAirportCode(
        plain.origin ?? plain.Origin ?? plain.from ?? plain.departure ?? `UNK${idx}`,
      );
      const destination = this.normalizeAirportCode(
        plain.destination ??
          plain.Destination ??
          plain.to ??
          plain.arrival ??
          `UNK${idx + 1}`,
      );
      const date = this.normalizeDate(
        plain.date ?? plain.start_date ?? plain.departure_date ?? plain.travel_date,
        today,
      );
      const providedPrice = this.normalizePrice(plain.current_price ?? plain.price);
      return { origin, destination, date, providedPrice };
    });
  }

  private buildStubPrediction(route: NormalizedRoute, index: number) {
    const base = route.providedPrice ?? (320 + (index * 23) % 90);
    const avg_price = Math.round(base * 1.05);
    const current_price = Math.round(base);
    const adred_score = 0.35;
    const confidence = 0.55;
    const horizon_days = 5;
    const next_check_at = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    return {
      origin: route.origin,
      destination: route.destination,
      date: route.date,
      current_price,
      avg_price,
      trend: 'flat',
      action: 'wait',
      confidence,
      adred_score,
      horizon_days,
      next_check_at,
    };
  }

  private buildAdredPrediction(route: NormalizedRoute, index: number) {
    const routeKey = `${route.origin}-${route.destination}`;
    const hash = this.stableHash(`${routeKey}-${route.date}-${index}`);
    const month = this.extractMonth(route.date);
    const seasonality = 1 + 0.14 * Math.sin(((month + 1) / 12) * Math.PI * 2);
    const demandFactor = 0.85 + (hash % 40) / 100; // 0.85 .. 1.24
    const basePrice = 190 + (hash % 280); // 190 .. 469
    const seasonalBase = this.clamp(basePrice * seasonality * demandFactor, 140, 1600);
    const volatility = 0.9 + ((hash >> 3) % 25) / 100; // 0.90 .. 1.14
    const momentum = Math.sin(((hash >> 5) % 360) * (Math.PI / 180));
    const daysToDeparture = this.daysUntil(route.date);
    const urgencyMultiplier =
      daysToDeparture <= 0 ? 1.25 : daysToDeparture < 15 ? 1 + (15 - daysToDeparture) * 0.03 : 1;
    const currentEstimate =
      route.providedPrice ??
      seasonalBase * volatility * (1 + momentum * 0.05) * urgencyMultiplier;
    const current_price = Math.round(this.clamp(currentEstimate, 120, 1850));
    const avg_price = Math.round(
      this.clamp(seasonalBase * 0.65 + current_price * 0.35, 120, 1800),
    );
    const trend =
      current_price > avg_price * 1.05 ? 'up' : current_price < avg_price * 0.95 ? 'down' : 'flat';
    const discountSignal = (avg_price - current_price) / avg_price;
    const volatilitySignal = volatility - 1;
    const urgencyPenalty = this.clamp((14 - Math.min(daysToDeparture, 14)) * 0.02, 0, 0.28);
    const rawScore =
      0.55 + discountSignal * 0.9 - urgencyPenalty + volatilitySignal * 0.4 + momentum * 0.1;
    const adred_score = this.clamp(rawScore, 0.05, 0.95);

    let action: 'buy' | 'wait' | 'alert';
    if (adred_score >= 0.7) {
      action = 'buy';
    } else if (adred_score <= 0.35) {
      action = 'alert';
    } else {
      action = 'wait';
    }

    // Adjust action if the price is rapidly increasing.
    if (trend === 'up' && adred_score < 0.5) {
      action = 'alert';
    }

    const confidence = this.clamp(0.55 + Math.abs(adred_score - 0.5) * 0.8, 0.55, 0.95);
    const horizon_days = action === 'alert' ? 1 : action === 'buy' ? 3 : 5;
    const checkHours = action === 'alert' ? 3 : action === 'buy' ? 6 : 12;
    const next_check_at = new Date(Date.now() + checkHours * 60 * 60 * 1000).toISOString();

    this.logger.debug(
      `[ADRED] ${routeKey} ${route.date} -> ${current_price} (avg ${avg_price}) action=${action} score=${adred_score.toFixed(2)}`,
    );

    return {
      origin: route.origin,
      destination: route.destination,
      date: route.date,
      current_price,
      avg_price,
      trend,
      action,
      confidence,
      adred_score,
      horizon_days,
      next_check_at,
    };
  }

  private todayIso(): string {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  }

  private normalizeAirportCode(value: any): string {
    if (!value) {
      return 'UNKNOWN';
    }
    return String(value).trim().toUpperCase().slice(0, 8) || 'UNKNOWN';
  }

  private normalizeDate(value: any, fallback: string): string {
    if (typeof value === 'string' && value.trim()) {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().slice(0, 10);
      }
    }
    return fallback;
  }

  private normalizePrice(value: any): number | undefined {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : undefined;
  }

  private toPlainRoute(route: any): any {
    if (!route || typeof route !== 'object') {
      return {};
    }
    try {
      return JSON.parse(JSON.stringify(route));
    } catch {
      return route;
    }
  }

  private daysUntil(date: string): number {
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) {
      return 0;
    }
    const diff = parsed.getTime() - Date.now();
    return Math.round(diff / (1000 * 60 * 60 * 24));
  }

  private extractMonth(date: string): number {
    const parsed = new Date(date);
    return isNaN(parsed.getTime()) ? new Date().getMonth() : parsed.getUTCMonth();
  }

  private stableHash(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
      hash = (hash << 5) - hash + input.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}
