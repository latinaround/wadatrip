import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { SYSTEM_PROMPT } from './prompt';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type WadaAgentRequest = {
  message: string;
  context?: {
    origin?: string;
    destination?: string;
    dates?: string;
    start_date?: string;
    budget?: string;
    interests?: string[];
  };
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
};

type PricingAdvice = {
  action?: 'buy' | 'wait' | 'alert' | 'unknown';
  confidence?: number;
  reason?: string;
};

const PORT = Number(process.env.WADAGENT_PORT || 3022);
const MISTRAL_API_KEY = String(process.env.MISTRAL_API_KEY || '').trim();
const MISTRAL_MODEL = String(process.env.MISTRAL_MODEL || 'mistral-small-latest');
const PRICING_SERVICE_URL = String(process.env.PRICING_SERVICE_URL || 'http://localhost:3012').replace(/\/$/, '');

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
            Hi, I'm WadaAgent. Ask about destinations, tours, or prices.
          </div>
          <div id="table"></div>
        </div>
        <div class="composer">
          <form id="chat-form">
            <textarea id="input" placeholder="Ask me about destinations, tours, or prices..."></textarea>
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

  const userContext = {
    origin: body?.context?.origin || '',
    destination: body?.context?.destination || '',
    dates: body?.context?.dates || body?.context?.start_date || '',
    budget: body?.context?.budget || '',
    interests: body?.context?.interests || [],
  };

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'system', content: `context: ${JSON.stringify(userContext)}` },
    { role: 'system', content: `pricing_advice: ${JSON.stringify(pricingAdvice)}` },
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
      return res.json({
        reply: String(content || ''),
        recommendations: [],
        table: { columns: [], rows: [] },
        meta: { confidence: 0.3, notes: 'fallback' },
      });
    }
    return res.json(parsed);
  } catch (err: any) {
    return res.status(500).json({ error: 'wadagent_failed', detail: err?.message || String(err) });
  }
});

async function fetchPricingAdvice(context?: WadaAgentRequest['context']): Promise<PricingAdvice> {
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

function safeJson(content: any) {
  if (!content || typeof content !== 'string') return null;
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

app.listen(PORT, () => {
  console.log(`[svc-wadagent] listening on :${PORT}`);
});
