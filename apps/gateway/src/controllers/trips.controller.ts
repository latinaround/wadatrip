import { BadRequestException, Body, Controller, Get, Param, Post, Req, UnauthorizedException } from '@nestjs/common';
import { getUserIdFromAuth } from '../utils/auth';
import { getPrisma } from '@wadatrip/db';

@Controller('trips')
export class TripsController {
  private userId(req: any) {
    const userId = getUserIdFromAuth(req);
    if (!userId) throw new UnauthorizedException('not authenticated');
    return userId;
  }

  @Get()
  async list(@Req() req: any) {
    const userId = this.userId(req);
    const prisma = getPrisma();
    const items = await prisma.trips.findMany({
      where: { user_id: userId },
      orderBy: { start_date: 'asc' },
      include: {
        experiences: { include: { listing: true } },
        bookings: { include: { listing: true } },
      },
    });
    return { items };
  }

  @Post()
  async create(@Body() body: any, @Req() req: any) {
    if (!body?.destination) throw new BadRequestException('destination is required');

    const rawBudget = body.budget == null || body.budget === '' ? null : Number(body.budget);
    if (rawBudget != null && !Number.isFinite(rawBudget)) {
      throw new BadRequestException('budget must be a number');
    }

    const userId = this.userId(req);
    const prisma = getPrisma();
    return prisma.trips.create({
      data: {
        user_id: userId,
        title: String(body.title || `Trip to ${body.destination}`),
        destination: String(body.destination),
        start_date: body.start_date ? new Date(body.start_date) : null,
        end_date: body.end_date ? new Date(body.end_date) : null,
        travelers: Math.max(1, Number(body.travelers || 1)),
        budget: rawBudget,
        currency: String(body.currency || 'USD').toUpperCase(),
        interests: Array.isArray(body.interests) ? body.interests.map(String) : [],
        status: String(body.status || 'planning'),
      },
    });
  }

  @Get(':id')
  async get(@Param('id') id: string, @Req() req: any) {
    const userId = this.userId(req);
    const prisma = getPrisma();
    const trip = await prisma.trips.findFirst({
      where: { id, user_id: userId },
      include: {
        experiences: { include: { listing: true } },
        bookings: { include: { listing: true } },
      },
    });
    if (!trip) throw new BadRequestException('trip not found');
    return trip;
  }

  @Post(':id/experiences')
  async saveExperience(@Param('id') tripId: string, @Body() body: any, @Req() req: any) {
    if (!body?.listing_id) throw new BadRequestException('listing_id is required');

    const userId = this.userId(req);
    const prisma = getPrisma();
    const trip = await prisma.trips.findFirst({ where: { id: tripId, user_id: userId } });
    if (!trip) throw new BadRequestException('trip not found');

    return prisma.trip_experiences.upsert({
      where: { trip_experience_unique: { trip_id: tripId, listing_id: String(body.listing_id) } },
      update: { source: String(body.source || 'traveler') },
      create: { trip_id: tripId, listing_id: String(body.listing_id), source: String(body.source || 'traveler') },
      include: { listing: true },
    });
  }
}