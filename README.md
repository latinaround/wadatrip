WadaTrip Platform (Backend)

Servicios y scripts para el backend (NestJS) y dependencias locales.

Requisitos

- Docker + Docker Compose
- Node.js LTS + Corepack (yarn habilitado)

Levantar dependencias (DB/Redis)

- cd wadatrip-platform
- docker compose up -d

Preparar y levantar backend

- Instalar deps: yarn
- Generar Prisma: yarn prisma:generate
- Migraciones (dev): yarn prisma:migrate
- (Opcional) Seed: yarn seed
- Levantar todos los servicios: yarn start:dev
  - Gateway: http://localhost:3000 (docs en /docs, health en /health)
  - Itineraries: :3011, Pricing: :3012, Alerts: :3013

Variables útiles (por defecto):

- GATEWAY_PORT=3000
- ITINERARIES_PORT=3011
- PRICING_PORT=3012
- ALERTS_URL=http://localhost:3013

App móvil (Live)

- cd wadatrip-mobile
- npm run dev:agent
  - Usa adb reverse y conecta a http://localhost:3000 automáticamente

Web

- cd wadatrip-web
- pnpm dev (o npm run dev)

Solución de problemas

- Network request failed/timeout en móvil:
  - Verifica que Gateway esté en :3000 y que docker compose tenga postgres/redis UP (healthy)
  - En Home ver “API: http://localhost:3000” y modo LIVE
- My Alerts: http://localhost:3000/alerts responde

Provider Hub quickstart

- Objetivo: Operadores se registran, el admin verifica y publican tours; la app móvil los consulta.
- Arranque:
  - Terminal A: `yarn dev:provider-hub` (puerto 3014)
  - Terminal B: exportar FF y URL, luego `yarn start:dev`
    - PowerShell: `$env:FF_PROVIDER_HUB='true'; $env:PROVIDER_HUB_URL='http://127.0.0.1:3014'`
- Endpoints vía Gateway (3000):
  - `POST /providers` — crea operador `{ type,name,email,base_city,country_code,... }`
  - `POST /providers/:id/verify` — `{ status: 'verified' | 'rejected' }`
  - `POST /listings` — crea tour `{ provider_id,title,description?,category,city,country_code,price_from?,currency?,startDate?,endDate?,tags?,status? }`
  - `GET /listings/search?city=...&limit=10&startDate=...&endDate=...` — buscar tours
- App móvil (emulador): `npm run dev:agent:hub` apunta a `http://localhost:3000` y activa `EXPO_PUBLIC_FF_PROVIDER_HUB=true`.

Deployment

- Copia .env.example a .env y define STRIPE_SECRET_KEY y STRIPE_PUBLISHABLE_KEY localmente (nunca lo subas al repo).
- En Render/Heroku/Railway agrega esas variables de entorno en la configuracion del servicio antes de desplegar.

