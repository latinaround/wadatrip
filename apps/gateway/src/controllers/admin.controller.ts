import { Body, Controller, Get, Post, Query, Req, Res, BadRequestException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { getPrisma } from '@wadatrip/db';
import { getJwtSecret, getClaimsFromAuth, requireAdminIdentity } from '@wadatrip/common/security';
import { hasAdminProof } from '@wadatrip/common/admin-proof';
import { setupAdminMfa, verifyAdminMfa } from '../services/admin-mfa.service';
import { readAdminUsers } from '../services/admin-user-data.service';

export const adminUserSelect = { id: true, name: true, email: true, role: true, status: true, created_at: true, last_login_at: true,
  _count: { select: { bookings: true, tour_date_requests: true } }, provider_profile: { select: { id: true, status: true } } };
export const adminRequestSelect = { id: true, user_id: true, listing_id: true, requested_date: true, num_people: true, status: true,
  response_date: true, created_at: true, listing: { select: { title: true, provider_id: true } } };
export const adminIssueSelect = { id: true, user_id: true, date: true, status: true, payment_status: true, inventory_state: true,
  amount_cents: true, currency: true, created_at: true, listing: { select: { title: true } },
  payment: { select: { id: true, processor: true, status: true, resolution: true, refund_status: true,
    amount_charged_cents: true, charged_currency: true, updated_at: true } } };
export function adminPagination(query: any) {
  const integer = (value: any, fallback: number, max: number) => {
    if (value == null || value === '') return fallback;
    if (!/^\d+$/.test(String(value)) || Number(value) < 1 || Number(value) > max) throw new BadRequestException('Invalid pagination');
    return Number(value);
  };
  const page = integer(query.page, 1, 100000), limit = integer(query.limit, 20, 100);
  return { page, limit, skip: (page - 1) * limit };
}

@Controller('admin')
export class AdminController {
  private async identity(req: any, res: any) {
    res.setHeader('Cache-Control', 'no-store');
    if (process.env.ENABLE_ADMIN_CONSOLE !== 'true') throw new ServiceUnavailableException('Admin console is not available yet');
    return requireAdminIdentity(req, getPrisma());
  }
  private async access(req: any, res: any) {
    const actor = await this.identity(req, res);
    if (!await hasAdminProof(req, getPrisma(), actor.id, getJwtSecret())) throw new ForbiddenException({ message: 'Authenticator verification required', code: 'ADMIN_STEP_UP_REQUIRED' });
    return actor;
  }
  @Get('session')
  async session(@Req() req: any, @Res({ passthrough: true }) res: any) {
    const actor = await this.identity(req, res), prisma = getPrisma();
    const record = await prisma.admin_mfa.findUnique({ where: { user_id: actor.id }, select: { enabled_at: true } });
    return { admin: true, mfa_enrolled: Boolean(record?.enabled_at), step_up_verified: await hasAdminProof(req, prisma, actor.id, getJwtSecret()) };
  }
  @Post('mfa/setup')
  async setup(@Req() req: any, @Res({ passthrough: true }) res: any) {
    const actor = await this.identity(req, res), claims = getClaimsFromAuth(req);
    if (typeof claims?.iat !== 'number' || Date.now() / 1000 - claims.iat > 10 * 60) {
      throw new ForbiddenException({ message: 'Inicia sesión de nuevo antes de configurar tu autenticador.', code: 'ADMIN_PRIMARY_REAUTH_REQUIRED' });
    }
    return setupAdminMfa(getPrisma(), actor);
  }
  @Post('mfa/verify')
  async verify(@Req() req: any, @Body() body: any, @Res({ passthrough: true }) res: any) { return verifyAdminMfa(getPrisma(), await this.identity(req, res), req, body?.code); }

  private async read(prisma: any, actor: any, delegate: string, query: any, where: any, select: any, action: string) {
    const { page, limit, skip } = adminPagination(query);
    return prisma.$transaction(async (tx: any) => {
      const total = await tx[delegate].count({ where });
      const items = await tx[delegate].findMany({ where, select, take: limit, skip, orderBy: [{ created_at: 'desc' }, { id: 'desc' }] });
      await tx.admin_audit_log.create({ data: { actor_id: actor.id, action, result: 'success' } });
      return { items, total, page, limit };
    });
  }
  @Get('users')
  async users(@Req() req: any, @Query() query: any, @Res({ passthrough: true }) res: any) {
    const actor = await this.access(req, res);
    return readAdminUsers(getPrisma(), actor, query, adminPagination(query), adminUserSelect);
  }
  @Get('date-requests')
  async requests(@Req() req: any, @Query() query: any, @Res({ passthrough: true }) res: any) {
    const actor = await this.access(req, res), where: any = {};
    if (query.status) { if (!['requested','available','declined','cancelled'].includes(query.status)) throw new BadRequestException('Invalid request status'); where.status = query.status; }
    return this.read(getPrisma(), actor, 'tour_date_requests', query, where, adminRequestSelect, 'date_requests.list');
  }
  @Get('payment-issues')
  async issues(@Req() req: any, @Query() query: any, @Res({ passthrough: true }) res: any) {
    const actor = await this.access(req, res);
    const where = { OR: [{ status: { in: ['reconciliation_required', 'cancellation_pending'] } },
      { payment_status: { in: ['refund_required', 'reconciliation_required'] } },
      { payment: { is: { OR: [{ resolution: { in: ['refund_required', 'reconciliation_required'] } }, { refund_status: { in: ['requested', 'processing', 'pending', 'failed', 'review_required'] } }] } } },
      { status: 'confirmed', amount_cents: null },
      { status: 'confirmed', amount_cents: { gt: 0 }, payment: { is: null } },
      { status: 'confirmed', amount_cents: { gt: 0 }, payment: { is: { status: { notIn: ['paid', 'succeeded'] } } } }] };
    return this.read(getPrisma(), actor, 'bookings', query, where, adminIssueSelect, 'payment_issues.list');
  }
  @Get('audit')
  async audit(@Req() req: any, @Query() query: any, @Res({ passthrough: true }) res: any) {
    const actor = await this.access(req, res);
    return this.read(getPrisma(), actor, 'admin_audit_log', query, {}, { id: true, actor_id: true, action: true, resource_id: true, result: true, created_at: true }, 'audit.list');
  }
}
