# Operator Beta — segundo bloque de seguridad

Estado inicial: 26 de octubre de 2026. Implementación y validación locales. No hay staging, commit, push, despliegue, migración de producción, invitación real, envío de correo real ni operación de Stripe. Mobile no se modificó. Los controles de beta y Android descritos después en `OPERATOR_BETA_CONTROLS_AND_ANDROID.md` amplían y reemplazan las decisiones de acceso/publicación de esta nota; consultar también su estado más reciente.

## Resultado

Se implementaron límites persistentes para request-code, cierre de acceso público a operator-leads, MFA obligatorio para privilegios administrativos y cierre por defecto de documentos de identidad. Se revisaron los flujos de invitación y fotos. La beta desplegada sigue **NO-GO** hasta la revisión de release, ensayo autorizado de migración, verificación de almacenamiento/invitaciones y aceptación operativa. Este resultado no equivale a una auditoría completa ni a imposibilidad de vulneración.

### Límites de códigos

- Antes de buscar al usuario, crear un código o enviar correo, se reserva presupuesto en PostgreSQL.
- Límites predeterminados: un envío por dirección cada 60 segundos, 6 por dirección/hora, 30 por peer/hora, 300 globales/hora y 2.000 globales/día. Los overrides enteros están acotados y no admiten cero como bypass.
- Hora del servidor PostgreSQL y cinco buckets HMAC, sin correo o IP crudos en la tabla. La rotación del secreto reinicia el espacio de buckets; un AUTH_RATE_LIMIT_SECRET independiente evita acoplarlo a rotación de JWT.
- INSERT ON CONFLICT condicional bloquea las filas de presupuesto. Orden consistente por clave dentro de una transacción corta Read Committed; rechazo revierte todas sus escrituras. No hay llamada externa dentro de la transacción.
- DB/configuración incierta produce 503 y no correo. Límite produce 429 con indicación conservadora de espera. Un fallo posterior de envío conserva el presupuesto: no se supone que el procesador de correo no haya recibido la petición.
- Se usan req.ip/socket conforme a Express; no se leen directamente Forwarded/X-Forwarded-For del cliente. **Antes de desplegar, verificar el peer/proxy real de Render**: sin trust-proxy explícito, varios usuarios detrás del mismo proxy comparten el presupuesto por peer. No habilitar confianza indiscriminada en cabeceras para evitarlo.
- Se purgan hasta 100 buckets expirados por solicitud aceptada. Si no hay tráfico, pueden quedar filas expiradas pendientes de limpieza; expires_at no promete borrado físico inmediato.
- El endpoint deja de informar si el correo ya existía y no devuelve el nombre introducido. No se declara ausencia absoluta de canales laterales de enumeración.
- Todo envío de correo tiene deadline de red de 10 s; los errores del proveedor no imprimen su texto arbitrario.

### Leads, administración y transporte

- Se retira attachProxy('/operator-leads'). Un controller Nest del Gateway exige identidad administrativa y prueba MFA vigente.
- El módulo real de operator-leads registra un guard global: token interno más identidad administrativa más MFA. El token interno por sí solo no autoriza lectura de contactos. Health queda público, sin datos comerciales.
- ADMIN_REQUIRE_MFA ya no permite quitar el segundo factor. requireAdminIdentity se reserva para elegibilidad/enrollment; requireActor sin prueba no concede scope administrativo, aunque la cuenta conserve acceso a sus propios recursos.
- ENABLE_OPERATOR_LEADS debe ser exactamente true para usar el módulo; ENABLE_OPERATOR_LEAD_SEARCH es una habilitación adicional para búsquedas externas. Ambos permanecen sin modificar en entornos desplegados.
- Se reenvía solo la autenticación explícita del servicio, Bearer y prueba. Se prohíben redirects, proxy HTTP ambiental y orígenes de servicio con credenciales/path/query/fragment; hay deadline y límites de respuesta. Los errores externos se convierten en respuestas seguras sin volcar Axios/headers.
- Las respuestas de leads usan no-store. CSV neutraliza fórmulas y encierra saltos de línea; la exportación se limita a 500 registros. Las consultas de adquisición tienen límites de cantidad/tamaño.
- CORS permite los dominios canónicos y una allowlist HTTPS explícita WEB_ALLOWED_ORIGINS; ningún tenant arbitrario de Vercel queda autorizado. En desarrollo se admiten orígenes loopback HTTP. CORS no es autorización.
- HTTP limita keep-alive a 5 s, recepción de headers a 15 s y recepción de request a 30 s. Estos ajustes de Node no imponen un deadline de respuesta a un pago que ya se procesa.

### Archivos e invitaciones: revisión y restricciones

