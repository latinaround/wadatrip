import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module, Controller, Post, Body, Get, Query } from '@nestjs/common';
import axios from 'axios';
import {
  AlertsSubscribeRequest,
  AlertsSubscribeResponse,
  AlertRecord,
  AlertsListQuery,
} from '@wadatrip/common/dtos';
import { getPrisma } from '@wadatrip/db/src/client';
import { getRedis } from '@wadatrip/common/redis';
// Switch from mock to real Pricing service via HTTP
const PRICING_URL = process.env.PRICING_URL || 'http://localhost:3012';
import { Prisma } from '@prisma/client';

const ZSET_DUE = 'alerts:due';

async function scheduleRule(subId: string, whenIso: string) {
  const redis = getRedis();
  const when = Math.floor(new Date(whenIso).getTime() / 1000);
  await redis.zadd(ZSET_DUE, when, `sub:${subId}`);
}

function nextIn(seconds: number) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

async function evalRuleAndMaybeTrigger(sub: any) {
  const rule = sub.rule as any;
  const prisma = getPrisma();

  // Helper para mapear Pricing (tolerante a distintos DTOs) y condiciones
  const daysBetween = (fromISO?: string) => {
    if (!fromISO) return 14;
    const from = new Date(fromISO);
    if (isNaN(+from)) return 14;
    const diffMs = from.getTime() - Date.now();
    return Math.max(0, Math.round(diffMs / (24 * 3600 * 1000)));
  };

  const callPricing = async (origin: string, destination: string, start_date?: string) => {
    try {
      const { data } = await axios.post(`${PRICING_URL}/pricing/predict`, {
        origin,
        destination,
        start_date,
      });
      const p = Array.isArray(data?.predictions) && data.predictions[0] ? data.predictions[0] : null;
      if (!p) return null;
      // Tolerar respuesta basada en route u origin/destination
      let route = p.route as string | undefined;
      if (!route && p.origin && p.destination) route = `${p.origin}-${p.destination}`;
      return {
        route: route || `${origin}-${destination}`,
        origin: p.origin || origin,
        destination: p.destination || destination,
        date: p.start_date || p.date || start_date || '',
        current_price: Number(p.current_price || 0),
        predicted_low: Number(p.predicted_low || 0),
        trend: p.trend,
        action: p.action,
        confidence: Number(p.confidence || 0),
        next_check_at: p.next_check_at,
        horizon_days: daysBetween(p.start_date || p.date || start_date),
      };
    } catch (e) {
      console.error('[alerts] pricing call failed', e?.message || e);
      return null;
    }
  };

  // price_drop
  if (rule.type === 'price_drop' && rule.route) {
    const [origin, destination] = (rule.route as string).split('-');
    const dto = await callPricing(origin, destination, rule.date);
    if (!dto) return { alertRow: null, nextCheckAt: nextIn(60 * 60) };

    if (dto.current_price < (rule.threshold || 50) * 10 || Math.random() < 0.25) {
      const created = await prisma.alerts.create({
        data: {
          subscription_id: sub.id,
          payload: {
            type: 'price_drop',
            route: rule.route,
            delta: Math.floor(Math.random() * 50) + 10,
            pricing: dto,
            message: `Price dropped on ${rule.route}. ADRED says ${dto.action}.`,
          },
        } as unknown as Prisma.alertsCreateInput,
        select: { id: true, subscription_id: true, payload: true, status: true },
      });
      return { alertRow: created, nextCheckAt: dto.next_check_at };
    }
    return { alertRow: null, nextCheckAt: dto.next_check_at };
  }

  // adred_recommendation
  if (rule.type === 'adred_recommendation' && rule.route) {
    const [origin, destination] = (rule.route as string).split('-');
    const dto = await callPricing(origin, destination, rule.date);
    if (!dto) return { alertRow: null, nextCheckAt: nextIn(60 * 60) };

    if (dto.action === 'buy' && dto.confidence >= 0.6) {
      const created = await prisma.alerts.create({
        data: {
          subscription_id: sub.id,
          payload: {
            type: 'adred_recommendation',
            route: rule.route,
            recommendation: dto.action,
            confidence: dto.confidence,
            pricing: dto,
            message: `ADRED recommends ${dto.action} for ${rule.route}`,
          },
        } as unknown as Prisma.alertsCreateInput,
        select: { id: true, subscription_id: true, payload: true, status: true },
      });
      return { alertRow: created, nextCheckAt: dto.next_check_at };
    }
    return { alertRow: null, nextCheckAt: dto.next_check_at };
  }

  // weather
  if (rule.type === 'weather') {
    if (rule.condition === 'rain' && Math.random() < 0.2) {
      const created = await prisma.alerts.create({
        data: {
          subscription_id: sub.id,
          payload: {
            type: 'weather',
            date: rule.date,
            condition: 'rain',
            message: 'Rain expected. We adjusted your tour.',
          },
        } as unknown as Prisma.alertsCreateInput,
        select: { id: true, subscription_id: true, payload: true, status: true },
      });
      return { alertRow: created, nextCheckAt: nextIn(6 * 60 * 60) };
    }
    return { alertRow: null, nextCheckAt: nextIn(6 * 60 * 60) };
  }

  // sold_out
  if (rule.type === 'sold_out' || rule.type === 'activity_soldout') {
    if (Math.random() < 0.15) {
      const created = await prisma.alerts.create({
        data: {
          subscription_id: sub.id,
          payload: {
            type: 'activity_soldout',
            item_id: rule.item_id,
            message: 'An activity is sold out. Suggested alternative added.',
          },
        } as unknown as Prisma.alertsCreateInput,
        select: { id: true, subscription_id: true, payload: true, status: true },
      });
      return { alertRow: created, nextCheckAt: nextIn(3 * 60 * 60) };
    }
    return { alertRow: null, nextCheckAt: nextIn(3 * 60 * 60) };
  }

  return { alertRow: null };
}

