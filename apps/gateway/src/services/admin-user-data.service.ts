import { BadRequestException } from '@nestjs/common';

// Reviewed historical test accounts, 2026-10-08. Exact technical IDs only.
// This reporting registry never changes authentication, ownership or money state.
// See docs/ADMIN_TEST_DATA.md. Unknown records must not be inferred from email/name.
const testUserIds: readonly string[] = Object.freeze([
  'cmpye1agf0009of5s50pcjhgp',
  'cmpydp2xs0004of5s49fxznpx',
  'cmpydom0m0001of5snr6uxsnj',
  'cmpydmcbz0000of5sdyl8b9hd',
  'cmqffcsjz0000ko5qfq990qzt',
  'cmqff2h500003oe582g433br0',
  'cmqfeqzbk0000oe58kb0sv5lo',
  'cmn54ex9h0000ot57eyu76beb',
  'cmn513si80003m95e6grrrsen',
  'cmn51098i0000m95eg1j3prwn',
  'cmn3gkdkb0001jq4l8mjwmjva',
  'cmn3ghiyf0000jq4l9l9mf0sa',
  'cmmyc631y0001mc4fdy0obbyu',
  'cmmyc62ry0000mc4flmoxqp1n',
  'cmmwm5p340000ms57ctm0032s',
  'cmmwltk9s0000mf4dqq4qg5rx',
  'cmjbsez3y0000flrk82kg7l77',
  'cmjbsctvx0000fl6gyb9owbxi',
  'cmgmuauif0002flzk0hi54qra',
]);

export function classifyAdminUserData(id: string, ids: readonly string[] = testUserIds) {
  return ids.includes(id) ? 'test' : 'unclassified';
}

export function adminUserDataScope(query: any, ids: readonly string[] = testUserIds) {
  const scope = query.data_scope == null || query.data_scope === '' ? 'non_test' : query.data_scope;
  if (!['non_test', 'test', 'all'].includes(scope)) throw new BadRequestException('Invalid user data scope');
  return { scope, where: scope === 'all' ? {} : { id: scope === 'test' ? { in: [...ids] } : { notIn: [...ids] } } };
}

export async function readAdminUsers(prisma: any, actor: any, query: any, pagination: any, select: any, ids: readonly string[] = testUserIds) {
  const { scope, where: dataWhere } = adminUserDataScope(query, ids);
  const baseWhere: any = {};
  if (query.q) {
    const term = String(query.q).trim();
    if (term.length > 150) throw new BadRequestException('Search is too long');
    baseWhere.OR = [{ id: term }, { email: { contains: term, mode: 'insensitive' } }, { name: { contains: term, mode: 'insensitive' } }];
  }
  if (query.role) {
    if (!['traveler', 'guide', 'operator', 'admin'].includes(query.role)) throw new BadRequestException('Invalid role');
    baseWhere.role = query.role;
  }
  const where = { AND: [baseWhere, dataWhere] }, { page, limit, skip } = pagination;
  // Count and page refer to one snapshot, with classification applied before paging.
  return prisma.$transaction(async (tx: any) => {
    const total = await tx.users.count({ where });
    const excluded = scope === 'non_test' ? await tx.users.count({ where: { AND: [baseWhere, { id: { in: [...ids] } }] } }) : 0;
    const items = await tx.users.findMany({ where, select, take: limit, skip, orderBy: [{ created_at: 'desc' }, { id: 'desc' }] });
    await tx.admin_audit_log.create({ data: { actor_id: actor.id, action: 'users.list', result: 'success' } });
    return { items: items.map((row: any) => ({ ...row, data_category: classifyAdminUserData(row.id, ids) })),
      total, page, limit, data_scope: scope, excluded_test_accounts: excluded };
  }, { isolationLevel: 'RepeatableRead' });
}
