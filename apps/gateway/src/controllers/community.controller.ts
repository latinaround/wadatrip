import { Body, Controller, ForbiddenException, Get, Param, Post, Query, Req, ServiceUnavailableException, UseFilters } from '@nestjs/common';
import { getPrisma } from '@wadatrip/db';
import { getJwtSecret, requireActor, requireAdmin } from '@wadatrip/common/security';
import { hasAdminProof } from '@wadatrip/common/admin-proof';
import { CommunityExceptionFilter } from '../services/community-exception.filter';
import { blockCommunity, changeCommunity, communityBlocks, communityReports, listCommunity, moderateCommunity, postCommunity, readCommunity, reportCommunity } from '../services/community.service';

function enabled() { if (process.env.ENABLE_COMMUNITY !== 'true') throw new ServiceUnavailableException('Community is not available yet'); }
const reader = (req: any, db: any) => req.headers?.authorization ? requireActor(req, db) : undefined;
async function moderator(req: any, db: any) {
  const stepUp = () => new ForbiddenException({ code: 'ADMIN_STEP_UP_REQUIRED', message: 'Admin access and a current authenticator verification are required.' });
  let actor;
  try { actor = await requireAdmin(req, db); }
  catch (error: any) { if (error.getStatus?.() === 403) throw stepUp(); throw error; }
  // The new moderation surface never inherits an optional legacy MFA bypass.
  if (!await hasAdminProof(req, db, actor.id, getJwtSecret())) throw stepUp();
  return actor;
}

@Controller('community')
@UseFilters(CommunityExceptionFilter)
export class CommunityController {
  @Get('status') status() { return { enabled: process.env.ENABLE_COMMUNITY === 'true' }; }
  @Get('threads') async list(@Req() req: any, @Query() query: any) { enabled(); const db = getPrisma(); return listCommunity(db, query, await reader(req, db)); }
  @Get('threads/:id') async read(@Req() req: any, @Param('id') id: string, @Query() query: any) { enabled(); const db = getPrisma(); return readCommunity(db, id, query, await reader(req, db)); }
  @Post('threads') async create(@Req() req: any, @Body() body: any) { enabled(); const db = getPrisma(); return postCommunity(db, await requireActor(req, db), body); }
  @Post('threads/:id/replies') async reply(@Req() req: any, @Param('id') id: string, @Body() body: any) { enabled(); const db = getPrisma(); return postCommunity(db, await requireActor(req, db), body, id); }
  @Post('content/:kind/:id/:action') async change(@Req() req: any, @Param() p: any, @Body() body: any) { enabled(); const db = getPrisma(); return changeCommunity(db, await requireActor(req, db), p.kind, p.id, p.action, body?.reply_id); }
  @Post('reports/:kind/:id') async report(@Req() req: any, @Param() p: any, @Body() body: any) { enabled(); const db = getPrisma(); return reportCommunity(db, await requireActor(req, db), p.kind, p.id, body?.reason); }
  @Get('blocks') async blocks(@Req() req: any) { enabled(); const db = getPrisma(); return communityBlocks(db, await requireActor(req, db)); }
  @Post('blocks') async block(@Req() req: any, @Body() body: any) { enabled(); const db = getPrisma(); return blockCommunity(db, await requireActor(req, db), body?.user_id); }
  @Post('blocks/remove') async unblock(@Req() req: any, @Body() body: any) { enabled(); const db = getPrisma(); return blockCommunity(db, await requireActor(req, db), body?.user_id, true); }
}

@Controller('admin/community')
@UseFilters(CommunityExceptionFilter)
export class AdminCommunityController {
  @Get('reports') async reports(@Req() req: any, @Query() query: any) { enabled(); const db = getPrisma(); return communityReports(db, await moderator(req, db), query); }
  @Post('reports/:id/resolve') async resolve(@Req() req: any, @Param('id') id: string, @Body() body: any) { enabled(); const db = getPrisma(); return moderateCommunity(db, await moderator(req, db), id, body?.action); }
}