async function fanout(alertRow: any) {
  console.log('[alerts] fanout:', alertRow.id);
  const gateway = process.env.GATEWAY_URL || 'http://localhost:3000';
  try {
    await axios.post(`${gateway}/alerts/notify`, alertRow.payload);
    const prisma = getPrisma();
    await prisma.alerts.update({
      where: { id: alertRow.id },
      data: { status: 'delivered' },
    });
    if (alertRow.subscription_id) {
      await prisma.alert_subscriptions.update({
        where: { id: alertRow.subscription_id },
        data: { last_notified_at: new Date() },
      });
    }
  } catch (e) {
    console.error('Failed to notify gateway', e);
  }
}

async function schedulerLoopOnce() {
  const redis = getRedis();
  const now = Math.floor(Date.now() / 1000);
  const due = await redis.zrangebyscore(ZSET_DUE, 0, now, 'LIMIT', 0, 50);
  if (!due.length) return;
  await redis.zrem(ZSET_DUE, ...due);
  const prisma = getPrisma();
  for (const member of due) {
    try {
      const subId = member.replace('sub:', '');
      const sub = await prisma.alert_subscriptions.findUnique({ where: { id: subId } });
      if (!sub || sub.active === false) continue;
      const { alertRow, nextCheckAt } = await evalRuleAndMaybeTrigger(sub);
      if (alertRow) await fanout(alertRow);
      await scheduleRule(sub.id, nextCheckAt || nextIn(60 * 60));
    } catch (err) {
      console.error('[scheduler] error processing', member, err);
    }
  }
}

function startScheduler() {
  setInterval(
    () => schedulerLoopOnce().catch(err => console.error('scheduler error', err)),
    60 * 1000,
  );
}

@Controller('alerts')
class AlertsController {
  @Post('subscribe')
  async subscribe(@Body() body: AlertsSubscribeRequest): Promise<AlertsSubscribeResponse> {
    const prisma = getPrisma();
    // Normalize rules and ensure user_id
    const rulesArr = Array.isArray((body as any)?.rules) ? (body as any).rules : ((body as any)?.rules ? [(body as any).rules] : []);
    if (!rulesArr.length) {
      throw new Error('No rules provided');
    }
    (body as any).rules = rulesArr as any;
    if (!(body as any).user_id) {
      const demoEmail = 'demo@wadatrip.local';
      const demo = await prisma.users.upsert({ where: { email: demoEmail }, update: {}, create: { email: demoEmail, name: 'Demo User' } });
      (body as any).user_id = demo.id;
    }
    const created: string[] = [];
    for (const rule of body.rules) {
      const row = await prisma.alert_subscriptions.create({
        data: {
          itinerary_id: body.itinerary_id,
          user_id: body.user_id ?? undefined,
          rule: rule as any,
          channel: body.channel || 'in_app',
          active: true,
        },
      });
      created.push(row.id);
      // Programamos la siguiente verificación
      await scheduleRule(row.id, nextIn(60));
      // Ejecutamos una evaluación inicial inmediata y guardamos el resultado de Pricing
      try {
        const { alertRow, nextCheckAt } = await evalRuleAndMaybeTrigger(row);
        if (nextCheckAt) await scheduleRule(row.id, nextCheckAt);
        if (alertRow) {
          // Enviamos fanout inmediatamente
          await fanout(alertRow);
        }
      } catch (e) {
        console.warn('[alerts] initial eval error for rule', rule?.type, e?.message || e);
      }
    }
    return { subscription_id: created[0], rules_active: body.rules };
  }

