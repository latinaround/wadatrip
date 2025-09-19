import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Demo user
  const user = await prisma.users.upsert({
    where: { email: 'demo@wadatrip.local' },
    update: {},
    create: { email: 'demo@wadatrip.local', name: 'Demo User' },
  });
  console.log('Seeded user:', user.email);

  // Provider hub demo data
  const pVerified = await prisma.providers.upsert({
    where: { email: 'verified.guide@wadatrip.local' },
    update: {},
    create: {
      type: 'guide',
      name: 'Verified Guide',
      email: 'verified.guide@wadatrip.local',
      base_city: 'Cusco',
      country_code: 'PE',
      languages: ['es', 'en'],
      status: 'verified',
    },
  });

  const pPending = await prisma.providers.upsert({
    where: { email: 'pending.operator@wadatrip.local' },
    update: {},
    create: {
      type: 'operator',
      name: 'Pending Operator',
      email: 'pending.operator@wadatrip.local',
      base_city: 'Arequipa',
      country_code: 'PE',
      languages: ['es'],
      status: 'pending',
    },
  });

  const currency = process.env.DEFAULT_CURRENCY || 'USD';

  // Listings for verified only (⚡ corregido: price_from como string en vez de number)
  await prisma.listings.createMany({
    data: [
      {
        provider_id: pVerified.id,
        title: 'Sacred Valley Full-Day Tour',
        category: 'tour',
        city: 'Cusco',
        country_code: 'PE',
        duration_minutes: 480,
        price_from: "89.00",   // ✅ string → Prisma lo guarda como Decimal
        currency,
        tags: ['culture', 'history'],
        status: 'published',
      },
      {
        provider_id: pVerified.id,
        title: 'Rainbow Mountain Trek',
        category: 'activity',
        city: 'Cusco',
        country_code: 'PE',
        duration_minutes: 600,
        price_from: "75.00",   // ✅ string
        currency,
        tags: ['hike'],
        status: 'published',
      },
      {
        provider_id: pVerified.id,
        title: 'Airport Transfer',
        category: 'transfer',
        city: 'Cusco',
        country_code: 'PE',
        duration_minutes: 60,
        price_from: "25.00",   // ✅ string
        currency,
        tags: ['transfer'],
        status: 'draft',
      },
    ],
  });

  console.log('Seeded providers/listings: ', {
    verified: pVerified.email,
    pending: pPending.email,
  });
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
