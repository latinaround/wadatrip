import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const SALT_ROUNDS = Number(process.env.AUTH_SALT_ROUNDS || 12);

type DestinationCoverSeed = {
  slug: string;
  city: string;
  country_code?: string | null;
  title?: string;
  eyebrow?: string;
  image_url: string;
  active?: boolean;
};

const DESTINATION_COVERS: DestinationCoverSeed[] = [
  {
    slug: 'lima-pe',
    city: 'Lima',
    country_code: 'PE',
    title: 'Lima city experiences',
    eyebrow: 'Top food and culture',
    image_url: 'https://images.unsplash.com/photo-1531968455001-5c5272a41129?auto=format&fit=crop&w=1400&q=80',
  },
  {
    slug: 'cusco-pe',
    city: 'Cusco',
    country_code: 'PE',
    title: 'Cusco day tours',
    eyebrow: 'History and mountain views',
    image_url: 'https://images.unsplash.com/photo-1526392060635-9d6019884377?auto=format&fit=crop&w=1400&q=80',
  },
  {
    slug: 'machu-picchu-pe',
    city: 'Machu Picchu',
    country_code: 'PE',
    title: 'Machu Picchu experiences',
    eyebrow: 'Iconic Peru',
    image_url: 'https://images.unsplash.com/photo-1587595431973-160d0d94add1?auto=format&fit=crop&w=1400&q=80',
  },
  {
    slug: 'cancun-mx',
    city: 'Cancun',
    country_code: 'MX',
    title: 'Cancun beach and cenote tours',
    eyebrow: 'Sun, water and weekend escapes',
    image_url: 'https://images.unsplash.com/photo-1510097467424-192d713fd8b2?auto=format&fit=crop&w=1400&q=80',
  },
  {
    slug: 'mexico-city-mx',
    city: 'Mexico City',
    country_code: 'MX',
    title: 'Mexico City experiences',
    eyebrow: 'Food, art and neighborhoods',
    image_url: 'https://images.unsplash.com/photo-1585464231875-d9ef1f5ad396?auto=format&fit=crop&w=1400&q=80',
  },
  {
    slug: 'barcelona-es',
    city: 'Barcelona',
    country_code: 'ES',
    title: 'Barcelona day plans',
    eyebrow: 'Architecture and coast',
    image_url: 'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=1400&q=80',
  },
  {
    slug: 'madrid-es',
    city: 'Madrid',
    country_code: 'ES',
    title: 'Madrid city tours',
    eyebrow: 'Museums and tapas',
    image_url: 'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=1400&q=80',
  },
  {
    slug: 'rome-it',
    city: 'Rome',
    country_code: 'IT',
    title: 'Rome highlights',
    eyebrow: 'History and street life',
    image_url: 'https://images.unsplash.com/photo-1525874684015-58379d421a52?auto=format&fit=crop&w=1400&q=80',
  },
  {
    slug: 'paris-fr',
    city: 'Paris',
    country_code: 'FR',
    title: 'Paris experiences',
    eyebrow: 'Classic city moments',
    image_url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1400&q=80',
  },
  {
    slug: 'tokyo-jp',
    city: 'Tokyo',
    country_code: 'JP',
    title: 'Tokyo city experiences',
    eyebrow: 'Neighborhoods and night energy',
    image_url: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=1400&q=80',
  },
];

async function hashPassword(password: string) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function seedDestinationCovers() {
  await Promise.all(
    DESTINATION_COVERS.map((cover) =>
      prisma.destination_covers.upsert({
        where: { slug: cover.slug },
        update: {
          city: cover.city,
          country_code: cover.country_code ?? null,
          title: cover.title ?? null,
          eyebrow: cover.eyebrow ?? null,
          image_url: cover.image_url,
          active: cover.active ?? true,
        },
        create: {
          slug: cover.slug,
          city: cover.city,
          country_code: cover.country_code ?? null,
          title: cover.title ?? null,
          eyebrow: cover.eyebrow ?? null,
          image_url: cover.image_url,
          active: cover.active ?? true,
        },
      }),
    ),
  );

  console.log('✔ Seeded destination covers', { count: DESTINATION_COVERS.length });
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

  await seedDestinationCovers();

  const pVerified = await prisma.providers.upsert({
    where: { email: 'verified.guide@wadatrip.local' },
    update: {
      photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
      bio_short: 'Local tour guide focused on history, food and easy-to-book day tours.',
      verified_level: 'community',
    },
    create: {
      type: 'guide',
      name: 'Verified Guide',
      email: 'verified.guide@wadatrip.local',
      base_city: 'Cusco',
      country_code: 'PE',
      languages: ['es', 'en'],
      status: 'verified',
      photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
      bio_short: 'Local tour guide focused on history, food and easy-to-book day tours.',
      verified_level: 'community',
    },
  });

  const pPending = await prisma.providers.upsert({
    where: { email: 'pending.operator@wadatrip.local' },
    update: {
      photo_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80',
      bio_short: 'Small tour operator preparing new city experiences for WadaTrip.',
      verified_level: 'community',
    },
    create: {
      type: 'operator',
      name: 'Pending Operator',
      email: 'pending.operator@wadatrip.local',
      base_city: 'Arequipa',
      country_code: 'PE',
      languages: ['es'],
      status: 'pending',
      photo_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80',
      bio_short: 'Small tour operator preparing new city experiences for WadaTrip.',
      verified_level: 'community',
    },
  });

  const currency = process.env.DEFAULT_CURRENCY || 'USD';
  const cuscoCover = DESTINATION_COVERS.find((item) => item.slug === 'cusco-pe')?.image_url || null;

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
        cover_image_url: cuscoCover,
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
        cover_image_url: cuscoCover,
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
        cover_image_url: cuscoCover,
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