ProviderUploadGuard rechaza documentos antes de Multer salvo ENABLE_OPERATOR_DOCUMENT_UPLOADS=true, además de exigir los permisos originales. **Mantenerlo apagado** hasta aprobar almacenamiento privado, validación del contenido, retención/borrado y verificación. El verificador existente devuelve pending; no constituye KYC automático ni prueba documental validada. No se habilitaron Redis ni servicios nuevos de identidad.

mediaUpload.js envía fotos a Firebase con comprobaciones de tipo/tamaño en el navegador y ownerId de cliente. No hay reglas de Storage verificadas en el repositorio. Esto no prueba que el bucket sea público, pero tampoco permite acreditar aislamiento de uploads por cuenta. No se leyó ni cambió la configuración cloud. Antes de beta: verificar reglas reales y el vínculo de identidad, o deshabilitar uploads y usar portadas revisadas. No pedir documentos/bancos por ese flujo.

Actualmente no hay un ciclo persistente de invitaciones ligado a correo con expiración, revocación y consumo atómico. El código legado de acceso no es autorización y no sustituye cuenta/ownership. Perfil pending fuerza borrador para un usuario normal no aprobado; aprobar al provider permite publicación y no es equivalente a habilitar un corredor financiero. Falta separar esas capacidades para una beta privada estricta y una publicación pública sin cobro.

## Validación y límites de evidencia

| Verificación | Resultado |
|---|---:|
| Regresión del núcleo, seguridad, administración, Community y contratos anteriores | 384 |
| Nuevos límites de código | 9 |
| Frontera MFA/internal | 8 |
| Leads: HTTP con módulo real, JWT/MFA y transporte loopback | 16 |
| Guard de documentos | 3 |
| Frontera de correo | 2 |
| Orígenes/timeouts | 4 |
| Total de pruebas locales sintéticas | **426** |
| PostgreSQL real desechable: migraciones, concurrencia y fallos | **12** |
| Total distinto del bloque | **438** |

El cambio de política MFA requirió actualizar las identidades administrativas de dos fixtures para enviar una prueba real firmada y vinculada a la sesión. Se mantiene la expectativa de acceso autorizado y se añade la negativa sin MFA; no se deshabilitó seguridad para pasar la regresión.

Límites: 7/8 controles iniciales fallaron antes de corregir el límite; después se reprodujo/cerró enumeración de cuentas. MFA: 5/8 controles fallaron con el código anterior. Upload gate: 2/3. Correo: 2/2. Orígenes/timeouts: 3/4. Los contadores son assertions, no vulnerabilidades independientes.

El primer harness de leads carecía del Reflect.metadata de Nest y produjo errores de DI. Se corrigió y se repitió contra la fuente histórica inalterada del candidato anterior: los diez controles originales fallaron (incluido acceso anónimo y token interno sin MFA); con el módulo actual pasan. Se conservan ambos diagnósticos, sin atribuir el error de harness al producto.

PostgreSQL aplicó la cadena completa a una DB nueva con marcador, rol y localhost validados, dos Prisma pools independientes y cero datos reales. Doce intentos concurrentes del mismo correo: uno permitido, once 429. También se probaron persistencia, rollback completo, presupuestos por peer/global, reloj DB, constraints, limpieza acotada y terminación de su propia conexión de prueba. Ninguna booking, PaymentRecord o availability fue creada.

Preflight/postflight son SELECT de solo lectura y se ejecutaron en esa DB **después** de migrar. No se declara un ensayo sobre copia actual de producción ni preflight previo sobre esa copia. Los valores después de migrar fueron: cuatro constraints, dos índices, cero filas inválidas y cero migraciones sin terminar.

Prisma validate/generate pasan con configuración explícita sin dotenv y URL sintética no conectable. Compilan common, DB, Gateway, Provider Hub y operator-leads mediante TypeScript local. La web no cambia en este bloque; no se declara un build iOS, una prueba UI nueva o un Stripe E2E nuevo. Diff check final pasa.

Evidencia ignorada: logs/security-beta-20261026/. Las DB de pruebas se conservan; la instancia desechable se devuelve a su estado inicial al terminar. Los cambios anteriores y los tres archivos protegidos se comparan por hash.

## Migración y rollout que requieren autorización posterior

