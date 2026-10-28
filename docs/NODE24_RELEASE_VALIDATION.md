# Runtime soportado: preparación de cambio

Render Environment fue ampliado por la dueña. Se leyeron únicamente estos valores
no sensibles: NODE_VERSION `20.11.1`, PAYMENTS_LIVE_ENABLED `false` y
PAYMENTS_ACCEPT_NEW `true`. No se leyeron otras credenciales ni se guardó el entorno.
Live está cerrado por su gate; esto no acredita modo Stripe ni corredor de payout.

Node 20 está EOL según https://nodejs.org/en/about/previous-releases y
https://nodejs.org/en/about/eol. El package raíz exige >=20.11.1 <21; la web ya
declara 24.x. Se preparó una modificación de solo `engines.node` a
`>=24.22.1 <25` en `docs/release-proposals/node24-engine.patch`. La dueña autorizó
explícitamente aplicarla después de revisar la validación. Se cambió únicamente
ese campo del archivo original, conservando sus fines de línea. Los objetos de
dependencias/scripts y hashes de lockfiles, web package y common package se
compararon y permanecen iguales. La copia previa y sus hashes están bajo
`logs/runtime-node24.22.1/package-change-verification.json`.

El guard del manifiesto admite ahora solo esta transición declarada: revertir el
valor nuevo al anterior debe recuperar el blob Git inmutable del package raíz.
No permite cambios adicionales de dependencias, scripts o packageManager. Se
confirmaron dos fallos esperados con el guard anterior y luego 22/22 tests pasan,
incluidas negativas de cambios ajenos y alteración posterior a la revisión.

## Validación aislada efectuada

Se descargó el ZIP oficial de Node 24.22.1 para Windows x64 bajo logs y se comparó
su SHA-256 con SHASUMS256.txt del mismo sitio oficial por HTTPS:
`d2046d28c2c3dcd211ac5145c0bf30e2047ef9dfb306693c8c6e2eccd8b95fa5`.
No se verificó la firma por una segunda raíz de confianza. No se instaló en el
sistema ni se sustituyó el Node del equipo o de Render.

En la copia de build previamente instalada/aislada del candidato, usando el
ejecutable 24.22.1 explícito:

- Prisma validate/generate con configuración sin dotenv y datasource no conectable.
- Nueve builds TypeScript: Common, DB, Pricing, Itineraries, Provider Hub, Alerts,
  WadaAgent, Operator Leads y Gateway.
- Doce suites críticas, 209 assertions: pagos, cupos, precios, identidad, MFA,
  límites, beta, leads, uploads y control de manifiesto.
- PostgreSQL desechable real, tres suites, 41 controles: rate limiting 12,
  concurrencia 20 y booking HTTP 9. Solo bases nuevas sintéticas; el contenedor
  fue verificado y volvió a `exited` al terminar. El procesador de los tests HTTP
  es un simulador loopback; no constituye Stripe Test E2E.
- Build web con API sintética y envDir deshabilitado. El aviso de chunk grande
  existente permanece; ese bundle no es para producción.
- Fuente original verificada después contra c30b2df: 1.444 archivos y 111 overlays,
  sin diferencias fuera del manifiesto.

### Revalidación Linux/Render-like — 28/10/2026

Para quitar el bloqueo de sistema operativo, se usó la imagen oficial
`node:24.22.1-bookworm-slim` (digest
`sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205`)
con red deshabilitada durante los builds. El contenedor recibió una copia
desechable del candidato, nunca el árbol fuente revisado.

- Yarn 3.6.4 instaló el monorepo con `--immutable --mode=skip-build`; el lockfile
  quedó intacto. La web se instaló separadamente desde `apps/web/yarn.lock` con
  la misma condición inmutable. Las descargas faltantes provinieron de los
  registries públicos. Scripts de instalación de terceros se mantuvieron
  deshabilitados.
- Prisma validate y generate pasaron en Node 24 Linux usando solo una URL de DB
  sintética/no conectable. Prisma avisó que la imagen slim no detectaba OpenSSL
  y eligió su compatibilidad `openssl-1.1.x`; descargó su schema engine oficial.
  Para el runtime de Render debe confirmarse la misma detección o instalar OpenSSL.
- Pasaron los nueve builds TypeScript backend: Common, DB, Pricing, Itineraries,
  Provider Hub, Alerts, WadaAgent, Operator Leads y Gateway.
- Pasó el build web en Node 24 Linux con una URL API `.invalid` y una clave Stripe
  sintética; sin credenciales ni conexión de producto. Persiste el aviso de chunk
  principal superior a 500 KB.
- Un intento offline inicial no pudo completar Yarn porque la caché preexistente
  estaba incompleta. El segundo intento, con acceso a registries públicos y scripts
  deshabilitados, pasó. El primer build web apuntó al workspace backend y fue
  rechazado por Yarn; el segundo usó el lockfile web correcto y pasó. Estos errores
  de procedimiento no modificaron la fuente revisada.

Esto valida la instalación inmutable y compilación Linux del candidato en un
contenedor local. No es un deploy preview ni acredita el entorno exacto de Render,
la migración sobre la copia productiva actual, la configuración efectiva de
variables, MFA, startup/health checks o pagos Live.

Logs y resultados bajo
`logs/operator-beta-release-f1515d6f7d3b4d79a0eec3b08170306f/node24.22.1-*`;
verificación de descarga bajo `logs/runtime-node24.22.1/`.

## Pendiente antes de aplicar/desplegar

1. Autorización, cambio de package y regeneración completados. Nuevo candidato
   `source-node24-linux-final/`, manifiesto `manifest-node24-linux-final-v2.json`, base
   publicada c30b2df: 1.445 archivos y 113 cambios declarados. Se conservan los
   candidatos anteriores. Hash previo del archivo de trabajo:
   `be210ada28a5bc8c2b453cda8d8b31cd68a432c62d814cda1aa79aadf3fe0c79`.
2. Linux Node 24.22.1 está validado localmente en contenedor. Aún falta confirmar
   el runtime/configuración efectiva en Render y hacer smoke de startup/health sin
   habilitar ventas.
3. Ensayo de migraciones en copia actual autorizada y gates de beta/MFA/runtime.
4. Coordinar NODE_VERSION `24.22.1` con código compatible y corte de nuevos cobros;
   guardar variables puede disparar deploy. No cambiar producción de forma aislada.

El package original ya declara el runtime nuevo por autorización de la dueña.
Render conserva Node 20.11.1 hasta un rollout coordinado; no se modificó cloud.
Cobros reales, invitaciones, commit/push y despliegue no se realizaron.

Comprobación final con el package nuevo en la copia aislada: Yarn 3.6.4 y Node
24.22.1, instalación `--immutable --mode=skip-build` sin red ni scripts, lockfile
idéntico y contrato semver satisfecho. Los 22 tests del guard pasan en ese mismo
runtime. La excepción de package sigue acotada al campo aprobado; el resto debe
reconstruir exactamente el blob Git original al revertirlo (salvo CRLF existentes).
