import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { SYSTEM_PROMPT } from './prompt';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type WadaAgentContext = {
  origin?: string;
  destination?: string;
  dates?: string;
  start_date?: string;
  budget?: string;
  interests?: string[];
  user_email?: string;
  user_id?: string;
};

type WadaAgentRequest = {
  message: string;
  context?: WadaAgentContext;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
};

type PricingAdvice = {
  action?: 'buy' | 'wait' | 'alert' | 'unknown';
  confidence?: number;
  reason?: string;
};

type TourOption = {
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

type BookingOption = {
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

const PORT = Number(process.env.WADAGENT_PORT || 3022);
const MISTRAL_API_KEY = String(process.env.MISTRAL_API_KEY || '').trim();
const MISTRAL_MODEL = String(process.env.MISTRAL_MODEL || 'mistral-small-latest');
const PRICING_SERVICE_URL = String(process.env.PRICING_SERVICE_URL || 'http://localhost:3012').replace(/\/$/, '');
const MARKETPLACE_API_URL = String(process.env.MARKETPLACE_API_URL || process.env.PROVIDER_HUB_URL || 'http://localhost:3014').replace(/\/$/, '');
const BOOKINGS_API_URL = String(process.env.BOOKINGS_API_URL || process.env.GATEWAY_URL || 'http://localhost:3000').replace(/\/$/, '');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/wadagent/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/wadagent', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>WadaAgent</title>
    <style>
      :root {
        --brand-turquoise: #00c4b4;
        --brand-green: #42b883;
        --brand-orange: #ff7b00;
        --brand-dark: #0b0e14;
        --brand-light: #f8fbff;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: radial-gradient(circle at 20% 20%, #0f172a, #020617 80%);
        font-family: Inter, system-ui, sans-serif;
        color: white;
      }
      .frame {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 32px;
      }
      .card {
        width: 100%;
        max-width: 720px;
        background: linear-gradient(180deg, #006d6f, #013536);
        border-radius: 28px;
        box-shadow: 0 20px 50px rgba(0, 196, 180, 0.2);
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      .header {
        padding: 18px 24px;
        background: #006d6f;
        font-weight: 700;
        text-align: center;
        letter-spacing: 0.04em;
      }
      .messages {
        padding: 20px;
        min-height: 220px;
      }
      .bubble {
        background: #475569;
        padding: 12px 14px;
        border-radius: 14px;
        display: inline-block;
        max-width: 80%;
        font-size: 14px;
      }
      .composer {
        position: relative;
        padding: 20px;
        background: #1f2937;
        border-top: 1px solid rgba(148, 163, 184, 0.4);
      }
      textarea {
        width: 100%;
        min-height: 120px;
        border-radius: 20px;
        border: 1px solid #475569;
        background: #0f172a;
        color: white;
        padding: 16px 56px 16px 16px;
        font-size: 15px;
        resize: none;
      }
      button {
        position: absolute;
        right: 28px;
        bottom: 28px;
        width: 48px;
        height: 48px;
        border-radius: 999px;
        border: none;
        background: var(--brand-turquoise);
        color: white;
        cursor: pointer;
      }
      .table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 16px;
        font-size: 13px;
      }
      .table th, .table td {
        padding: 8px 10px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.3);
      }
      .table th {
        text-align: left;
        color: #d1fae5;
      }
    </style>
  </head>
  <body>
    <div class="frame">
      <div class="card">
        <div class="header">WadaAgent</div>
        <div class="messages" id="messages">
          <div class="bubble">
            Hi, I'm WadaAgent. Ask about tours, flight timing, or your bookings.
          </div>
          <div id="table"></div>
        </div>
        <div class="composer">
          <form id="chat-form">
            <textarea id="input" placeholder="Ask me about tours, flight timing, or your bookings..."></textarea>
            <button type="submit">➤</button>
          </form>
        </div>
      </div>
    </div>
    <script>
      const form = document.getElementById('chat-form');
      const input = document.getElementById('input');
      const messages = document.getElementById('messages');
      const table = document.getElementById('table');
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const message = input.value.trim();
        if (!message) return;
        input.value = '';
        const res = await fetch('/wadagent/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message })
        });
        const data = await res.json().catch(() => null);
        if (!data) return;
        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        bubble.textContent = data.reply || '...';
        messages.appendChild(bubble);
        if (data.table && data.table.columns && data.table.rows) {
          const t = document.createElement('table');
          t.className = 'table';
          const thead = document.createElement('thead');
          const tr = document.createElement('tr');
          data.table.columns.forEach(col => {
            const th = document.createElement('th');
            th.textContent = col;
            tr.appendChild(th);
          });
          thead.appendChild(tr);
          t.appendChild(thead);
          const tbody = document.createElement('tbody');
          data.table.rows.forEach(row => {
            const tr = document.createElement('tr');
            row.forEach(cell => {
              const td = document.createElement('td');
              td.textContent = cell;
              tr.appendChild(td);
            });
            tbody.appendChild(tr);
          });
          t.appendChild(tbody);
          table.innerHTML = '';
          table.appendChild(t);
        }
      });
    </script>
  </body>
