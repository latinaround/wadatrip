# Wadatrip Platform - Overview (03 Jun 2026)

## Repositorios
- **wadatrip-platform** -> Repositorio canonico de produccion para backend + web (`apps/web`)
- **wadatrip-web** -> Frontend standalone historico. Ya no es la fuente activa de deploy.

## Estructura (wadatrip-platform)
- **apps/web** -> Frontend web publico activo (Vite + React)
- **apps/gateway** -> NestJS API Gateway (solo proxy/orquestacion)
- **services/itineraries** -> Itinerarios + persistencia
- **services/pricing** -> ADRED pricing/predict
- **services/provider-hub** -> Operadores, bookings, listings
- **services/alerts** -> Alertas
- **services/wadagent** -> WadaAgent MVP (Mistral, iframe)
- **libs/common** -> DTOs compartidos
- **libs/db** -> Prisma schema

## Frontend activo
- **Repositorio:** `wadatrip-platform`
- **Path:** `apps/web`
- **Deploy actual:** produccion web sale desde este monorepo
- **Notas:** `wadatrip-web` queda como referencia/legacy hasta archivarlo o congelarlo formalmente.

## Servicios Render (backend)
- `wadatrip-gateway`
- `wadatrip-itineraries`
- `wadatrip-pricing`
- `wadatrip-provider-hub`
- `wadatrip-alerts`
- `wadatrip-wadagent`

## WadaAgent MVP
- Servicio: `services/wadagent`
- Endpoints:
  - `GET /wadagent` (UI iframe)
  - `POST /wadagent/chat` (JSON estructurado)
  - `GET /wadagent/health`
- Env vars:
  - `MISTRAL_API_KEY`
  - `MISTRAL_MODEL=mistral-small-latest`
  - `PRICING_SERVICE_URL`
  - `WADAGENT_PORT=3022`

## Comandos utiles (backend)
- `yarn workspace @wadatrip/service-gateway build`
- `yarn workspace @wadatrip/service-wadagent build`
- `yarn workspace @wadatrip/service-wadagent start`

## Prisma / Base de datos
- Desarrollo estable en Windows: usa `PRISMA_ENV=local` con `DATABASE_URL_LOCAL` y levanta infra con `yarn infra:up`
- Datos reales bajo demanda: usa `PRISMA_ENV=remote` con `DATABASE_URL_REMOTE`
- Comandos utiles:
  - `yarn prisma:generate:local`
  - `yarn prisma:migrate:local`
  - `yarn prisma:generate:remote`
  - `yarn prisma:deploy:remote`
- Regla operativa: local para desarrollar y depurar; remote solo cuando necesites validar contra datos reales o aplicar cambios reales.

## Notas
- Gateway NO contiene logica de negocio, solo proxy.
- DTOs se importan desde `@wadatrip/common/dtos`.
- La respuesta operativa a "de donde sale la web live" es `wadatrip-platform/apps/web`.
- WadaAgent en web debe considerarse parte del frontend del monorepo mientras siga desplegando produccion.