  @Post('notify')
  async notify(@Body() body: any) {
    // Si llega una notificación sin `pricing` pero con `route` u `origin/destination`, tratamos de adjuntar pricing
    try {
      if (!body?.pricing) {
        let origin: string | undefined;
        let destination: string | undefined;
        let date: string | undefined;
        if (body?.route && typeof body.route === 'string' && body.route.includes('-')) {
          const parts = String(body.route).split('-');
          origin = parts[0];
          destination = parts[1];
        }
        origin = body?.origin || origin;
        destination = body?.destination || destination;
        date = body?.date || body?.start_date || date;
        if (origin && destination) {
          const { data } = await axios.post(`${PRICING_URL}/pricing/predict`, { origin, destination, start_date: date });
          const p = Array.isArray(data?.predictions) && data.predictions[0] ? data.predictions[0] : null;
          if (p) body.pricing = p;
        }
      }
    } catch (e) {
      console.warn('[alerts] enrich notify with pricing failed', e?.message || e);
    }
    return { ok: true, echo: body };
  }

  @Get('list')
  async list(@Query() q: AlertsListQuery): Promise<{ items: AlertRecord[] }> {
    const prisma = getPrisma();
    const limit = Math.min(200, Math.max(1, Number(q.limit) || 100));
    const from = q.from ? new Date(q.from) : undefined;
    const to = q.to ? new Date(q.to) : undefined;
    const baseWhere: any = {};
    if (q.status) baseWhere.status = q.status;
    if (from || to)
      baseWhere.created_at = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };

    let alerts: any[] = [];
    if (q.itinerary_id) {
      const subs = await prisma.alert_subscriptions.findMany({
        where: { itinerary_id: q.itinerary_id },
      });
      alerts = await prisma.alerts.findMany({
        where: { ...baseWhere, subscription_id: { in: subs.map(s => s.id) } },
        orderBy: { created_at: 'desc' },
        take: limit,
      });
    } else if (q.user_id) {
      const subs = await prisma.alert_subscriptions.findMany({
        where: { user_id: q.user_id },
      });
      alerts = await prisma.alerts.findMany({
        where: { ...baseWhere, subscription_id: { in: subs.map(s => s.id) } },
        orderBy: { created_at: 'desc' },
        take: limit,
      });
    } else {
      alerts = await prisma.alerts.findMany({
        where: baseWhere,
        orderBy: { created_at: 'desc' },
        take: limit,
      });
    }

    const items: AlertRecord[] = alerts.map(a => ({
      id: a.id,
      subscription_id: a.subscription_id || undefined,
      payload: a.payload as any,
      status: a.status,
      created_at: a.created_at.toISOString(),
    }));
    return { items };
  }

  @Post('test-fire')
  async testFire(@Body() body: any) {
    const prisma = getPrisma();
    // Adjuntamos pricing si es posible
    try {
      let origin: string | undefined;
      let destination: string | undefined;
      let date: string | undefined;
      if (body?.route && typeof body.route === 'string' && body.route.includes('-')) {
        const parts = String(body.route).split('-');
        origin = parts[0];
        destination = parts[1];
      }
      origin = body?.origin || origin;
      destination = body?.destination || destination;
      date = body?.date || body?.start_date || date;
      if (origin && destination && !body?.pricing) {
        const { data } = await axios.post(`${PRICING_URL}/pricing/predict`, { origin, destination, start_date: date });
        const p = Array.isArray(data?.predictions) && data.predictions[0] ? data.predictions[0] : null;
        if (p) body.pricing = p;
      }
    } catch (e) {
      console.warn('[alerts] enrich test-fire with pricing failed', e?.message || e);
    }
    const row = await prisma.alerts.create({
      data: {
        payload: body,
      } as unknown as Prisma.alertsCreateInput,
      select: { id: true, subscription_id: true, payload: true, status: true },
    });
    await fanout(row);
    return { ok: true, alert_id: row.id };
  }
}

@Module({ controllers: [AlertsController] })
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  const port = Number(process.env.PORT || process.env.ALERTS_PORT || 3000);
  await app.listen(port, '0.0.0.0');
  console.log(`[svc-alerts] listening on :${port}`);
  startScheduler();
}
bootstrap();
