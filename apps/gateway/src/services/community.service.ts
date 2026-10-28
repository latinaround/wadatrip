import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, HttpException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Actor } from '@wadatrip/common/security';

export const COMMUNITY_NOTICE = 'public_community_v1';
const countries = new Set(`AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`.split(' '));
const userSelect = { id: true, name: true, provider_profile: { select: { type: true, status: true } } };
const threadSelect = { id: true, country_code: true, city: true, region: true, kind: true, title: true, message: true,
  commercial: true, status: true, created_at: true, user: { select: userSelect } };
const replySelect = { id: true, thread_id: true, message: true, commercial: true, helpful: true, status: true,
  created_at: true, user: { select: userSelect } };
const visibleThread = { status: { in: ['open', 'resolved'] }, user: { status: 'active' } };
const visibleReply = { status: 'visible', user: { status: 'active' } };

function text(raw: any, max: number, min = 1) {
  if (typeof raw !== 'string') throw new BadRequestException('Enter valid text');
  const value = raw.normalize('NFC').trim();
  if (value.length < min || value.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) throw new BadRequestException('Text is missing, too long or contains invalid characters');
  return value;
}
const normalized = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toLowerCase();
export function communityDestination(input: any) {
  if (typeof input?.country_code !== 'string') throw new BadRequestException('Choose a country');
  const country_code = String(input?.country_code || '').toUpperCase();
  if (!countries.has(country_code)) throw new BadRequestException('Choose a country');
  const city = text(input?.city ?? '', 100, 0).replace(/\s+/g, ' ');
  const region = text(input?.region ?? '', 100, 0).replace(/\s+/g, ' ');
  if (region && !city) throw new BadRequestException('Choose a city before a region');
  const destination_key = createHash('sha256').update(JSON.stringify([country_code, normalized(city), normalized(region)])).digest('hex');
  return { country_code, city, region, destination_key };
}
function pageOf(raw: any) {
  const page = raw === undefined ? 1 : Number(raw);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100) throw new BadRequestException('Choose a valid page');
  return page;
}
function requestId(raw: any) {
  if (typeof raw !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)) throw new BadRequestException('A message request ID is required');
  return raw.toLowerCase();
}
function writer(actor: Actor) { if (!actor.verified) throw new ForbiddenException('Verify your email to participate'); }
function publicName(raw: any) {
  if (typeof raw !== 'string' || !raw.trim()) throw new ConflictException('Set a public display name in your account before posting');
  const name = text(raw, 100);
  if (name.includes('@')) throw new ConflictException('Set a public display name in your account before posting');
  return name;
}
function author(user: any) {
  const host = ['verified', 'approved'].includes(user.provider_profile?.status);
  // Never substitute an email or a claimed caller role for a public profile.
  return { id: user.id, name: user.name && !user.name.includes('@') ? user.name : 'Community member',
    role: host ? (user.provider_profile.type === 'operator' ? 'operator' : 'guide') : 'traveler' };
}
function publicItem(row: any) { const { user, ...item } = row; return { ...item, author: author(user) }; }
async function ignoredUsers(db: any, actor?: Actor) {
  return actor ? (await db.community_blocks.findMany({ where: { user_id: actor.id }, select: { blocked_user_id: true } })).map((r: any) => r.blocked_user_id) : [];
}
async function lockedWriter(db: any, actor: Actor) {
  writer(actor);
  const rows = await db.$queryRaw`SELECT id FROM users WHERE id = ${actor.id} FOR NO KEY UPDATE`;
  const user = rows.length ? await db.users.findUnique({ where: { id: actor.id } }) : null;
  if (!user || user.status !== 'active' || String(user.email).trim().toLowerCase() !== actor.email) throw new ForbiddenException('Account access changed');
  return user;
}
async function limit(db: any, model: string, userId: string, perMinute: number, perDay: number) {
  const now = Date.now();
  const minute = await db[model].count({ where: { user_id: userId, created_at: { gte: new Date(now - 60000) } } });
  const day = await db[model].count({ where: { user_id: userId, created_at: { gte: new Date(now - 86400000) } } });
  if (minute >= perMinute || day >= perDay) throw new HttpException('Please wait before posting again', 429);
}
async function root(db: any, id: string, lock = false) {
  if (lock) await db.$queryRaw`SELECT id FROM community_threads WHERE id = ${id} FOR NO KEY UPDATE`;
  const row = await db.community_threads.findFirst({ where: { id, ...visibleThread }, select: { ...threadSelect, user_id: true } });
  if (!row) throw new NotFoundException('Conversation not found');
  return row;
}
function consent(body: any) {
  if (body?.public_consent !== true) throw new BadRequestException('Confirm that this content will be public');
  if (body.commercial !== undefined && typeof body.commercial !== 'boolean') throw new BadRequestException('Choose a valid disclosure');
}
export async function listCommunity(db: any, query: any, actor?: Actor) {
  const dest = communityDestination(query), page = pageOf(query.page), ignored = await ignoredUsers(db, actor);
  const where: any = { ...visibleThread, user_id: { notIn: ignored }, ...(dest.city ? { destination_key: dest.destination_key } : { country_code: dest.country_code }) };
  if (query.kind) { if (!['question', 'tip'].includes(query.kind)) throw new BadRequestException('Choose questions or tips'); where.kind = query.kind; }
  const [rows, total] = await Promise.all([db.community_threads.findMany({ where, select: threadSelect, orderBy: [{ created_at: 'desc' }, { id: 'desc' }], skip: (page - 1) * 20, take: 20 }), db.community_threads.count({ where })]);
  return { destination: dest, items: rows.map(publicItem), total, page, limit: 20 };
}
export async function readCommunity(db: any, id: string, query: any, actor?: Actor) {
  const item = await root(db, id), ignored = await ignoredUsers(db, actor), page = pageOf(query.page);
  if (ignored.includes(item.user_id)) throw new NotFoundException('Conversation not found');
  const where = { thread_id: id, ...visibleReply, user_id: { notIn: ignored } };
  const [rows, total] = await Promise.all([db.community_replies.findMany({ where, select: replySelect, orderBy: [{ created_at: 'asc' }, { id: 'asc' }], skip: (page - 1) * 20, take: 20 }), db.community_replies.count({ where })]);
  const { user_id, ...safe } = item;
  return { thread: publicItem(safe), items: rows.map(publicItem), total, page, limit: 20 };
}
export async function postCommunity(db: any, actor: Actor, body: any, threadId?: string) {
  writer(actor); consent(body);
  const key = requestId(body.client_request_id), message = text(body.message, 2000, 3), commercial = body.commercial === true;
  const title = threadId ? undefined : text(body.title, 140, 5);
  const destination = threadId ? undefined : communityDestination(body);
  if (!threadId && !['question', 'tip'].includes(body.kind)) throw new BadRequestException('Choose a question or tip');
  return db.$transaction(async (tx: any) => {
    const user = await lockedWriter(tx, actor); publicName(user.name);
    const model = threadId ? 'community_replies' : 'community_threads';
    const old = await tx[model].findUnique({ where: { user_id_client_request_id: { user_id: actor.id, client_request_id: key } }, select: threadId ? replySelect : threadSelect });
    if (old) {
      if (old.message !== message || old.commercial !== commercial || (threadId ? old.thread_id !== threadId : old.title !== title || old.kind !== body.kind
        || communityDestination(old).destination_key !== destination!.destination_key)) throw new ConflictException('This request ID was already used for different content');
      if (old.status === 'hidden') throw new ConflictException('This content was removed');
      if (threadId) await root(tx, threadId);
      return publicItem(old);
    }
    if (threadId) {
      const thread = await root(tx, threadId, true);
      if (thread.status !== 'open') throw new ConflictException('This conversation is resolved');
      const block = await tx.community_blocks.findFirst({ where: { OR: [{ user_id: actor.id, blocked_user_id: thread.user_id }, { user_id: thread.user_id, blocked_user_id: actor.id }] } });
      if (block) throw new ForbiddenException('You cannot reply to this conversation');
    }
    await limit(tx, model, actor.id, threadId ? 10 : 2, threadId ? 100 : 20);
    return publicItem(await tx[model].create({ data: { user_id: actor.id, message, commercial,
      client_request_id: key, public_notice_version: COMMUNITY_NOTICE,
      ...(threadId ? { thread_id: threadId } : { ...destination, title, kind: body.kind }) }, select: threadId ? replySelect : threadSelect }));
  });
}
export async function changeCommunity(db: any, actor: Actor, kind: string, id: string, action: string, replyId?: string) {
  if (!['thread', 'reply'].includes(kind) || !['remove', 'resolve', 'helpful'].includes(action) || (kind === 'reply' && action !== 'remove')) throw new BadRequestException('Unknown action');
  return db.$transaction(async (tx: any) => {
    await lockedWriter(tx, actor);
    const model = kind === 'thread' ? 'community_threads' : 'community_replies';
    const row = await tx[model].findUnique({ where: { id } });
    if (!row || row.user_id !== actor.id) throw new NotFoundException('Content not found');
    if (action === 'remove') { await tx[model].update({ where: { id }, data: { status: 'hidden' } }); return { ok: true }; }
    const thread = await root(tx, id, true);
    if (action === 'resolve') { await tx.community_threads.update({ where: { id }, data: { status: 'resolved' } }); return { ok: true }; }
    const reply = await tx.community_replies.findFirst({ where: { id: replyId || '', thread_id: thread.id, ...visibleReply } });
    if (!reply || reply.user_id === actor.id) throw new BadRequestException('Choose another member’s visible reply');
    await tx.community_replies.updateMany({ where: { thread_id: id, helpful: true }, data: { helpful: false } });
    await tx.community_replies.update({ where: { id: reply.id }, data: { helpful: true } });
    return { ok: true };
  });
}
export async function reportCommunity(db: any, actor: Actor, kind: string, id: string, reason: string) {
  if (!['thread', 'reply'].includes(kind) || !['spam', 'harassment', 'privacy', 'other'].includes(reason)) throw new BadRequestException('Choose a report reason');
  return db.$transaction(async (tx: any) => {
    await lockedWriter(tx, actor);
    const row = kind === 'thread' ? await root(tx, id) : await tx.community_replies.findFirst({ where: { id, ...visibleReply } });
    if (!row) throw new NotFoundException('Content not found');
    if (kind === 'reply') await root(tx, row.thread_id);
    const field = kind === 'thread' ? 'thread_id' : 'reply_id';
    if (await tx.community_reports.findFirst({ where: { user_id: actor.id, [field]: id } })) return { ok: true };
    await limit(tx, 'community_reports', actor.id, 5, 20);
    await tx.community_reports.create({ data: { user_id: actor.id, [field]: id, reason } });
    return { ok: true };
  });
}
export async function blockCommunity(db: any, actor: Actor, blockedId: string, remove = false) {
  if (typeof blockedId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(blockedId) || blockedId === actor.id) throw new BadRequestException('Choose another member');
  return db.$transaction(async (tx: any) => {
    await lockedWriter(tx, actor);
    if (remove) { await tx.community_blocks.deleteMany({ where: { user_id: actor.id, blocked_user_id: blockedId } }); return { ok: true }; }
    if (!await tx.users.findUnique({ where: { id: blockedId } })) throw new NotFoundException('Member not found');
    const where = { user_id_blocked_user_id: { user_id: actor.id, blocked_user_id: blockedId } };
    if (!await tx.community_blocks.findUnique({ where: where })) {
      const count = await tx.community_blocks.count({ where: { user_id: actor.id } });
      if (count >= 500) throw new ConflictException('Contact support to review your blocked members');
      await tx.community_blocks.create({ data: { user_id: actor.id, blocked_user_id: blockedId } });
    }
    return { ok: true };
  });
}
export async function communityBlocks(db: any, actor: Actor) {
  const rows = await db.community_blocks.findMany({ where: { user_id: actor.id }, select: { blocked_user: { select: userSelect } }, take: 500 });
  return { items: rows.map((r: any) => author(r.blocked_user)) };
}