1. Integrar solo este alcance sobre el release correcto. El checkout principal sigue teniendo trabajo anterior ajeno; no desplegarlo indiscriminadamente. El candidato de cuatro archivos web del bloque anterior no incorpora este backend.
2. Backup restaurable y copia autorizada. Ejecutar auth-rate-limit-preflight.sql: antes de aplicar, esperar cero tabla/registro de esta migración y cero migraciones pendientes/fallidas sin resolver. Si hay discrepancias, investigar; no resolve automático.
3. Aplicar explícitamente 20261026000000_auth_request_limits antes del handler nuevo. La tabla es aditiva y no cambia históricos. No se añadieron hooks de migración a build, generate o startup. Un backend nuevo sin la tabla rechaza request-code con 503, no funciona sin protección.
4. Publicar common y servicios compatibles; verificar MFA de la administradora real. Leads/search y documentos permanecen apagados hasta aprobación propia. Configurar un secreto de rate limit estable, presupuestos y proxy/orígenes verificados; nunca pegarlos en chat/logs.
5. Postflight, pruebas de aceptación y monitoreo. Rollback de aplicación puede conservar la tabla; no borrarla ni reescribir datos financieros. Volver al código antiguo también elimina estas protecciones y no es un rollback de seguridad neutro.

## Gate y mínimo siguiente

**OPERATOR BETA READY: NO. REAL MONEY READY: NO.**

Para abrir cinco operadores: release revisado/ensayado y autorizado; prueba real de login/MFA/cuotas y proxy; allowlist backend manual, limitada y revisada, con publicación separada; uploads de fotos deshabilitados hasta verificar las reglas cloud o probar que el flujo antiguo ya no es accesible; condiciones de beta, responsable de soporte y revisión humana documentada. El bloque posterior implementa el modo preparación/publicación y apaga uploads en el nuevo cliente web; no acredita las reglas desplegadas ni invalida bundles/URLs anteriores. No se requiere un sistema duradero de tokens de invitación para el primer grupo pequeño: la allowlist de IDs puede servir si se habilita solo después de que cada persona cree su cuenta y se verifique por el proceso manual. Cuenta verificada por correo no significa identidad legal/comercial acreditada.

Para dinero real se añaden corredor aprobado para cuenta/beneficiario, costos y comisión aceptados, oferta cumplible, finalización de servicio y liquidación/conciliación verificadas. No se implementó Global Payouts ni se aprobó Stripe Live. Quedan aparte revocación/sesiones web, protección completa de contraseña, revisión de runtime/dependencias y auditoría independiente; no vender una garantía de invulnerabilidad.

## Lista exacta de archivos de este bloque

1. apps/gateway/src/app.module.ts
2. apps/gateway/src/controllers/auth.controller.ts
3. apps/gateway/src/controllers/operator-leads.controller.ts (nuevo)
4. apps/gateway/src/main.ts
5. apps/gateway/src/services/auth-rate-limit.service.ts (nuevo)
6. apps/gateway/src/services/email.service.ts
7. apps/gateway/src/services/request-security.ts (nuevo)
8. libs/common/src/security.ts
9. libs/db/prisma/schema.prisma
10. libs/db/prisma/migrations/20261026000000_auth_request_limits/migration.sql (nuevo)
11. services/operator-leads/src/dto/search-operator-leads.dto.ts
12. services/operator-leads/src/main.ts
13. services/operator-leads/src/module.ts
14. services/operator-leads/src/security.guard.ts (nuevo)
15. services/operator-leads/src/services/operator-leads.service.ts
16. services/provider-hub/src/security.guard.ts
17. scripts/admin-boundary.test.cjs (nuevo)
18. scripts/auth-rate-limit.test.cjs (nuevo)
19. scripts/auth-rate-limit.postgres.test.mjs (nuevo)
20. scripts/auth-rate-limit-preflight.sql (nuevo)
21. scripts/auth-rate-limit-postflight.sql (nuevo)
22. scripts/email-boundary.test.cjs (nuevo)
23. scripts/operator-leads-security.test.cjs (nuevo)
24. scripts/operator-upload-security.test.cjs (nuevo)
25. scripts/request-security.test.cjs (nuevo)
26. scripts/security-p0.test.cjs (se preserva el trabajo previo y se amplía el fixture MFA)
27. scripts/tour-date-requests.test.cjs
28. docs/OPERATOR_BETA_SECURITY_SECOND_BLOCK.md (nuevo)

## Revalidación local — 27 de octubre de 2026

Se ejecutó `scripts/operator-booking-inbox.postgres.test.cjs` contra un
contenedor PostgreSQL 17 efímero, aislado por red, puerto de loopback y tmpfs.
Resultado: **7/7** controles pasan: compatibilidad con relaciones/estados
históricos, migración aditiva, dos conexiones revisando concurrentemente la
misma reserva, aislamiento por propietario, claves foráneas, rollback y clave
única/índice. El harness terminó correctamente y limpió su contenedor y red.
Esto valida ese bloque con PostgreSQL real desechable; no es una prueba de
migración en una copia de producción ni valida checkout/pagos.

