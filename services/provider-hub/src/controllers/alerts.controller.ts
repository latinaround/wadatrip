import { Controller, Post, Body, Get } from '@nestjs/common';
import axios from 'axios';

const ALERTS_URL = process.env.ALERTS_URL || 'http://127.0.0.1:3013';

@Controller('alerts')
export class AlertsController {
  @Post('create')
  async create(@Body() body: any) {
    const { data } = await axios.post(`${ALERTS_URL}/alerts/create`, body);
    return data;
  }

  @Get('list')
  async list() {
    const { data } = await axios.get(`${ALERTS_URL}/alerts/list`);
    return data;
  }
}
