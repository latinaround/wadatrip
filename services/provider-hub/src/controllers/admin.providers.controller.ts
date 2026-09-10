import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Post, Query, Req } from '@nestjs/common';
import { getPrisma } from '@wadatrip/db';
import type { Request } from 'express';

import { requireAdmin } from '@wadatrip/common/security';
import { adminProviderDetailSelect } from '@wadatrip/common/public-data';

@Controller('admin/providers')
export class AdminProvidersController {
  @Get()
  async list(@Req() req: Request, @Query('status') status?: string, @Query('limit') limit?: string, @Query('page') page?: string) {
    const actor = await requireAdmin(req, getPrisma());
    const prisma = getPrisma();
    const where: any = {};
    if (status) {
      const normalizedStatus = String(status).toLowerCase();
      where.status = ['approved', 'verified'].includes(normalizedStatus) ? { in: ['approved', 'verified'] } : normalizedStatus;
    }

    const pageNum = Math.max(1, Number(page || 1));
    const limitNum = Math.min(100, Math.max(1, Number(limit || 50)));
    const skip = (pageNum - 1) * limitNum;

    const [total, items] = await Promise.all([
      prisma.providers.count({ where }),
      prisma.providers.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { created_at: 'asc' },
      }),
    ]);

    return { items, total, page: pageNum, limit: limitNum };
  }

  @Get(':id')
  async detail(@Req() req: Request, @Param('id') id: string) {
    await requireAdmin(req, getPrisma());
    const provider = await getPrisma().providers.findUnique({ where: { id }, select: adminProviderDetailSelect });
    if (!provider) throw new BadRequestException('provider not found');
    return provider;
  }

  @Post(':id/approve')
  async approve(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    const actor = await requireAdmin(req, getPrisma());
    const prisma = getPrisma();

    const provider = await prisma.providers.findUnique({ where: { id: String(id) } });
    if (!provider) throw new BadRequestException('provider not found');

    const verifiedLevelRaw = String(body?.verified_level || provider.verified_level || 'community').toLowerCase();
    const verified_level = verifiedLevelRaw === 'licensed' ? 'licensed' : 'community';
    const approved_by = actor.id;
    const license_url = body?.license_url != null ? String(body.license_url) : provider.license_url;

    const updated = await prisma.providers.update({
      where: { id: String(id) },
      data: {
        status: 'approved',
        verification_status: 'approved',
        verified_level,
        license_url,
        approved_at: new Date(),
        approved_by,
      },
    });

    return { ok: true, provider: updated };
  }

  @Post(':id/reject')
  async reject(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    const actor = await requireAdmin(req, getPrisma());
    const prisma = getPrisma();

    const provider = await prisma.providers.findUnique({ where: { id: String(id) } });
    if (!provider) throw new BadRequestException('provider not found');

    const approved_by = actor.id;
    const reason = body?.reason ? String(body.reason) : null;

    const notes = [provider.verification_notes, reason].filter(Boolean).join(' | ');

    const updated = await prisma.providers.update({
      where: { id: String(id) },
      data: {
        status: 'rejected',
        verification_status: 'rejected',
        approved_at: new Date(),
        approved_by,
        verification_notes: notes || provider.verification_notes,
      },
    });

    return { ok: true, provider: updated };
  }
}