</html>`);
});

app.post('/wadagent/chat', async (req, res) => {
  const body = req.body as WadaAgentRequest;
  const message = String(body?.message || '').trim();
  if (!message) {
    return res.status(400).json({ error: 'message_required' });
  }
  if (!MISTRAL_API_KEY) {
    return res.status(500).json({ error: 'missing_mistral_key' });
  }

  const pricingAdvice = await fetchPricingAdvice(body?.context);
  const [tourOptions, bookingOptions] = await Promise.all([
    fetchTourOptions(body?.context, message),
    fetchBookingOptions(body?.context),
  ]);

  const userContext = {
    origin: body?.context?.origin || '',
    destination: body?.context?.destination || '',
    dates: body?.context?.dates || body?.context?.start_date || '',
    budget: body?.context?.budget || '',
    interests: body?.context?.interests || [],
    has_user_context: !!(body?.context?.user_email || body?.context?.user_id),
  };

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'system', content: `context: ${JSON.stringify(userContext)}` },
    { role: 'system', content: `pricing_advice: ${JSON.stringify(pricingAdvice)}` },
    { role: 'system', content: `tour_options: ${JSON.stringify(tourOptions)}` },
    { role: 'system', content: `booking_options: ${JSON.stringify(bookingOptions)}` },
  ];

  if (Array.isArray(body?.history)) {
    for (const item of body.history) {
      if (!item?.content) continue;
      messages.push({ role: item.role, content: String(item.content) });
    }
  }

  messages.push({ role: 'user', content: message });

  try {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MISTRAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MISTRAL_MODEL,
        messages,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(502).json({ error: 'mistral_error', detail: errorText });
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    const parsed = safeJson(content);
    if (!parsed) {
      return res.json(buildFallbackResponse(pricingAdvice, tourOptions, bookingOptions));
    }
    return res.json(normalizeAgentPayload(parsed, pricingAdvice, tourOptions, bookingOptions));
  } catch (err: any) {
    return res.status(500).json({ error: 'wadagent_failed', detail: err?.message || String(err) });
  }
});

async function fetchPricingAdvice(context?: WadaAgentContext): Promise<PricingAdvice> {
  const origin = context?.origin;
  const destination = context?.destination;
  const date = context?.dates || context?.start_date;
  if (!origin || !destination || !date) return { action: 'unknown' };

  try {
    const resp = await fetch(`${PRICING_SERVICE_URL}/pricing/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destination, date }),
    });
    if (!resp.ok) return { action: 'unknown' };
    const data = await resp.json();
    return {
      action: data?.action,
      confidence: data?.confidence,
      reason: data?.reason || data?.recommendation,
    };
  } catch {
    return { action: 'unknown' };
  }
}

async function fetchTourOptions(context?: WadaAgentContext, message?: string): Promise<TourOption[]> {
  const destination = normalizeSearchValue(context?.destination);
  const query = buildSearchQuery(destination, message);
  const category = normalizeSearchValue(Array.isArray(context?.interests) ? context?.interests[0] : '');
  const budget = parseBudget(context?.budget);

  const direct = await requestTours({ city: destination, q: destination ? '' : query, category, budget });
  if (direct.length > 0) return direct;

  if (destination) {
    const fallback = await requestTours({ city: '', q: destination, category, budget });
    if (fallback.length > 0) return fallback;
  }

  if (query) {
    return requestTours({ city: '', q: query, category, budget });
  }

  return [];
}

