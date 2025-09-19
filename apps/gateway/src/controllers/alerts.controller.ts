import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import axios from 'axios';
import { AlertsSubscribeRequest, AlertsSubscribeResponse, AlertRecord } from '@wadatrip/common/dtos';
import { EventsGateway } from '../events.gateway';

const ALERTS_URL = process.env.ALERTS_URL || 'http://localhost:3013';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly events: EventsGateway) {}
  @Post('subscribe')
  async subscribe(@Body() body: AlertsSubscribeRequest): Promise<AlertsSubscribeResponse> {
    const { data } = await axios.post(`${ALERTS_URL}/alerts/subscribe`, body);
    return data;
  }

  @Post('notify')
  async notify(@Body() body: any): Promise<{ ok: boolean } & any> {
    const { data } = await axios.post(`${ALERTS_URL}/alerts/notify`, body);
    this.events.emitAlertTriggered({
      alert_id: data?.alert_id || null,
      type: body?.type || 'generic',
      payload: body,
      ts: new Date().toISOString(),
    });
    return data;
  }

  // Backward-compatible list endpoints
  @Get('list')
  async list(@Query('itinerary_id') itinerary_id?: string, @Query('user_id') user_id?: string): Promise<{ items: AlertRecord[] }> {
    const { data } = await axios.get(`${ALERTS_URL}/alerts/list`, { params: { itinerary_id, user_id } });
    return data;
  }

  @Get()
  async listRoot(@Query('itinerary_id') itinerary_id?: string, @Query('user_id') user_id?: string): Promise<{ items: AlertRecord[] }> {
    const { data } = await axios.get(`${ALERTS_URL}/alerts/list`, { params: { itinerary_id, user_id } });
    return data;
  }

  @Post('test-fire')
  async testFire(@Body() body: any): Promise<{ ok: boolean; alert_id?: string }> {
    const { data } = await axios.post(`${ALERTS_URL}/alerts/test-fire`, body);
    if (data?.ok) {
      this.events.emitAlertTriggered({ alert_id: data.alert_id || null, type: body?.type || 'test', payload: body, ts: new Date().toISOString() });
    }
    return data;
  }
}
