import { Body, Controller, Get, Param, Post, Query, Req, ServiceUnavailableException } from '@nestjs/common';
import { getPrisma } from '@wadatrip/db';
import { requireActor } from '@wadatrip/common/security';
import { cancelDateRequest, createDateRequest, requestScope, requestSelect, respondToDateRequest } from '../services/tour-date-request.service';

@Controller('tour-date-requests')
export class TourDateRequestsController {
  @Get('status')
  status() { return { enabled: process.env.ENABLE_TOUR_DATE_REQUESTS === 'true' }; }

  private enabled() {
    if (process.env.ENABLE_TOUR_DATE_REQUESTS !== 'true') throw new ServiceUnavailableException('Date requests are not available yet');
  }
  @Get()
  async list(@Req() req: any, @Query() query: any) {
    this.enabled();
    const prisma = getPrisma(), actor = await requireActor(req, prisma);
    const where = { ...requestScope(actor, query.scope), ...(query.listing_id ? { listing_id: String(query.listing_id) } : {}) };
    const items = await prisma.tour_date_requests.findMany({ where, select: requestSelect, orderBy: { created_at: 'desc' }, take: 100 });
    return { items };
  }

  @Post()
  async create(@Req() req: any, @Body() body: any) {
    this.enabled();
    const prisma = getPrisma();
    return createDateRequest(prisma, await requireActor(req, prisma), body);
  }

  @Post(':id/respond')
  async respond(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    this.enabled();
    const prisma = getPrisma();
    return respondToDateRequest(prisma, await requireActor(req, prisma), id, body);
  }

  @Post(':id/cancel')
  async cancel(@Req() req: any, @Param('id') id: string) {
    this.enabled();
    const prisma = getPrisma();
    return cancelDateRequest(prisma, await requireActor(req, prisma), id);
  }
}
