import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import axios from 'axios';
import { EventsGateway } from '../events.gateway';
import { getPrisma } from '@wadatrip/db';
import { getClaimsFromAuth } from '../utils/auth';

type AlertsSubscribeRequest = {
  itinerary_id?: string | null;
  user_id?: string | null;
  channel?: string;
  rules?: any[];
};

type AlertsSubscribeResponse = {
  ok: boolean;
  subscription_id?: string | null;
};

type AlertRecord = {
  id: string;
  user_id: string;
  itinerary_id?: string | null;
  rule: any;
  channel: string;
  active: boolean;
  created_at: Date;
};

const ALERTS_URL = process.env.ALERTS_URL || 'http://localhost:3013';
const ALERTS_ENABLED = (process.env.FF_ALERTS || 'false').toLowerCase() === 'true';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly events: EventsGateway) {}
  @Post('subscribe')
  async subscribe(@Body() body: AlertsSubscribeRequest): Promise<AlertsSubscribeResponse> {
    if (ALERTS_ENABLED) {
      const { data } = await axios.post(`${ALERTS_URL}/alerts/subscribe`, body);
      return data;
    }
    return { ok: true, subscription_id: null } as any;
  }

  @Post('notify')
  async notify(@Body() body: any): Promise<{ ok: boolean } & any> {
    if (ALERTS_ENABLED) {
      const { data } = await axios.post(`${ALERTS_URL}/alerts/notify`, body);
      this.events.emitAlertTriggered({
        alert_id: data?.alert_id || null,
        type: body?.type || 'generic',
        payload: body,
        ts: new Date().toISOString(),
      });
      return data;
    }

    this.events.emitAlertTriggered({
      alert_id: null,
      type: body?.type || 'generic',
      payload: body,
      ts: new Date().toISOString(),
    });
    return { ok: true };
  }

  // Backward-compatible list endpoints
  @Get('list')
  async list(
    @Query('itinerary_id') itinerary_id?: string,
    @Query('user_id') user_id?: string,
    @Req() req?: any,
  ): Promise<{ items: AlertRecord[] }> {
    if (ALERTS_ENABLED) {
      const { data } = await axios.get(`${ALERTS_URL}/alerts/list`, { params: { itinerary_id, user_id } });
      return data;
    }

    const prisma = getPrisma();
    const where: any = {};
    if (user_id) {
      where.user_id = String(user_id);
    } else {
      const claims = getClaimsFromAuth(req);
      if (claims?.sub && claims?.role !== 'admin') {
        where.user_id = String(claims.sub);
      }
    }
    if (itinerary_id) where.itinerary_id = String(itinerary_id);
    const items = await prisma.alert_subscriptions.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
    return {
      items: items.map((item: any) => ({
        id: item.id,
        user_id: item.user_id,
        itinerary_id: item.itinerary_id,
        rule: item.rule as any,
        channel: item.channel,
        active: item.active,
        created_at: item.created_at,
      })) as any,
    };
  }

  @Get()
  async listRoot(
    @Query('itinerary_id') itinerary_id?: string,
    @Query('user_id') user_id?: string,
    @Req() req?: any,
  ): Promise<{ items: AlertRecord[] }> {
    return this.list(itinerary_id, user_id, req);
  }

  @Post('test-fire')
  async testFire(@Body() body: any): Promise<{ ok: boolean; alert_id?: string }> {
    if (ALERTS_ENABLED) {
      const { data } = await axios.post(`${ALERTS_URL}/alerts/test-fire`, body);
      if (data?.ok) {
        this.events.emitAlertTriggered({ alert_id: data.alert_id || null, type: body?.type || 'test', payload: body, ts: new Date().toISOString() });
      }
      return data;
    }

    this.events.emitAlertTriggered({ alert_id: null, type: body?.type || 'test', payload: body, ts: new Date().toISOString() });
    return { ok: true };
  }
}
