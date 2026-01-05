import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const SALT_ROUNDS = Number(process.env.AUTH_SALT_ROUNDS || 12);

async function hashPassword(password: string) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function main() {
  const defaultPassword = process.env.SEED_USER_PASSWORD || 'wadatrip123';

  const [adminPassword, operatorPassword, travelerPassword] = await Promise.all([
    hashPassword(defaultPassword),
    hashPassword(defaultPassword),
    hashPassword(defaultPassword),
  ]);

  const admin = await prisma.users.upsert({
    where: { email: 'admin@wadatrip.local' },
    update: {
      password_hash: adminPassword,
      role: 'admin',
      status: 'active',
      last_login_at: new Date(),
    },
    create: {
      email: 'admin@wadatrip.local',
      name: 'Wadatrip Admin',
      password_hash: adminPassword,
      role: 'admin',
      status: 'active',
    },
  });

  const operator = await prisma.users.upsert({
    where: { email: 'operator@wadatrip.local' },
    update: {
      password_hash: operatorPassword,
      role: 'operator',
      status: 'active',
    },
    create: {
      email: 'operator@wadatrip.local',
      name: 'Demo Operator',
      password_hash: operatorPassword,
      role: 'operator',
      status: 'active',
    },
  });

  const traveler = await prisma.users.upsert({
    where: { email: 'traveler@wadatrip.local' },
    update: {
      password_hash: travelerPassword,
      status: 'active',
    },
    create: {
      email: 'traveler@wadatrip.local',
      name: 'Demo Traveler',
      password_hash: travelerPassword,
      status: 'active',
    },
  });

  console.log('✔ Seeded users', {
    admin: admin.email,
    operator: operator.email,
    traveler: traveler.email,
  });

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

  await prisma.listings.createMany({
    data: [
      {
        provider_id: pVerified.id,
        operator_id: operator.id,
        title: 'Sacred Valley Full-Day Tour',
        category: 'tour',
        city: 'Cusco',
        country_code: 'PE',
        duration_minutes: 480,
        price_from: '89.00',
        currency,
        tags: ['culture', 'history'],
        status: 'approved',
      },
      {
        provider_id: pVerified.id,
        operator_id: operator.id,
        title: 'Rainbow Mountain Trek',
        category: 'activity',
        city: 'Cusco',
        country_code: 'PE',
        duration_minutes: 600,
        price_from: '75.00',
        currency,
        tags: ['hike'],
        status: 'approved',
      },
      {
        provider_id: pVerified.id,
        operator_id: operator.id,
        title: 'Airport Transfer',
        category: 'transfer',
        city: 'Cusco',
        country_code: 'PE',
        duration_minutes: 60,
        price_from: '25.00',
        currency,
        tags: ['transfer'],
        status: 'pending',
      },
    ] as Prisma.listingsCreateManyInput[],
  });

  console.log('✔ Seeded providers/listings', {
    verified: pVerified.email,
    pending: pPending.email,
  });
}

main()
  .catch((e) => {
    console.error('✖ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
