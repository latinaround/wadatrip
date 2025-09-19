// libs/pricing/src/adred.mock.ts
export type PredictInput = {
  origin?: string;
  destination?: string;
  route?: string;            // alternativa a origin/destination
  start_date?: string;
  adults?: number;
  current_price?: number;    // opcional: si ya tienes un precio real
};

export type PredictOutput = {
  route: string;
  current_price: number;
  predicted_low: number;
  trend: 'up' | 'down' | 'flat';
  action: 'buy' | 'wait';
  confidence: number;
  next_check_at: string;     // ISO
};

export function predictPricing(input: PredictInput): PredictOutput {
  const route =
    input?.route ??
    (input?.origin && input?.destination
      ? `${input.origin}-${input.destination}`
      : 'UNKNOWN-ROUTE');

  // Precio actual sintético si no viene uno real
  const current = Math.max(
    120,
    Math.round(
      input?.current_price ??
        (300 + Math.random() * 400) // 300–700
    ),
  );

  // Mínimo esperado (simple): 85–95% del actual
  const predictedLow = Math.max(120, Math.round(current * (0.85 + Math.random() * 0.10)));

  const trend: 'up' | 'down' | 'flat' =
    Math.abs(predictedLow - current) < 5 ? 'flat' : predictedLow < current ? 'down' : 'up';

  const buy = current <= predictedLow + 20; // regla simple
  const action: 'buy' | 'wait' = buy ? 'buy' : 'wait';
  const confidence = buy ? 0.65 : 0.55;

  const hours = buy ? 0 : 6; // si “wait”, revisa en ~6h
  const next_check_at = new Date(Date.now() + hours * 3600 * 1000).toISOString();

  return {
    route,
    current_price: current,
    predicted_low: predictedLow,
    trend,
    action,
    confidence,
    next_check_at,
  };
}
