# Wadatrip Platform - Updated Overview (Oct 2025)

## Structure
- **apps/web** -> React + Vite + Tailwind + Shadcn UI (Frontend principal)
- **apps/gateway** -> NestJS API Gateway
- **services/provider-hub** -> Registro y gestion de operadores (con Prisma)
- **libs/db** -> Prisma schema y conexion centralizada
- **uploads/operators** -> Carpeta temporal para documentos

## Core Flows

### 1. Registro de Operadores
- Ruta publica: `/operator/register`
- Tipos: Guide | Agency | Partner
- Campos: name, email, phone, base_city, country_code, languages, social links, documento (PDF/imagen)
- Endpoint: `POST ${getApiBase()}/providers/register`
- Estado inicial: `pending`
- Verificacion posterior: panel admin o IA

### 2. Panel de Administracion
- Ruta protegida: `/admin/providers`
- Autenticacion: Firebase Auth + whitelist (`VITE_FB_*`)
- Funciones: listar, aprobar/rechazar operadores, verificacion IA
- Columnas destacadas: tipo, estado, badge de verificacion

### 3. Creacion de Tours
- Ruta: `/operator/tours/new`
- Requiere operador verificado
- Endpoint: `POST /listings`
- Campos: titulo, descripcion, precio, pais, idioma, duracion, tipo, imagenes
- Estado inicial: `pending` (publicable tras aprobacion)

### 4. Listado Publico de Tours
- Ruta: `/tours`
- Endpoint: `/listings/search?status=published`
- Filtros: tipo de operador, pais
- Banner final: CTA "Unete como operador" -> `/operator/register`

## Variables Importantes (.env)
```
VITE_API_BASE_URL=http://localhost:3015
VITE_STRIPE_PUBLIC_KEY=...
VITE_APP_NAME=Wadatrip
VITE_FB_API_KEY=...
VITE_FB_AUTH_DOMAIN=...
VITE_FB_PROJECT_ID=...
VITE_ADMIN_WHITELIST=kiara@wadatrip.com
```

## Dev Commands
- yarn workspace @wadatrip/web dev -> levantar frontend
- yarn workspace @wadatrip/web build -> compilar
- yarn workspace @wadatrip/service-gateway dev -> API Gateway
- yarn workspace @wadatrip/service-provider-hub dev -> Provider Hub

## Notes
- Prisma controla la BD y validaciones de proveedores/tours.
- Firebase gestiona login del panel admin.
- HRM/IA verification pendiente de integracion futura.
- Los avisos de JSX (>) se resolvieron utilizando {'->'}.
- Flujo completo probado: registro -> aprobacion -> creacion de tour -> publicacion publica.