async function requestTours(opts: { city?: string; q?: string; category?: string; budget?: number | null }): Promise<TourOption[]> {
  try {
    const params = new URLSearchParams();
    params.set('limit', '5');
    params.set('status', 'published');
    if (opts.city) params.set('city', opts.city);
    if (opts.q) params.set('q', opts.q);
    if (opts.category) params.set('category', opts.category);
    if (opts.budget != null && Number.isFinite(opts.budget)) params.set('max_price', String(opts.budget));

    const resp = await fetch(`${MARKETPLACE_API_URL}/listings/search?${params.toString()}`);
    if (!resp.ok) return [];
    const data = await resp.json();
    const items = Array.isArray(data?.items) ? data.items : [];

    return items
      .filter((item) => {
        const providerStatus = String(item?.provider_status || '').toLowerCase();
        return !providerStatus || providerStatus === 'approved' || providerStatus === 'verified';
      })
      .map((item) => ({
        id: String(item?.id || ''),
        title: String(item?.title || 'Tour'),
        city: String(item?.city || ''),
        country_code: String(item?.country_code || ''),
        category: String(item?.category || 'tour'),
        price_from: parseMoney(item?.price_from),
        currency: String(item?.currency || 'USD'),
        provider_name: String(item?.provider_name || 'Local tour guide'),
        provider_verified_level: String(item?.provider_verified_level || ''),
        provider_status: String(item?.provider_status || ''),
      }))
      .sort((a, b) => a.price_from - b.price_from)
      .slice(0, 5);
  } catch {
    return [];
  }
}

async function fetchBookingOptions(context?: WadaAgentContext): Promise<BookingOption[]> {
  const userEmail = normalizeSearchValue(context?.user_email);
  const userId = normalizeSearchValue(context?.user_id);
  if (!userEmail && !userId) return [];

  try {
    const params = new URLSearchParams();
    params.set('limit', '5');
    if (userEmail) params.set('user_email', userEmail);
    if (userId) params.set('user_id', userId);

    const resp = await fetch(`${BOOKINGS_API_URL}/bookings?${params.toString()}`);
    if (!resp.ok) return [];
    const data = await resp.json();
    const items = Array.isArray(data?.items) ? data.items : [];

    return items.map((item) => ({
      id: String(item?.id || ''),
      title: String(item?.listing?.title || item?.title || 'Booking'),
      city: String(item?.listing?.city || item?.city || ''),
      date: String(item?.date || ''),
      total_price: parseMoney(item?.total_price ?? (Number.isFinite(Number(item?.amount_cents)) ? Number(item?.amount_cents || 0) / 100 : 0)),
      currency: String(item?.listing?.currency || item?.currency || 'USD'),
      booking_status: String(item?.status || 'unknown'),
      payment_status: String(item?.payment_status || 'unknown'),
      provider_name: String(item?.provider?.name || item?.provider_name || 'Local tour guide'),
      reference: String(item?.reference || item?.id || ''),
    }));
  } catch {
    return [];
  }
}

function normalizeAgentPayload(parsed: any, pricingAdvice: PricingAdvice, tourOptions: TourOption[], bookingOptions: BookingOption[]) {
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
      type: 'booking',
      title: booking.title,
      price: booking.total_price,
      currency: booking.currency,
      recommended_action: booking.payment_status === 'paid' ? 'buy' : 'alert',
      adred_action: booking.payment_status === 'paid' ? 'buy' : 'alert',
    })));
  }

  if (recommendations.length === 0 && tourOptions.length > 0) {
    recommendations.push(...tourOptions.slice(0, 3).map((tour) => ({
      type: 'tour',
      title: tour.title,
      price: tour.price_from,
      currency: tour.currency,
      recommended_action: 'buy',
      adred_action: 'buy',
    })));
  }

  const table = normalizeTable(parsed?.table, tourOptions, bookingOptions);
  const meta = {
    confidence: Number.isFinite(Number(parsed?.meta?.confidence)) ? Number(parsed.meta.confidence) : Number(pricingAdvice.confidence || 0.55),
    notes: String(parsed?.meta?.notes || pricingAdvice.reason || (bookingOptions.length > 0 ? 'booking_context_attached' : tourOptions.length > 0 ? 'tour_search_attached' : 'assistant_response')),
  };

  return {
    reply: String(parsed?.reply || buildFallbackReply(pricingAdvice, tourOptions, bookingOptions)),
    recommendations,
    table,
    meta,
  };
}

