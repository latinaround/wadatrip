import { Controller, Post, Body, Get, BadRequestException, Delete, Param } from '@nestjs/common';
import { getPrisma } from '@wadatrip/db';
import axios from 'axios';

const ALERTS_URL = process.env.ALERTS_URL || 'http://localhost:3013';

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

  @Post('tours/create')
  async createTourAlert(@Body() body: any) {
    const prisma = getPrisma();
    const city = body.city ? String(body.city) : null;
    const country_code = body.country_code ? String(body.country_code) : null;
    const listing_id = body.listing_id ? String(body.listing_id) : null;
    const budget = body.budget != null ? Number(body.budget) : null;
    const email = body.email ? String(body.email) : null;
    const user_id = body.user_id ? String(body.user_id) : null;
    const channel = body.channel ? String(body.channel) : 'email';

    if (!city && !country_code && !listing_id) {
      throw new BadRequestException('city or country_code or listing_id is required');
    }
    if (!user_id && !email) {
      throw new BadRequestException('user_id or email is required');
    }

    let resolvedUserId: string | null = null;
    if (user_id) {
      const user = await prisma.users.findUnique({ where: { id: user_id } });
      resolvedUserId = user?.id || null;
    }

    if (!resolvedUserId && email) {
      const user = await prisma.users.upsert({
        where: { email: email.toLowerCase() },
        update: {},
        create: { email: email.toLowerCase(), name: body.name ?? null },
      });
      resolvedUserId = user.id;
    }

    if (!resolvedUserId) {
      throw new BadRequestException('unable to resolve user');
    }

    const subscription = await prisma.alert_subscriptions.create({
      data: {
        user_id: resolvedUserId,
        itinerary_id: null,
        rule: {
          type: 'tour',
          city,
          country_code,
          listing_id,
          budget,
          currency: body.currency ?? 'USD',
        },
        channel,
        active: true,
      },
    });

    return { ok: true, subscription_id: subscription.id, rule: subscription.rule };
  }

  @Get('tours/list')
  async listTourAlerts() {
    const prisma = getPrisma();
    const items = await prisma.alert_subscriptions.findMany({
      where: { rule: { path: ['type'], equals: 'tour' } as any },
      orderBy: { created_at: 'desc' },
    });
    return {
      items: items.map((i) => ({
        id: i.id,
        user_id: i.user_id,
        rule: i.rule,
        channel: i.channel,
        created_at: i.created_at,
      })),
    };
  }

  @Post(':id/delete')
  async deleteAlert(@Body() _body: any, @Body('id') _id: any) {
    throw new BadRequestException('Use DELETE /alerts/:id');
  }

  @Get(':id/delete')
  async deleteAlertGet() {
    throw new BadRequestException('Use DELETE /alerts/:id');
  }

  @Post(':id')
  async deletePost(@Body() _body: any) {
    throw new BadRequestException('Use DELETE /alerts/:id');
  }

  @Post(':id/remove')
  async deletePostRemove() {
    throw new BadRequestException('Use DELETE /alerts/:id');
  }

  @Post(':id/delete-hard')
  async deleteHard() {
    throw new BadRequestException('Use DELETE /alerts/:id');
  }

  @Delete(':id')
  async deleteAlertDb(@Param('id') id: string) {
    const prisma = getPrisma();
    const exists = await prisma.alert_subscriptions.findUnique({ where: { id } });
    if (!exists) throw new BadRequestException('alert not found');
    await prisma.alert_subscriptions.delete({ where: { id } });
    return { ok: true };
  }
}
