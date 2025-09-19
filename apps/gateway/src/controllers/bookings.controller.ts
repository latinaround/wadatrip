import { Controller, Get, Post, Body, Param, Query, NotFoundException } from '@nestjs/common';
import axios from 'axios';

const HUB = process.env.PROVIDER_HUB_URL || 'http://127.0.0.1:3014';
const ENABLED = (process.env.FF_PROVIDER_HUB || 'false').toLowerCase() === 'true';
function ensureEnabled() { if (!ENABLED) throw new NotFoundException(); }

@Controller()
export class BookingsController {
  @Get('bookings')
  async list(@Query() q: any) {
    ensureEnabled();
    const { data } = await axios.get(`${HUB}/bookings`, { params: q });
    return data;
  }
  @Get('bookings/:id')
  async get(@Param('id') id: string) {
    ensureEnabled();
    const { data } = await axios.get(`${HUB}/bookings/${id}`);
    return data;
  }
  @Post('bookings')
  async create(@Body() body: any) {
    ensureEnabled();
    const { data } = await axios.post(`${HUB}/bookings`, body);
    return data;
  }
  @Post('bookings/:id/status')
  async status(@Param('id') id: string, @Body() body: any) {
    ensureEnabled();
    const { data } = await axios.post(`${HUB}/bookings/${id}/status`, body);
    return data;
  }
}

