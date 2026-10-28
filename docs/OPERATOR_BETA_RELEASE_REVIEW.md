# Revisión de apertura de beta de operadores — 28/10/2026

## Estado de los cuatro pasos autorizados

| Paso | Evidencia actual | Decisión |
|---|---|---|
| Release consolidado | Fuente/hashes verificados; instalación/builds Node 24 Windows y Linux, nueve builds backend, Prisma, build web y regresiones críticas | Preparado para revisión; sin desplegar |
| Render: acceso/runtime/login/MFA/cuotas | Consola accesible; API 401; Environment contraído/valores ocultos | Lectura parcial; aceptación pendiente |
| Firebase: Community antigua | Pausa publicada por la dueña, cuerpo verificado tras recargar y 12/12 pruebas de emulador | Ruta antigua pausada; Storage efectivo aún por acreditar |
| Operación de cinco invitados | Procedimiento, aviso, revisor, soporte y aceptación preparados | Documento listo; admisión aún cerrada |

Estado local tras la autorización de Node: `package.json` declara
`>=24.22.1 <25`, sin otros cambios de contenido. Candidato Node 24 validado en
`source-node24-linux-final/`, con `manifest-node24-linux-final-v2.json`:
1.446 archivos, 114 overlays contra el commit publicado c30b2df. Node 24.22.1 /
Yarn 3.6.4 instalaron inmutablemente en copia Linux; Prisma validate/generate,
nueve builds backend y build web pasaron. Los 22 tests del guard y las suites
críticas/PostgreSQL indicadas abajo también pasan en la validación Windows
aislada. Las copias y manifiestos anteriores se conservan como historial. Render
no se modificó: todavía ejecuta 20.11.1; siguen pendientes migración sobre copia
actual, flags/secretos, aceptación MFA/runtime y configuración efectiva Storage.

Actualización posterior del 28/10: se renovó la sesión oficial de Render CLI;
GET de servicio y lectura de DB con TLS estricto pasaron. Snapshot reciente
cifrado y restauración aislada verificados; el ensayo 27 → 29 migraciones pasó
en 2,46 segundos, conservando las 27 tablas originales y todos los registros
históricos. Ver `OPERATOR_BETA_MIGRATION_REHEARSAL.md`. Vercel confirma el proyecto
público Firebase `wadatrip-nuevo`, sin override de bucket de Storage; el candidato
cierra las cargas por código. Aún faltan el rollout y la aceptación de runtime/MFA.

Actualización de lectura en consola: la sesión de Edge permitió acceder a Render
y Firebase, aunque la credencial API sigue dando 401. Render muestra desplegado
`c30b2dfa04e48f5e964358bcf20df155b617232f`, el commit de avisos persistentes.
Su Build Command genera Prisma y compila Common/DB/Hub/Gateway sin migrate deploy;
Pre-Deploy aparece vacío y Start Command es `yarn start`. Auto-deploy, variables,
versión Node efectiva y aceptación de seguridad aún no están acreditados.

La misma fuente de 1.444 archivos también se verificó contra ese commit publicado:
`manifest-live-base.json` y `changes-live-base.json` declaran 111 diferencias,
todas dentro del alcance original de 121 paths. Se conservan ambos manifiestos;
no se cambió la fuente ni se desplegó desde una base antigua a ciegas.

Firebase ya tiene evidencia visual documentada en `FIREBASE_READONLY_REVIEW.md`:
la dueña publicó la pausa de acceso cliente a las colecciones Community antiguas
después de validación local. El cuerpo activo persistió tras recargar, sin cambios
pendientes. No se leyeron/escribieron documentos reales. Storage del proyecto
muestra Get started, sin reglas de bucket observables; faltan overrides de otros
clientes/proyectos. Esta publicación específica fue autorizada; el release de
aplicación sigue sin desplegarse.

La dueña amplió Environment: se observaron 49 filas, comparando nombres exactos
(sin confundir ENABLE_OPERATOR_LEADS con su alias legado _PROXY). El resultado y
la configuración propuesta se registran en `RENDER_BETA_CONFIGURATION.md`. Los
valores permanecen ocultos; faltan verificar los flags de pagos, fuentes
heredadas, secretos y el preflight del runtime. No se guardaron cambios cloud.

### Runtime: hallazgo de soporte

El `package.json` raíz ahora declara Node >=24.22.1 <25; la web declara 24.x. La fuente
oficial https://nodejs.org/en/about/previous-releases y la página
https://nodejs.org/en/about/eol listan Node 20 como EOL y Node 24 como LTS en esta
revisión. Validar el release sobre Node 20 no resolvería su falta de soporte.
La lectura selectiva posterior confirmó NODE_VERSION `20.11.1`, Live `false` y
accept-new `true`. No se cambió el entorno ni package.json. Node 24.22.1 ya pasó
la validación aislada de nueve builds, web, Prisma, 209 assertions críticas y 41
controles PostgreSQL. `NODE24_RELEASE_VALIDATION.md` detalla la evidencia y el
cambio de un solo campo ya autorizado y aplicado, con excepción del guard acotada.
La compatibilidad de compilación Linux ya se verificó en contenedor local; la
versión efectiva y startup/health de Render siguen pendientes.

## Candidato de fuente

Base exacta: `50a290b492db383193e372e701be2f39264f4d9e`.
Artefacto local ignorado:
`logs/operator-beta-release-f1515d6f7d3b4d79a0eec3b08170306f/`.

