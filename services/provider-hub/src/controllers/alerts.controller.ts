import { requireActor, requireAlertAccess, requireAdmin } from '@wadatrip/common/security';
import { Controller, Post, Body, Get, BadRequestException, Delete, Param, Req } from '@nestjs/common';
import { getPrisma } from '@wadatrip/db';
import axios from 'axios';

const ALERTS_URL = process.env.ALERTS_URL || 'http://localhost:3013';

@Controller('alerts')
export class AlertsController {
  @Post('create')
  async create(@Body() body: any, @Req() req: any) {
    await requireActor(req, getPrisma());
    throw new BadRequestException('Use /alerts/tours/create');
    /*
    const { data } = await axios.post(`${ALERTS_URL}/alerts/create`, body);
    return data; */
  }

  @Get('list')
  async list(@Req() req: any) {
    return this.listTourAlerts(req);
  }

  @Post('tours/create')
  async createTourAlert(@Body() body: any, @Req() req: any) {
    const actor = await requireActor(req, getPrisma());
    const prisma = getPrisma();
    const city = body.city ? String(body.city) : null;
    const country_code = body.country_code ? String(body.country_code) : null;
    const listing_id = body.listing_id ? String(body.listing_id) : null;
    const budget = body.budget != null ? Number(body.budget) : null;
    const email = actor.email;
    const user_id = actor.id;
    const channel = body.channel ? String(body.channel) : 'email';

    if (!city && !country_code && !listing_id) {
      throw new BadRequestException('city or country_code or listing_id is required');
    }
    if (!user_id && !email) {
      throw new BadRequestException('user_id or email is required');
    }

    const resolvedUserId = actor.id;

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
  async listTourAlerts(@Req() req: any) {
    const actor = await requireActor(req, getPrisma());
    const prisma = getPrisma();
    const items = await prisma.alert_subscriptions.findMany({
      where: { user_id: actor.id, rule: { path: ['type'], equals: 'tour' } as any },
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
  async deleteAlertDb(@Param('id') id: string, @Req() req: any) {
    await requireAlertAccess(req, getPrisma(), id);
    const prisma = getPrisma();
    const exists = await prisma.alert_subscriptions.findUnique({ where: { id } });
    if (!exists) throw new BadRequestException('alert not found');
    await prisma.alert_subscriptions.delete({ where: { id } });
    return { ok: true };
  }
}
