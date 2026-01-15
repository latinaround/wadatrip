# Wadatrip Platform - Overview (08 Jan 2026)

## Repositorios
- **wadatrip-platform** -> Backend monorepo (gateway + microservicios + libs)
- **wadatrip-web** -> Frontend standalone (Vite). Es el frontend activo.

## Estructura (wadatrip-platform)
- **apps/gateway** -> NestJS API Gateway (solo proxy/orquestacion)
- **services/itineraries** -> Itinerarios + persistencia
- **services/pricing** -> ADRED pricing/predict
- **services/provider-hub** -> Operadores, bookings, listings
- **services/alerts** -> Alertas
- **services/wadagent** -> WadaAgent MVP (Mistral, iframe)
- **libs/common** -> DTOs compartidos
- **libs/db** -> Prisma schema

## Frontend activo
- **Repositorio:** `wadatrip-web`
- **Notas:** `apps/web` dentro del monorepo es legado y no se usa para deploy.

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

## Notas
- Gateway NO contiene logica de negocio, solo proxy.
- DTOs se importan desde `@wadatrip/common/dtos`.
- WadaAgent se incrusta en el Hero via iframe desde `wadatrip-web`.
