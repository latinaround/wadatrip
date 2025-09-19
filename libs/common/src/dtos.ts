// Shared DTOs and types for Gateway <-> Services

export type ScenarioType = 'economy' | 'balanced' | 'premium';

export interface GenerateItineraryRequest {
  title: string;
  origin: string;
  destination: string;
  start_date: string; // ISO date
  end_date: string;   // ISO date
  adults: number;
  budget_total: number;
  preferences?: {
    pace?: 'relaxed' | 'normal' | 'packed';
    interests?: string[];
    lodging_class?: 2 | 3 | 4 | 5;
  };
}

export interface KPISet {
  cost_per_day: number;
  free_time_hours: number;
  walk_distance_km: number;
}

export interface GeoPoint { lat: number; lng: number; }

export type ItemType = 'flight' | 'lodging' | 'activity';

export interface ItineraryItem {
  id: string;
  type: ItemType;
  supplier: string;
  title: string;
  start: string; // ISO datetime
  end: string;   // ISO datetime
  geo?: GeoPoint;
  price: number;
  currency: string;
  details?: Record<string, any>;
}

export interface ADREDAdvice {
  action: 'buy' | 'wait';
  confidence: number; // 0..1
  next_check_at?: string; // ISO datetime
  rationale?: string;
}

export interface Scenario {
  type: ScenarioType;
  total_price: number;
  price_breakdown: { flight: number; lodging: number; activities: number };
  adred: ADREDAdvice;
  items: ItineraryItem[];
  kpis: KPISet;
}

export interface GenerateItineraryResponse {
  itinerary_id: string;
  scenarios: Scenario[];
}

export interface UpdateItineraryRequest {
  itinerary_id: string;
  changes: {
    budget_total?: number;
    dates?: { start_date?: string; end_date?: string };
    preferences?: GenerateItineraryRequest['preferences'];
    pax?: number;
  };
}

export interface DiffPayload {
  added: ItineraryItem[];
  removed: ItineraryItem[];
  updated: { before: ItineraryItem; after: ItineraryItem }[];
}

export interface UpdateItineraryResponse {
  version_id: string;
  scenarios: Scenario[];
  diff: DiffPayload;
}

export interface PricingPredictRequest {
  routes: { origin: string; destination: string; date: string }[];
}

export interface PricingPrediction {
  origin: string;
  destination: string;
  date: string;
  current_price: number;
  trend: 'up' | 'down' | 'flat';
  action: 'buy' | 'wait';
  confidence: number;
  horizon_days: number;
  next_check_at: string;
}

export interface PricingPredictResponse { predictions: PricingPrediction[] }

export interface AlertRule {
  type: 'price_drop' | 'weather' | 'sold_out' | 'adred_recommendation';
  route?: string; // e.g., SCL-JFK
  threshold?: number;
  date?: string;
  condition?: string;
  item_id?: string;
}

export interface AlertsSubscribeRequest {
  itinerary_id: string;
  rules: AlertRule[];
  user_id?: string;
  channel?: 'in_app' | 'webpush' | 'fcm' | 'email';
}

export interface AlertsSubscribeResponse {
  subscription_id: string;
  rules_active: AlertRule[];
}

export interface AlertRecord {
  id: string;
  subscription_id?: string;
  payload: any;
  status: string;
  created_at: string;
}

export interface AlertsListQuery {
  itinerary_id?: string;
  user_id?: string;
  status?: string;
  from?: string; // ISO date
  to?: string;   // ISO date
  limit?: number;
}
