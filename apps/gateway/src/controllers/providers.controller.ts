import { Controller, Post, Get, Param, Body, Query, NotFoundException } from '@nestjs/common';
import axios from 'axios';

const HUB = process.env.PROVIDER_HUB_URL || 'http://127.0.0.1:3014';
const ENABLED = (process.env.FF_PROVIDER_HUB || 'false').toLowerCase() === 'true';

function ensureEnabled() {
  if (!ENABLED) throw new NotFoundException();
}

@Controller()
export class ProvidersController {
  @Get('providers')
  async listProviders(@Query() q: Record<string, any>) {
    ensureEnabled();
    const { data } = await axios.get(`${HUB}/providers`, { params: q });
    return data;
  }
  @Post('providers')
  async createProvider(@Body() body: any) {
    ensureEnabled();
    const { data } = await axios.post(`${HUB}/providers`, body);
    return data;
  }

  @Get('providers/:id')
  async getProvider(@Param('id') id: string) {
    ensureEnabled();
    const { data } = await axios.get(`${HUB}/providers/${id}`);
    return data;
  }

  @Post('providers/:id/verify')
  async verifyProvider(@Param('id') id: string, @Body() body: any) {
    ensureEnabled();
    const { data } = await axios.post(`${HUB}/providers/${id}/verify`, body);
    return data;
  }

  @Post('listings')
  async createListing(@Body() body: any) {
    ensureEnabled();
    const { data } = await axios.post(`${HUB}/listings`, body);
    return data;
  }

  @Get('listings/search')
  async searchListings(@Query() q: Record<string, any>) {
    ensureEnabled();
    const { data } = await axios.get(`${HUB}/listings/search`, { params: q });
    return data;
  }

  @Post('listings/:id/status')
  async setListingStatus(@Param('id') id: string, @Body() body: any) {
    ensureEnabled();
    const { data } = await axios.patch(`${HUB}/listings/${id}/status`, body);
    return data;
  }
}
