# Checklist diario de arranque

- Docker: levantar Postgres + Redis (`docker compose up -d`).
- Prisma: `yarn prisma:generate` y `yarn prisma:deploy`.
- Servicios: Provider Hub (`yarn dev:provider-hub`) y Gateway (`yarn start:dev`).
  - Flags: `FF_PROVIDER_HUB=true`, `PROVIDER_HUB_URL=http://127.0.0.1:3014` (si no se carga `.env`, exportarlas en shell).
- Mobile: `npm run dev:agent` (mock) ó `npm run dev:agent:hub` (Provider Hub real).
- Web Admin: `pnpm dev` y login.

## Notas

- Gateway: ahora carga `.env` por `import 'dotenv/config'` en `apps/gateway/src/main.ts`.
- Proxy `/providers`: actualmente reescribe a `/`. Usar Provider Hub directo para pruebas o ajustar `pathRewrite`.