- `source/`: 1.444 archivos de fuente exportados desde Git y overlays declarados.
- `changes.json`: lista exacta de 121 archivos de este candidato integrado.
- `manifest.json`: hashes SHA-256 y verificación contra los blobs de la base.
- `excluded-preserved.json`: nueve entradas locales excluidas y preservadas.
- `review-status.json`: `deployable=false`, con los gates externos pendientes.

Este bloque integra seguridad, controles de beta, inbox, descubrimiento, sesiones
y Community (a mantener deshabilitada hasta aceptación propia). Sus archivos
comparten imports/schema; no desplegar una selección parcial improvisada.

Account.jsx se incluye explícitamente por su integración con los avisos de
operador; su archivo local se preservó. El guard de release anterior era de un
alcance previo; ahora exige inclusión explícita y hash para Account como para
cualquier archivo de aplicación. Sus 15 tests pasan, incluida negativa de cambio
posterior. `package.json` y los install-state siguen protegidos. Los package files
sin diff de contenido se conservan desde la base. Se excluyen las notas mobile y
la especificación preparatoria `payout-identity.test.cjs`, cuyos ocho fallos siguen
documentados y bloquean Live; no se declara esa capacidad implementada.

El manifiesto detecta algunos patrones de credenciales y entradas privadas,
symlinks, archivos extras/faltantes y modificaciones no declaradas. No representa
una auditoría exhaustiva de dependencias ni una aprobación de seguridad bancaria.
Los archivos .env, node_modules, logs, dumps y credenciales no forman parte de la
fuente. No se stageó, commiteó, pusheó ni desplegó este candidato.

## Validación disponible y límites

En el checkout de origen de los overlays: 529 assertions en 39 scripts sintéticos,
200 checks en 15 scripts UI y build web con env sintético; Prisma validate/generate
sin dotenv; nueve builds TypeScript. PostgreSQL local real: 81 controles en ocho
suites y siete controles del inbox en su contenedor independiente.

La copia de fuente pasó creación y verificación completa del manifiesto. En una
copia `build/` separada se instalaron dependencias sin red ni scripts de instalación:
web con lockfile y caché inmutables; backend con lockfile inmutable y paquetes
adicionales de la caché local verificados por Yarn. El primer intento backend falló
por caché incompleta de la exportación y se conserva en `backend-install.log`;
el siguiente pasó con la caché local, sin descargas ni cambios de lockfile.

En esa instalación aislada pasan Prisma validate/generate con configuración sin
dotenv y datasource no conectable, nueve builds TypeScript, build web con API
sintética/lectura de dotenv deshabilitada y 12 suites críticas (209 assertions).
Incluyen pagos, inventario, precio, identidad viajero, límites, MFA, beta, leads,
uploads y manifiesto. La fuente original volvió a pasar todos sus hashes después.
Los logs están junto al manifiesto; los builds sintéticos no son bundles para
publicar. Runtime de estas comprobaciones: Node 24.11.1. El backend declara Node
20; validar su runtime objetivo sigue pendiente antes de deploy. La web declara
Node 24. No se interpreta compilación exitosa como compatibilidad garantizada de
runtime ni como prueba contra producción.

## Secuencia de publicación pendiente

1. Recuperar acceso y leer versión/topología/auto-deploy/build/predeploy de Render
   y Vercel. Confirmar que build, generate y startup no aplican migraciones.
   No escribir flags ni rotar secretos antes de documentar el estado actual.
2. Revisar los 121 paths, validar instalación/build independiente del candidato y
   comparar versiones de Gateway/Common/Provider Hub. Si el Hub está activo, no
   admitir operadores mientras existan escritores con controles antiguos.
3. Backup restaurable y ensayo de las migraciones nuevas en copia actual
   autorizada, con preflight/postflight. Los ensayos sintéticos no cierran ese gate.
4. Aplicar explícitamente la migración aditiva de auth-rate-limit antes del handler
   nuevo; también las tablas del inbox/Community según el alcance integrado.
   Confirmar historial y compatibilidad; no migrate resolve automático ni reescribir
   históricos. Reversión de aplicación conserva tablas y datos; código antiguo
   pierde controles de seguridad y requiere mantener admisión cerrada.
5. Publicar servicios coordinados y web con cohort/publication vacíos. Verificar
   `OPERATOR_BETA_PREPARATION_ONLY=true`, `PAYMENTS_LIVE_ENABLED=false`, documentos,
   leads y Community cerrados, secretos estables y orígenes/proxy revisados.
   Mantener webhooks, conciliación y recuperación de históricos disponibles.
6. Ejecutar `operator-beta-preflight.cjs` en cada runtime. Smoke de login/logout,
   recarga, MFA de administradora real, cuotas controladas, aislamiento entre dos
   cuentas y negativas de publicación/pagos. No someter producción a carga abusiva.
7. Inspeccionar Firebase y cerrar la ruta antigua según reglas efectivas revisadas.
   No sobrescribir reglas del proyecto ni su identidad por una plantilla genérica.
   Verificar escrituras anónimas/cruzadas rechazadas y compatibilidad de lecturas.
8. Cumplir `OPERATOR_BETA_OPERATIONS.md`, revisar la primera cuenta, registrar su
   aceptación manual e incorporarla solo a preparación. Máximo cinco; cero
   publicación automática y cero promesas de cobro/payout.

Despliegue y apertura siguen NO-GO hasta acreditar estos puntos. El acceso
actualmente rechazado requiere sesión/credencial renovada por la dueña, sin
compartir secretos por chat. DLocal sigue pendiente y Live permanece fuera de
esta apertura de beta.
