import { Controller, Post, Get, Param, Body, BadRequestException, Query } from '@nestjs/common';
import { getPrisma } from '@wadatrip/db/src/client';

@Controller('providers')
export class ProvidersController {
  @Get()
  async list(@Query() query: any) {
    const prisma = getPrisma();
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 50)));
    const skip = (page - 1) * limit;
    const where: any = {};
    if (query.status) where.status = String(query.status);
    if (query.q) {
      const q = String(query.q);
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { base_city: { contains: q, mode: 'insensitive' } },
        { country_code: { contains: q, mode: 'insensitive' } },
      ];
    }
    const [total, items] = await Promise.all([
      prisma.providers.count({ where }),
      prisma.providers.findMany({ where, orderBy: { created_at: 'desc' }, skip, take: limit }),
    ]);
    return { items, total, page, limit };
  }
  @Post()
  async create(@Body() body: any) {
    const prisma = getPrisma();

    const required = ['type', 'name', 'email', 'base_city', 'country_code'];
    for (const k of required) if (!body?.[k]) throw new BadRequestException(`missing ${k}`);

    const languages: string[] = Array.isArray(body.languages)
      ? body.languages
      : typeof body.languages === 'string'
        ? String(body.languages).split(',').map((s) => s.trim()).filter(Boolean)
        : [];

    const data: any = {
      type: String(body.type),
      name: String(body.name),
      email: String(body.email),
      phone: body.phone ? String(body.phone) : null,
      languages,
      base_city: String(body.base_city),
      country_code: String(body.country_code),
    };

    if (Array.isArray(body.documents) && body.documents.length) {
      data.documents = {
        create: body.documents.map((d: any) => ({
          doc_type: String(d.doc_type),
          url: String(d.url),
          notes: d.notes ? String(d.notes) : null,
          status: d.status ? String(d.status) : undefined,
        })),
      };
    }

    const created = await prisma.providers.create({ data, include: { documents: true, listings: true } });
    return created;
  }

  @Post(':id/verify')
  async verify(@Param('id') id: string, @Body() body: any) {
    const prisma = getPrisma();
    const status = String(body?.status || '').toLowerCase();
    if (!['verified', 'rejected'].includes(status)) throw new BadRequestException('status must be verified|rejected');

    const exists = await prisma.providers.findUnique({ where: { id } });
    if (!exists) throw new BadRequestException('provider not found');

    const updated = await prisma.providers.update({ where: { id }, data: { status, stripe_account_id: body?.stripe_account_id ?? undefined } });

    if (Array.isArray(body?.documents) && body.documents.length) {
      await prisma.provider_documents.createMany({
        data: body.documents.map((d: any) => ({
          provider_id: id,
          doc_type: String(d.doc_type),
          url: String(d.url),
          notes: d.notes ? String(d.notes) : null,
          status: d.status ? String(d.status) : 'pending',
        })),
        skipDuplicates: true,
      });
    }

    return updated;
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const prisma = getPrisma();
    const provider = await prisma.providers.findUnique({
      where: { id },
      include: { documents: true, listings: true },
    });
    if (!provider) throw new BadRequestException('provider not found');
    return provider;
  }
}
