import type {
  BookingOption,
  ItineraryOption,
  PricingAdvice,
  TourOption,
  WadaAgentResponse,
} from './types';

export function safeJson(content: any) {
  if (!content || typeof content !== 'string') return null;
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function normalizeAgentPayload(
  parsed: any,
  pricingAdvice: PricingAdvice,
  tourOptions: TourOption[],
  bookingOptions: BookingOption[],
  itineraryOptions: ItineraryOption[],
): WadaAgentResponse {
  const recommendations = Array.isArray(parsed?.recommendations)
    ? parsed.recommendations.map((item: any) => {
        const action = normalizeAction(item?.recommended_action || item?.adred_action || pricingAdvice.action);
        return {
          type: normalizeRecommendationType(item?.type),
          title: String(item?.title || 'Recommendation'),
          price: Number.isFinite(Number(item?.price)) ? Number(item.price) : 0,
          currency: String(item?.currency || 'USD'),
          recommended_action: action,
          adred_action: action,
        };
      })
    : [];

  if (recommendations.length === 0 && bookingOptions.length > 0) {
    recommendations.push(...bookingOptions.slice(0, 2).map((booking) => ({
      type: 'booking' as const,
      title: booking.title,
      price: booking.total_price,
      currency: booking.currency,
      recommended_action: booking.payment_status === 'paid' ? 'buy' : 'alert',
      adred_action: booking.payment_status === 'paid' ? 'buy' : 'alert',
    })));
  }

  if (recommendations.length === 0 && tourOptions.length > 0) {
    recommendations.push(...tourOptions.slice(0, 3).map((tour) => ({
      type: 'tour' as const,
      title: tour.title,
      price: tour.price_from,
      currency: tour.currency,
      recommended_action: 'buy' as const,
      adred_action: 'buy' as const,
    })));
  }

  if (recommendations.length === 0 && itineraryOptions.length > 0) {
    recommendations.push(...itineraryOptions.slice(0, 2).map((itinerary) => ({
      type: 'itinerary' as const,
      title: itinerary.title,
      price: itinerary.estimated_total,
      currency: 'USD',
      recommended_action: itinerary.action,
      adred_action: itinerary.action,
    })));
  }

  return {
    reply: String(parsed?.reply || buildFallbackReply(pricingAdvice, tourOptions, bookingOptions, itineraryOptions)),
    recommendations,
    table: normalizeTable(parsed?.table, tourOptions, bookingOptions, itineraryOptions),
    meta: {
      confidence: Number.isFinite(Number(parsed?.meta?.confidence)) ? Number(parsed.meta.confidence) : Number(pricingAdvice.confidence || 0.55),
      notes: String(parsed?.meta?.notes || inferNotes(pricingAdvice, tourOptions, bookingOptions, itineraryOptions)),
    },
  };
}

export function buildFallbackResponse(
  pricingAdvice: PricingAdvice,
  tourOptions: TourOption[],
  bookingOptions: BookingOption[],
  itineraryOptions: ItineraryOption[],
): WadaAgentResponse {
  return normalizeAgentPayload({}, pricingAdvice, tourOptions, bookingOptions, itineraryOptions);
}

function inferNotes(
  pricingAdvice: PricingAdvice,
  tourOptions: TourOption[],
  bookingOptions: BookingOption[],
  itineraryOptions: ItineraryOption[],
) {
  if (bookingOptions.length > 0) return 'booking_context_attached';
  if (tourOptions.length > 0) return 'tour_search_attached';
  if (itineraryOptions.some((item) => item.source === 'stub_fallback')) return 'itinerary_stub_fallback';
  if (itineraryOptions.length > 0) return 'itinerary_service_attached';
  return pricingAdvice.reason || 'assistant_response';
}

function buildFallbackReply(
  pricingAdvice: PricingAdvice,
  tourOptions: TourOption[],
  bookingOptions: BookingOption[],
  itineraryOptions: ItineraryOption[],
) {
  const parts: string[] = [];
  if (bookingOptions.length > 0) {
    const latest = bookingOptions[0];
    parts.push(`Your latest booking is ${latest.title} in ${latest.city || 'your destination'}. It is currently ${latest.booking_status} and payment is ${latest.payment_status}.`);
  }
  if (tourOptions.length > 0) {
    const first = tourOptions[0];
    const priceText = first.price_from > 0 ? `${currencySymbol(first.currency)}${first.price_from}` : 'a flexible price';
    parts.push(`I found ${tourOptions.length} tour options in ${first.city || 'your destination'}. The best current option starts around ${priceText}.`);
  }
  if (itineraryOptions.length > 0) {
    const itinerary = itineraryOptions[0];
    parts.push(`I also prepared ${itinerary.title}. ${itinerary.summary}`);
  }
  if (pricingAdvice.action && pricingAdvice.action !== 'unknown') {
    const actionText = pricingAdvice.action === 'buy' ? 'buy now' : pricingAdvice.action === 'wait' ? 'wait a bit' : 'set an alert';
    parts.push(`For flights, my timing advice is to ${actionText}${pricingAdvice.reason ? ` because ${pricingAdvice.reason}` : ''}.`);
  }
  if (parts.length === 0) {
    parts.push('I can help with tours, experiences, itinerary ideas, flight timing, and booking questions.');
  }
  return parts.join(' ').slice(0, 360);
}

function normalizeTable(table: any, tourOptions: TourOption[], bookingOptions: BookingOption[], itineraryOptions: ItineraryOption[]) {
  const hasColumns = Array.isArray(table?.columns) && table.columns.length > 0;
  const hasRows = Array.isArray(table?.rows) && table.rows.length > 0;
  if (hasColumns && hasRows) {
    return {
      columns: table.columns.map((col: any) => String(col)),
      rows: table.rows.map((row: any) => Array.isArray(row) ? row.map((cell: any) => String(cell)) : []),
    };
  }
  if (bookingOptions.length > 0) {
    return {
      columns: ['Booking', 'Date', 'Status', 'Payment'],
      rows: bookingOptions.slice(0, 5).map((booking) => ([
        booking.title,
        booking.date ? booking.date.slice(0, 10) : '-',
        booking.booking_status,
        booking.payment_status,
      ])),
    };
  }
  if (tourOptions.length > 0) {
    return {
      columns: ['Tour', 'City', 'From', 'Host'],
      rows: tourOptions.slice(0, 5).map((tour) => ([
        tour.title,
        tour.city || '-',
        `${currencySymbol(tour.currency)}${tour.price_from || 0}`,
        tour.provider_name,
      ])),
    };
  }
  if (itineraryOptions.length > 0) {
    return {
      columns: ['Itinerary', 'Dates', 'Budget', 'Source'],
      rows: itineraryOptions.slice(0, 3).map((item) => ([
        item.title,
        `${item.start_date} -> ${item.end_date}`,
        `$${item.estimated_total}`,
        item.source,
      ])),
    };
  }
  return { columns: [], rows: [] };
}

function normalizeRecommendationType(value: any): 'tour' | 'flight' | 'booking' | 'itinerary' | 'other' {
  const type = String(value || 'other').toLowerCase();
  if (['tour', 'flight', 'booking', 'itinerary', 'other'].includes(type)) return type as any;
  if (type === 'activity') return 'tour';
  return 'other';
}

function normalizeAction(value: any): 'buy' | 'wait' | 'alert' | 'unknown' {
  const action = String(value || 'unknown').toLowerCase();
  if (action === 'buy' || action === 'wait' || action === 'alert') return action;
  return 'unknown';
}

function currencySymbol(currency?: string) {
  switch (String(currency || '').toUpperCase()) {
    case 'EUR': return 'EUR ';
    case 'GBP': return 'GBP ';
    case 'MXN': return 'MXN ';
    case 'PEN': return 'PEN ';
    case 'ARS': return 'ARS ';
    case 'CLP': return 'CLP ';
    default: return '$';
  }
}