export async function communityReports(db: any, actor: Actor, query: any) {
  if (!actor.admin) throw new ForbiddenException('Admin access required');
  const page = pageOf(query.page), status = query.status || 'open';
  if (!['open', 'resolved'].includes(status)) throw new BadRequestException('Choose a report status');
  return db.$transaction(async (tx: any) => {
    const where = { status };
    const rows = await tx.community_reports.findMany({ where, orderBy: [{ created_at: 'asc' }, { id: 'asc' }], take: 20, skip: (page - 1) * 20,
      select: { id: true, reason: true, status: true, resolution: true, created_at: true, user_id: true,
        thread: { select: threadSelect }, reply: { select: replySelect } } });
    const total = await tx.community_reports.count({ where });
    await tx.admin_audit_log.create({ data: { actor_id: actor.id, action: 'community_reports_read', result: 'success' } });
    return { items: rows.map((r: any) => ({ ...r, thread: r.thread ? publicItem(r.thread) : null, reply: r.reply ? publicItem(r.reply) : null })), total, page, limit: 20 };
  });
}
export async function moderateCommunity(db: any, actor: Actor, id: string, action: string) {
  if (!actor.admin) throw new ForbiddenException('Admin access required');
  if (!['hide', 'dismiss'].includes(action)) throw new BadRequestException('Choose hide or dismiss');
  return db.$transaction(async (tx: any) => {
    await lockedWriter(tx, actor);
    await tx.$queryRaw`SELECT id FROM community_reports WHERE id = ${id} FOR UPDATE`;
    const row = await tx.community_reports.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Report not found');
    if (row.status === 'resolved' && row.resolution !== action) throw new ConflictException('Report was already resolved differently');
    if (row.status !== 'resolved') {
      if (action === 'hide') await tx[row.thread_id ? 'community_threads' : 'community_replies'].update({ where: { id: row.thread_id || row.reply_id }, data: { status: 'hidden' } });
      await tx.community_reports.update({ where: { id }, data: { status: 'resolved', resolution: action, reviewed_by: actor.id, reviewed_at: new Date() } });
    }
    await tx.admin_audit_log.create({ data: { actor_id: actor.id, action: `community_report_${action}`, resource_id: id, result: 'success' } });
    return { ok: true };
  });
}
