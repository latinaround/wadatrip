import AppConfig from '@/config/appConfig.js'

const API_BASE = (AppConfig.api?.baseUrl || '').replace(/\/$/, '')

export interface PricingRoutePayload {
  origin: string
  destination: string
  date: string
}

export interface PricingPredictionResponse {
  origin: string
  destination: string
  date: string
  current_price: number
  trend: 'up' | 'down' | 'flat'
  action: 'buy' | 'wait'
  confidence: number
  horizon_days: number
  next_check_at?: string
  currency?: string
}

export interface PricingGatewayResponse {
  predictions: PricingPredictionResponse[]
}

export async function requestPricingPrediction(payload: PricingRoutePayload): Promise<PricingGatewayResponse> {
  if (!payload.origin || !payload.destination || !payload.date) {
    throw new Error('Origin, destination and date are required to request pricing prediction.')
  }

  if (!API_BASE) {
    throw new Error('API base URL is not configured.')
  }

  const response = await fetch(`${API_BASE}/pricing/predict`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      routes: [payload],
    }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Gateway responded with ${response.status} ${response.statusText}: ${text}`)
  }

  return response.json()
}
