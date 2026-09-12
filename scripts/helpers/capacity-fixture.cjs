// Synthetic availability for the pre-existing auth/pricing suites. This is not a concurrency simulation.
exports.addCapacityFixture = function(prisma) {
  const recorded = [];
  const payments = new Map();
  const originalCreate = prisma.bookings.create;
  prisma.bookings.create = async args => {
    const row = await originalCreate(args);
    payments.delete(row.id);
    recorded.push(row);
    return row;
  };
  if (!prisma.bookings.findMany) prisma.bookings.findMany = async () => recorded;
  prisma.paymentRecord = {
    findMany: async () => [...payments.values()],
    findUnique: async ({ where }) => where.booking_id ? payments.get(where.booking_id) || null : [...payments.values()].find(p => p.id === where.id) || null,
    create: async ({ data }) => { const p = { created_at: new Date(), ...data }; payments.set(p.booking_id, p); return p; },
    update: async ({ where, data }) => { const p = [...payments.values()].find(p => p.id === where.id); Object.assign(p, data); return p; },
  };
  const slot = id => ({ id: `synthetic-slot-${id}`, date: new Date('2026-12-01'), spots_total: 100, spots_available: 100 });
  prisma.listing_availability = {
    findMany: async ({ where }) => [slot(where.listing_id)],
    update: async ({ data }) => data,
  };
  prisma.bookings.aggregate = async ({ where }) => {
    const rows = prisma.bookings.findMany ? await prisma.bookings.findMany({ where: { listing_id: where.listing_id } }) : recorded;
    return { _sum: { num_people: rows.filter(b => b.listing_id === where.listing_id
      && +new Date(b.date) >= +where.date.gte && +new Date(b.date) < +where.date.lt
      && (b.inventory_state === 'held' || (b.inventory_state == null && !['cancelled', 'rejected'].includes(b.status))) && b.id !== where.id?.not)
      .reduce((sum, b) => sum + b.num_people, 0) } };
  };
  prisma.$queryRaw = async (sql, ...values) => {
    if (sql.join('').includes('FROM listing_availability')) {
      const row = slot(values[0]);
      return row.date >= values[1] && row.date < values[2] ? [row] : [];
    }
    const listing = await prisma.listings.findUnique({ where: { id: values[0] } });
    return listing ? [{ id: listing.id }] : [];
  };
  prisma.$transaction = async fn => fn(prisma);
};