También se intentó repetir `scripts/auth-rate-limit.postgres.test.mjs`. El
harness se detuvo antes de crear una DB o aplicar migraciones porque su target
P05 configurado apunta a un contenedor existente en estado `exited`, sin puerto
publicado. No se arrancó ni modificó ese contenedor. La evidencia anterior de
12 controles PostgreSQL del límite de autenticación permanece documentada, pero
esta repetición no la reproduce independientemente.

Regresión local repetida: **39 scripts sintéticos no UI, 529 assertions pasan**;
**15 scripts UI, 200 checks pasan** contra el build temporal, Chrome local y APIs
interceptadas; **9 builds TypeScript**, build web con API sintética, Prisma
validate/generate y `git diff --check` pasan. La suite separada de identidad de
payout no está incluida: da 6/14, con 8 fallos de capacidades ausentes descritos
en `INTERNATIONAL_PAYOUT_REVIEW.md`. Estas son pruebas locales; no certifican el
runtime desplegado.

La verificación externa de runtime sigue pendiente: la consulta read-only de
variables de Render respondió `Unauthorized`, sin mostrar credenciales ni
cambiar configuración. No se pudo verificar la configuración desplegada. Al
correr localmente también faltaron cuatro condiciones en
`node scripts/operator-beta-preflight.cjs`: `OPERATOR_BETA_PREPARATION_ONLY`
no está explícito, `PAYMENTS_LIVE_ENABLED` no está explícito como deshabilitado,
y no existen en este shell los secretos estables de rate limit e interno. Este
resultado es del entorno local, no del servicio desplegado; no se deben copiar
secretos al repositorio ni al chat. El repositorio no contiene
`firebase.json`, `storage.rules` o `firestore.rules` versionados
en este repositorio; por tanto, la seguridad real del bucket no queda acreditada.
No había navegador autenticado visible, ni Firebase CLI/gcloud instalados en esta
sesión para consultar las reglas cloud de forma read-only.
El bloque posterior deshabilita uploads en el nuevo cliente web, pero no acredita
las reglas desplegadas ni invalida bundles/URLs anteriores. Para el primer grupo,
el diseño aprobado usa una allowlist manual limitada, no tokens persistentes de
invitación; se habilita cada ID solo tras el alta y revisión manual. No se enviaron
invitaciones.

**Estado tras revalidación: beta de operadores = NO-GO; dinero real = NO-GO.**
No hubo cambios en Render, Firebase, Stripe, dLocal, PostgreSQL externo, ni
invitaciones enviadas.

### Seguimiento: limpieza y repetición de PostgreSQL

La autorización posterior para ordenar y probar permitió iniciar temporalmente
el contenedor P05 local, tras verificar label, ausencia de mounts y puerto solo
en loopback. Cada suite creó bases sintéticas nuevas; ninguna base existente fue
borrada ni reutilizada. El contenedor volvió al estado inicial `exited` al final
de cada ejecución.

Las ocho suites completas ahora pasan: auth-rate-limit 12, Community 13,
administración 8, solicitudes de fecha 9, modo de pago 2, históricos 8,
concurrencia 20 y booking HTTP 9: **81 controles PostgreSQL reales**.
Esto reemplaza el bloqueo anterior por contenedor apagado; no es un ensayo de
migración sobre copia actual autorizada de producción.

Se conservaron los logs originales con fallos. Históricos esperaba una cifra de
migraciones antigua; ahora exige los nombres exactos de todas las migraciones del
repositorio, conservando la prueba de baseline original y los snapshots de dinero.
El fixture HTTP omitía nombre persistido, cuenta de payout simulada y modo Test;
se actualizaron sus datos sin cambiar el producto ni sus constraints. Se añadió
la negativa de nombre ausente en DB aun cuando el cliente suministra uno. La
primera repetición rechazó además un ID sintético de cuenta con formato inválido;
se corrigió el fixture manteniendo el constraint. El simulador de Stripe solo
escucha en loopback y las solicitudes externas siguen rechazadas por el harness.

Antes de ordenar se guardaron 127 archivos con cambios efectivos y sus SHA-256
en `logs/cleanup-1816d8b2-1fe1-4d11-b36b-2eb31e0eb940/`. Los archivos package
marcados solo por fines de línea no tienen diff de contenido. `.yarn/install-state.gz`
y `Account.jsx` conservan exactamente los hashes del snapshot. Se ignoran los
`*.tsbuildinfo` generados. El árbol conserva todo el trabajo previo, sin staging,
commit, push ni despliegue; todavía debe consolidarse por alcance para release.

La lectura cloud pendiente y la identidad/corredor de payout siguen bloqueando
la beta externa y dinero real según corresponda. La próxima mejora comercial
documentada es recomendar un tour real desde una conversación y llevarlo al
checkout existente; no se implementó en este cierre.
