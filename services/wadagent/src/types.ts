export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type WadaAgentContext = {
  origin?: string;
  destination?: string;
  dates?: string;
  start_date?: string;
  budget?: string;
  interests?: string[];
  user_email?: string;
  user_id?: string;
};

export type WadaAgentRequest = {
  message: string;
  context?: WadaAgentContext;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
};

export type PricingAdvice = {
  action?: 'buy' | 'wait' | 'alert' | 'unknown';
  confidence?: number;
  reason?: string;
};

export type TourOption = {
  id: string;
  title: string;
  city: string;
  country_code: string;
  category: string;
  price_from: number;
  currency: string;
  provider_name: string;
  provider_verified_level: string;
  provider_status: string;
};

export type BookingOption = {
  id: string;
  title: string;
  city: string;
  date: string;
  total_price: number;
  currency: string;
  booking_status: string;
  payment_status: string;
  provider_name: string;
  reference: string;
};

export type ItineraryOption = {
  source: 'itineraries_service' | 'stub_fallback';
  itinerary_id: string;
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
  scenario_type: string;
  estimated_total: number;
  action: 'buy' | 'wait' | 'alert' | 'unknown';
  highlights: string[];
  summary: string;
};

export type WadaAgentResponse = {
  reply: string;
  recommendations: Array<{
    type: 'tour' | 'flight' | 'booking' | 'itinerary' | 'other';
    title: string;
    price: number;
    currency: string;
    recommended_action: 'buy' | 'wait' | 'alert' | 'unknown';
    adred_action: 'buy' | 'wait' | 'alert' | 'unknown';
  }>;
  table: { columns: string[]; rows: string[][] };
  meta: { confidence: number; notes: string };
};