function buildFallbackResponse(pricingAdvice: PricingAdvice, tourOptions: TourOption[], bookingOptions: BookingOption[]) {
  return {
    reply: buildFallbackReply(pricingAdvice, tourOptions, bookingOptions),
    recommendations: bookingOptions.length > 0
      ? bookingOptions.slice(0, 2).map((booking) => ({
          type: 'booking',
          title: booking.title,
          price: booking.total_price,
          currency: booking.currency,
          recommended_action: booking.payment_status === 'paid' ? 'buy' : 'alert',
          adred_action: booking.payment_status === 'paid' ? 'buy' : 'alert',
        }))
      : tourOptions.slice(0, 3).map((tour) => ({
          type: 'tour',
          title: tour.title,
          price: tour.price_from,
          currency: tour.currency,
          recommended_action: 'buy',
          adred_action: 'buy',
        })),
    table: normalizeTable(null, tourOptions, bookingOptions),
    meta: {
      confidence: Number(pricingAdvice.confidence || (bookingOptions.length > 0 || tourOptions.length > 0 ? 0.62 : 0.3)),
      notes: String(pricingAdvice.reason || (bookingOptions.length > 0 ? 'booking_context_fallback' : tourOptions.length > 0 ? 'tour_search_fallback' : 'fallback')),
    },
  };
}

function buildFallbackReply(pricingAdvice: PricingAdvice, tourOptions: TourOption[], bookingOptions: BookingOption[]) {
  const parts: string[] = [];
  if (bookingOptions.length > 0) {
    const latest = bookingOptions[0];
    parts.push(`Your latest booking is ${latest.title} in ${latest.city || 'your destination'}. It is currently ${latest.booking_status} and payment is ${latest.payment_status}.`);
  }
  if (tourOptions.length > 0) {
    const first = tourOptions[0];
    const priceText = first.price_from > 0 ? `${currencySymbol(first.currency)}${first.price_from}` : 'a flexible price';
    parts.push(`I also found ${tourOptions.length} tours in ${first.city || 'your destination'}. The best current option starts around ${priceText}.`);
  }
  if (pricingAdvice.action && pricingAdvice.action !== 'unknown') {
    const actionText = pricingAdvice.action === 'buy' ? 'buy now' : pricingAdvice.action === 'wait' ? 'wait a bit' : 'set an alert';
    parts.push(`For flights, my timing advice is to ${actionText}${pricingAdvice.reason ? ` because ${pricingAdvice.reason}` : ''}.`);
  }
  if (parts.length === 0) {
    parts.push('I can help with tour options, flight timing, and booking questions. Share a destination or ask about your bookings and I will narrow it down.');
  }
  return parts.join(' ').slice(0, 320);
}

function normalizeTable(table: any, tourOptions: TourOption[], bookingOptions: BookingOption[]) {
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
  if (tourOptions.length === 0) {
    return { columns: [], rows: [] };
  }
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

function normalizeRecommendationType(value: any) {
  const type = String(value || 'other').toLowerCase();
  if (['tour', 'flight', 'booking', 'itinerary', 'other'].includes(type)) return type;
  if (type === 'activity') return 'tour';
  return 'other';
}

function normalizeAction(value: any): 'buy' | 'wait' | 'alert' | 'unknown' {
  const action = String(value || 'unknown').toLowerCase();
  if (action === 'buy' || action === 'wait' || action === 'alert') return action;
  return 'unknown';
}

function normalizeSearchValue(value?: string) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function buildSearchQuery(destination?: string, message?: string) {
  if (destination) return destination;
  const raw = String(message || '').replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim();
  return raw.slice(0, 80);
}

function parseBudget(value?: string) {
  const match = String(value || '').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function parseMoney(value: any) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const match = String(value || '').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
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

function safeJson(content: any) {
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

app.listen(PORT, () => {
  console.log(`[svc-wadagent] listening on :${PORT}`);
});
