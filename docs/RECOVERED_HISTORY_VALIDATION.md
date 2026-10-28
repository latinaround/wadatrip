# Cadena recuperada: ensayo desde cero y pendientes del piloto

Fecha local: 2026-09-14. Ejecución UTC: 2026-09-15.
Base de código: `1addb1118490b3308990edb2994581c8d2837825` más los seis SQL originales recuperados, todavía sin staging/commit.

**El ensayo de las 20 migraciones desde cero pasó.** También pasaron seis comprobaciones del core sobre PostgreSQL real. No se utilizó una copia de clientes, no se consultó Stripe y no se cambiaron las DB de los ensayos históricos anteriores.

## Entorno y límites

- DB nueva: `wadatrip_p09_chain_20260915024930`, creada desde `template0`; cero tablas públicas antes del ensayo.
- PostgreSQL 17.9 en el contenedor local aislado `wadatrip-p07-rehearsal-20260914`.
- Red Docker internal, sin acceso externo; sin credenciales ni configuración de producción montadas en las herramientas.
- Prisma 6.19.1 con imagen local fijada por digest. Solo schema/migrations y luego common compilado/harness montados read-only.
- Las escrituras se limitaron a esta DB nueva. Los datos de smoke son sintéticos y los emails usan example.invalid.
- No `db push`, `migrate resolve`, modificación de checksums ni reset de DB para ocultar fallos.
- Ningún servicio desplegado fue modificado. Este resultado no valida la asociación actual Gateway/DB de Render ni constituye autorización de deployment.

## Evidencia obtenida

| Comprobación | Resultado |
|---|---|
| Primera ejecución migrate deploy | Las 20 migraciones aplicadas; exit 0 |
| Historial | 20 terminadas, cero fallidas; un registro por archivo |
| Checksums registrados | 20/20 idénticos al SHA-256 del archivo usado en el ensayo |
| migrate status | Database schema is up to date; exit 0 |
| Segunda ejecución migrate deploy | No pending migrations to apply; exit 0; sin nueva aplicación |
| Datos antes del smoke | Cero bookings, PaymentRecords, PaymentEvents y availability |
| payment-preflight.sql | Todos los indicadores en cero en la DB vacía |
| payment-postflight.sql inicial | Solo cinco constraints NOT VALID pendientes de validar; resultado esperado del DDL |
| Validación explícita de esas cinco constraints | PASS después de los datos sintéticos |
| payment-postflight.sql final | 11/11 indicadores en cero |
| Build common | PASS |
| Tests existentes de contrato de migración | 5/5 PASS |

Las cinco constraints validadas solo en la DB nueva son: PaymentRecord_booking_id_fkey, booking_participants_positive, availability_capacity_valid, booking_external_ids_nonempty y payment_external_ids_nonempty. La FK de listings.operator_id ya nace validada al recorrer el SQL original recuperado. No se validaron constraints de producción ni de las copias anteriores en este paso.

## Seis checks sobre PostgreSQL real

1. El Prisma Client existente puede leer todos los modelos sobre el schema recién creado.
2. Dos conexiones intentan reservar el último cupo. Una tercera conexión mantiene el lock de Listing; pg_stat_activity muestra al menos dos sesiones realmente bloqueadas. Al liberar, una booking se crea y la otra recibe 409. Los intentos de enviar price=1/currency=EUR/capacity=999999 no alteran los 12000 centavos USD authoritative ni el único cupo.
3. Dos preparaciones concurrentes de checkout devuelven el mismo PaymentRecord: una única intención lógica de pago para la booking.
4. Dos aplicaciones concurrentes de una observación de pago sintética con el mismo event ID terminan con una booking confirmed, ledger succeeded y un solo evento processed.
5. Un error deliberado dentro de una transacción revierte el cambio de booking y conserva su estado confirmed anterior.
6. Una booking gratuita consume el cupo sin PaymentRecord; otra booking para ese cupo es rechazada.

La DB y sus locks/transacciones son reales. El éxito financiero del check 4 es una **observación sintética aplicada al core**, no un webhook firmado recibido por HTTP ni una respuesta de Stripe. No se probó un nuevo pago externo, firma, email ni frontend E2E en esta ejecución. Los resultados previos de Stripe Test mantienen su evidencia separada.

## Reproducción y evidencia local

Los harnesses locales quedan en logs/p09-recovered-chain.ps1, logs/p09-chain-smoke.cjs y logs/p09-run-smoke.ps1. El primero genera otra DB nueva por timestamp; nunca reutiliza/reset una existente. El segundo solo acepta hostname local y nombre con prefijo de esta prueba; no abre conexiones a la copia histórica. Las imágenes necesarias ya estaban instaladas y no se descargó infraestructura nueva.

Manifest de los 20 archivos y resultados: logs/p09-chain-result.json. Salidas sanitizadas: logs/p09-chain-deploy.txt, logs/p09-chain-status.txt, logs/p09-chain-deploy-again.txt, logs/p09-chain-smoke-result.txt y logs/p09-chain-postflight-after-smoke.txt. Los archivos de logs no se proponen para commit. Esta DB usa almacenamiento temporal: el informe conserva el resultado; una futura reproducción crea otra DB desde cero.

El gate técnico «cadena original recuperada desde cero» queda **CERRADO**. La recuperación no necesita fabricar SQL ni modificar _prisma_migrations de una DB histórica.

## Ficha pendiente: caso financiero de diciembre

Estado actual: **NEEDS INVESTIGATION**, sin cambios de datos.

| Dato | Evidencia o respuesta requerida |
|---|---|
| Booking | cmjbseze30004flrkxog8t4ms |
| PaymentRecord | cmjbsf0740005flrkac3n429k |
| Session / Intent / Event | cs_test_1766083330893 / pi_test_1766083330893 / evt_test_1766083330893 |
| Fecha | 2025-12-18, aproximadamente 18:42 UTC |
| Importe | Ledger local 12000 centavos USD; booking.amount_cents NULL; cobro externo UNKNOWN |
| Hipótesis respaldada parcialmente | IDs de apariencia sintética y bug del procesador antiguo que omitía processed_at en create |
| Origen de la prueba | PENDIENTE: quién/qué proceso la generó y dónde está el script/artifact contemporáneo |
| Prueba mínima útil | Script o registro sanitizado que construya esos IDs y explique si llamó al procesador real o insertó/aplicó datos sintéticos |
| Dinero externo / cuenta / modo | UNKNOWN; el nombre test y un recuerdo de la prueba no bastan para acreditar ausencia de dinero |
| Acción permitida ahora | Recopilar evidencia; no replay, marcar processed, refund ni ajuste de wallet |
| Si la evidencia local no basta | Preparar GET limitado a cuenta Test identificada; cualquier acceso Live requiere autorización expresa. No cambiar de modo automáticamente ante 404 |

No pegar secrets, cookies, datos de tarjeta, payload raw ni datos personales en la ficha. Registrar fuente, IDs técnicos y conclusión demostrada. Una declaración del responsable es útil para localizar artifacts; no se convierte automáticamente en prueba de un cobro o de ausencia de cobro.

La otra confirmación histórica `cmg1nvaka0002fltgqm9kfcpg` sigue pendiente de revisión operativa por separado. No se ha acreditado gratuidad, pago ni cumplimiento de esa obligación y no se modificó.

## Ficha pendiente: operador piloto

Listing candidato: `cmqhk6j2h0001r95raxvxb8ih`.
Provider: `cmmclziqc000tk32iy36cqwrk`.

La DB aporta published, 120 USD, 240 minutos, owner coherente, descripción/portada y rango 2026-09-21 a 2026-10-07. Esos datos no sustituyen la confirmación operativa del operador.

| Dato de lanzamiento | Estado / respuesta requerida |
|---|---|
| Fechas concretas vendibles | PENDIENTE; no se crearon availability rows |
| Timezone IANA | PENDIENTE |
| Hora de inicio y finalización | PENDIENTE; duración almacenada no acredita horario |
| Cupos reales por fecha | PENDIENTE; confirmar cupo asignado a Wadatrip y coordinación con otros canales |
| Precio | DB: 120 USD; PENDIENTE confirmación de precio por participante, inclusiones y vigencia |
| Cutoff | PENDIENTE hora/antelación y procedimiento operativo de cierre compatible con el inventario actual |
| Cancelación | PENDIENTE condiciones de traveler/operador y texto acordado |
| Punto de encuentro | PENDIENTE instrucciones concretas |
| Contacto operativo | Hay contacto almacenado, pero PENDIENTE confirmar responsable y disponibilidad; gestionarlo por canal privado |
| Comisión | PENDIENTE acuerdo explícito; default técnico 15% no prueba acuerdo |
| Payout | PENDIENTE destinatario/ruta y readiness; no hay referencia Connect almacenada |
| Autorización comercial y responsabilidades | PENDIENTE confirmación del operador y acuerdo del piloto |

Borrador para recopilar los datos, **no enviado**:

> Para abrir las primeras reservas de tu experiencia, necesitamos confirmar las fechas y horarios reales, zona horaria, cupos disponibles para Wadatrip, precio por persona e inclusiones, antelación máxima para reservar, condiciones de cancelación y punto de encuentro. También debemos acordar comisión, cómo recibirás los pagos y quién atenderá incidencias durante el piloto. Empezaremos únicamente con las fechas y cupos que confirmes.

No se contactó a terceros. No se publicó el listing, alteró su precio, creó capacidad ni configuró payout.

## Decisión actual

- Cadena recuperada desde cero: PASS.
- Core sobre ese schema: 6/6 PASS.
- Historial original perdido: resuelto localmente; pendiente revisión/commit autorizado del cambio.
- Reparaciones financieras: ninguna ejecutada; evidencia humana/externa todavía pendiente.
- Datos operativos del piloto: todavía no confirmados.
- Siguiente paso operativo: cerrar las fichas y confirmar el target/ventana de rollout. Las escrituras antiguas deben detenerse antes de la migración y todos los escritores financieros deben pasar a la versión compatible.
- No código de aplicación nuevo, staging, commit, push, deploy, producción, Stripe ni mobile en este paso.
- Stripe Live y primera reserva real: NO-GO hasta cerrar los pendientes anteriores y verificar el release desplegado en Test.

## Handoff de release preparado, todavía sin ejecución

La configuración efectiva de Render sigue pendiente de confirmación en el dashboard. No usar DEPLOY_NOTES.md como evidencia de lo que hoy está desplegado: contiene instrucciones históricas. El servicio informado por el usuario usa runtime Node; el Dockerfile del repositorio no es prueba de la ruta de deployment actual.

| Decisión | Evidencia local / condición pendiente |
|---|---|
| Entrypoint Node del Gateway actual | apps/gateway/dist/apps/gateway/src/main.js, según package.json y tsconfig.build.json. No sustituirlo por dist/main.js del Dockerfile antiguo. |
| Build backend necesario | Prisma Client generado con schema actual, luego libs/db, libs/common y apps/gateway compilados. Confirmar comando efectivo del dashboard; no cambiarlo ni asumir que ya usa esta secuencia. |
| Migración | Paso explícito con escritores detenidos; nunca deducir que build/generate aplicó DDL. Revisar Pre-Deploy Command real antes de cualquier push/deploy. |
| Config Prisma | prisma.config.ts puede cargar .env y elegir DATABASE_URL_REMOTE/LOCAL. Usar un artifact limpio sin .env privados y confirmar el datasource efectivo en el runner autorizado. No ejecutar desde el workspace local con defaults implícitos. |
| Provider Hub | La ruta de bookings cambia con FF_PROVIDER_HUB. Confirmar flag, proxies y versión de cualquier Hub efectivo. Si el monolito usa ruta local, no iniciar servicios extra para cumplir una instrucción antigua. |
| Web | apps/web es la fuente actual. Frontend se libera después de API/schema compatibles; no cambiar Vercel todavía. No publicar el Account.jsx local excluido por accidente. |
| CORS | Código actual permite el origin público y Authorization; falta comprobar respuesta del backend desplegado. Health rápido no acredita DB ni el flujo de booking. |
| Pausados | No usar start:all, dev:all ni scripts de infraestructura para este release. No reactivar itinerarios AI, alerts, WadaAgent ni operator-leads. |

Datos pendientes del dashboard (sin pegar valores secretos): deployed commit, Root Directory, Build Command, Start Command, Pre-Deploy Command, Auto-Deploy, confirmación de que el datasource efectivo es wadatrip-db y flags que decidan si existe un Provider Hub activo. Una lista con el nombre de dos servicios no demuestra estas asociaciones.

Secuencia del rollout una vez aprobado el destino y las condiciones:

1. Revisar y autorizar el commit exacto; conservar los hashes de los seis SQL. Push/deploy requieren autorización separada.
2. Confirmar backup restaurable, target y ventana; detener todos los escritores antiguos, incluyendo cualquier Hub efectivo. Mantener webhooks temporalmente en fallo retryable si no hay handler disponible; nunca responder éxito fingido.
3. Drenar operaciones en curso y obtener preflight actualizado. No reprocesar el evento de diciembre para probar el rollout.
4. Ejecutar las dos migraciones pendientes sobre el target confirmado; revisar historial/constraints/postflight. Conservar excepciones históricas identificadas y no convertir UNKNOWN a cero.
5. Arrancar únicamente los escritores necesarios con versión compatible, sin abrir ventas todavía; probar lectura autenticada y rechazo de acceso ajeno. No ejecutar checkout contra datos históricos como smoke.
6. Validar el release desplegado en un ambiente Test separado con DB sintética y credenciales Test, incluyendo frontend/backend y manejo de estados. Esta separación no se presume existente.
7. Abrir el piloto únicamente cuando su disponibilidad, contrato, obligaciones históricas y ruta de payout estén resueltos. Stripe Live sigue siendo una decisión separada.

Si algo falla antes de reabrir tráfico financiero, mantener la ventana y diagnosticar. Después de nuevos outcomes externos, preferir corrección hacia adelante y conciliación: restaurar un snapshot antiguo puede perder pagos recientes. No reiniciar escritores antiguos como rollback automático.

## Cambio local propuesto para revisión

Commit propuesto: `fix(db): recover original prisma migration history`.

Solo estos diez archivos pertenecen al cierre actual; no se ha ejecutado git add ni git commit:

1. libs/db/prisma/migrations/20250924194741_add_auth_fields/migration.sql
2. libs/db/prisma/migrations/20250925182141_make_password_optional/migration.sql
3. libs/db/prisma/migrations/20251010021858_add_roles_operator_workflow/migration.sql
4. libs/db/prisma/migrations/20251117201251_add_ai_verification_fields/migration.sql
5. libs/db/prisma/migrations/20251126010631_provider_verification_ocr_fields/migration.sql
6. libs/db/prisma/migrations/20251218182845_init/migration.sql
7. scripts/production-forensic-readonly.sql
8. docs/PRODUCTION_REHEARSAL_RESULTS.md
9. docs/PRODUCTION_DATA_REPAIR_PLAN.md
10. docs/RECOVERED_HISTORY_VALIDATION.md

Los informes conservan evidencia histórica y distinguen los resultados posteriores. Los IDs de casos son técnicos, necesarios para investigación, no nombres/contactos ni comprobantes de cobro real. El SQL de diagnóstico solo consulta datos y no ejecuta repairs. Los seis SQL recuperados conservan su contenido original, incluso los nombres históricos relativos a verificación; no añaden un flujo documental o AI nuevo.

Fuera del commit: .yarn/install-state.gz, apps/web/src/pages/Account.jsx, package.json, logs, dist/builds, .env y cualquier otro archivo. Mobile permanece fuera. El commit documentaría y preservaría la recuperación: no constituye GO para schema en producción ni para dinero real.

## Seguimiento 2026-09-15: regresión de fixtures tras recuperar el historial

La recuperación quedó committed como `2421c80c4def7a217a7af7af9de340690f4ad116`. Después se comprobó la compatibilidad de las pruebas históricas existentes con esa cadena. Esto es una corrección del harness de integración, no una modificación del core ni de los SQL originales.

**Fallo reproducido antes de corregir:** la prueba histórica `committed SQL alias defect` falló con `column "amount_cents" of relation "bookings" already exists`. El selector de baseline copiaba todos los archivos anteriores a septiembre de 2026, ahora 18, mientras el fixture seguía intentando crear las columnas/tablas que antes faltaban en el checkout de 12 archivos. Las 18 migraciones habían aplicado; falló la preparación redundante del fixture. La DB sintética fallida se conserva y no se hizo reset/resolve.

Corrección:

- El escenario de schema parcial declara explícitamente los 12 archivos que tenía el checkout anterior. Su upgrade ejercita esos archivos más las migraciones actuales de restauración/lifecycle.
- El escenario recuperado usa los 18 originales y luego la cadena completa de 20. No crea manualmente columnas que esas migraciones ya introdujeron.
- Los escenarios usan directorios de fixtures distintos. No se eliminó ni reutilizó el directorio del ensayo fallido. La config rechaza etapas desconocidas y continúa limitada al clúster PostgreSQL local marcado para pruebas.
- El comportamiento por defecto de deploy en pruebas usa todas las migraciones actuales. La selección parcial está limitada al escenario que comprueba recuperación de schema incompleto; no es un procedimiento para producción.
- Se añadió una prueba de la ruta 18 a 20 con booking.amount_cents NULL, ledger paid de importe conocido y PaymentEvent pendiente. Compara todos los campos originales de booking/ledger, conserva el evento sin procesar y verifica ausencia de efectos en OperatorWallet.

Validación posterior sobre **PostgreSQL real 15.14**, en DB nuevas con datos sintéticos del clúster P05:

| Suite | Resultado |
|---|---:|
| postgres-history.test.mjs | 8/8 PASS |
| postgres-concurrency.test.mjs | 20/20 PASS |
| postgres-booking-http.test.mjs | 8/8 PASS |
| Total de la regresión | 36/36 PASS |

La prueba que fallaba pasó después de corregir el fixture. Las pruebas de casos inválidos conservan sus rechazos de duplicados, incompatibilidades, orphans y ocupación excesiva; no se eliminó ninguna aserción para aceptar datos peligrosos.

Los tests de concurrencia/HTTP usan la cadena completa recuperada. HTTP prueba Gateway/Provider Hub y un simulador de procesador exclusivamente en localhost; no constituye un Stripe Test E2E nuevo. Esta evidencia de PostgreSQL 15.14 es adicional al ensayo previo de 20 migraciones y seis core checks en PostgreSQL 17.9, no su sustitución.

Archivos de esta corrección: scripts/postgres-test-target.mjs, scripts/postgres-integration.prisma.config.ts, scripts/postgres-history.test.mjs y este informe. Sin cambios en aplicación, schema, migraciones, archivos protegidos o mobile; sin staging, commit, push ni deploy de esta corrección. Los datos financieros históricos y del operador siguen pendientes de evidencia externa/humana.

### Comprobación adicional del frontend committed

Se extrajo `apps/web` directamente de `git archive HEAD` en `2421c80`, dentro de una carpeta aislada e ignorada bajo `logs`. El build de Vite pasó en 5,80 segundos usando esa fuente, sin copiar archivos `.env` ni cambios del working tree. Se reutilizaron las dependencias locales instaladas mediante una junction; esto no prueba una instalación limpia de dependencias.

El artefacto de prueba usa `VITE_API_BASE_URL=http://127.0.0.1:3015` y no debe desplegarse. No se inició la aplicación ni se contactó una API o Stripe. El primer intento fue bloqueado por el sandbox al iniciar esbuild (`spawn EPERM`); el mismo build pasó con autorización para ejecutar ese subproceso. Vite avisó de un chunk superior a 500 kB, sin errores de compilación. Esta comprobación no sustituye los smoke tests del entorno desplegado ni verifica sus variables efectivas.

### Configuración de Render verificada el 2026-09-15

Este seguimiento actualiza los pendientes de acceso/configuración del handoff anterior; no cambia los resultados históricos del ensayo. Tras renovar el login oficial, se consultó la API de Render sin imprimir credenciales ni conectar a PostgreSQL o Stripe.

- Servicio confirmado: `wadatrip`, `srv-d5hgl1h4tr6s739jjkb0`, runtime Node, rama `main`, Root Directory vacío.
- Commit live: `8d1d55f65762bdf948c5bb8c6c8a897bf97900aa`, deploy terminado el 2026-08-10. `git ls-remote` confirmó el mismo hash en `main`; el release local `2421c80c4def7a217a7af7af9de340690f4ad116` contiene seis commits posteriores aún no publicados.
- DB confirmada por metadatos: `wadatrip-db`, `dpg-d38b19ogjchc73ctf8c0-a`, PostgreSQL 17, Oregon, available. El host de `DATABASE_URL` corresponde al target del ensayo. No están configuradas las alternativas LOCAL/REMOTE ni PRISMA_ENV; con la configuración inspeccionada, aplicación y Prisma seleccionan la misma URL. Esto no revalida el contenido actual de la DB.
- `FF_PROVIDER_HUB` no está activado. La presencia de una URL de Hub no prueba que exista otro proceso activo.
- Con autorización del usuario, Auto-Deploy quedó `no` / trigger `off`. Se eliminó `yarn prisma:deploy` del Build Command y se limitó la compilación a common, DB, Provider Hub y Gateway, conservando install immutable y Prisma generate. Start continúa `yarn start`; Pre-Deploy permanece vacío. Los cuatro builds locales pasaron; no se ejecutó el build nuevo en Render.
- La clave Stripe configurada tenía comillas literales alrededor de una clave Test. Para preparar el release autorizado, se retiraron exclusivamente esas comillas; se conservó la misma clave Test y el webhook secret. No se comprobó su validez contra Stripe ni que el webhook secret corresponda al endpoint efectivo.
- Se prepararon `ENABLE_WADAGENT_PROXY=false` y `ENABLE_OPERATOR_LEADS_PROXY=false`, conservando las demás variables. Son cambios para el próximo despliegue: no acreditan que el proceso actualmente live ya los use.
- Las lecturas posteriores a los cambios confirmaron la configuración esperada y no mostraron nuevos despliegues. No hubo push, consultas SQL a producción, migraciones, replay de eventos ni Stripe Live.

**Gate pendiente del release:** autorización específica de backup/preflight actual y aplicación de las dos migraciones ensayadas en producción, con una ventana que impida escrituras antiguas. La autorización de deployment no se usó para ignorar la prohibición anterior sobre modificaciones de DB. Antes de publicar los commits debe controlarse también cualquier despliegue automático del frontend asociado a Git; Auto-Deploy Off de Render no controla Vercel. El release queda pendiente de ejecutar, no reportado como completado.

### Release backend ejecutado tras autorización específica

El usuario autorizó después el backup cifrado, la ventana de mantenimiento, las dos migraciones y el despliegue condicionado a las validaciones. Este apartado reemplaza el estado pendiente del apartado anterior para el backend; no autoriza Stripe Live ni certifica el frontend.

- Release: `2421c80c4def7a217a7af7af9de340690f4ad116`, publicado mediante la etiqueta `revenue-core-20260915-2421c80`. No se actualizó `main`, que seguía en `8d1d55f65762bdf948c5bb8c6c8a897bf97900aa`; no se incluyó el working tree ni se creó un commit nuevo.
- Preflight actual en producción mediante TLS verificado y consultas READ ONLY: 18 migraciones terminadas, checksums conservados; 69 bookings, 1 PaymentRecord, 1 PaymentEvent, 0 availability, 0 bookings para hoy/futuro. Los blockers estructurales del preflight dieron cero. Se preservaron las excepciones históricas conocidas.
- Backup fresco: pg_dump 17, 71.975 bytes, SHA-256 `97a4adfb8cce0cbab9b0fdb4cf1af0cabe22c93f9286d84570ec40dadd44904d`. Cifrado Windows DPAPI fuera del repositorio con ACL privada; descifrado/restauración verificados en una DB local nueva del contenedor aislado. No se imprimieron datos personales ni credenciales.
- La copia nueva pasó la migración de 18 a 20 y conservó los valores de todas las columnas originales de las 21 tablas de negocio. Se compararon recuentos y fingerprints, sin exportar valores a los informes.
- La instalación immutable y el build de common, DB, Provider Hub y Gateway pasaron en Linux, usando el código de Git sin `.env` privados y con un datasource ficticio. No se ejecutaron migraciones durante ese build.
- Se activó mantenimiento en Render, se verificó HTTP 503 y cero operaciones cliente activas en PostgreSQL, y se comprobó que los datos aún coincidían con el backup. Después se aplicaron únicamente `20260909000000_restore_schema_history` y `20260910000000_payment_lifecycle`, usando Prisma 6.19.1 con TLS obligatorio/estricto y schema explícito del release.
- Resultado en producción: 20 migraciones terminadas, cero fallidas, los 18 checksums antiguos intactos y las dos nuevas con el checksum del artefacto usado. Los valores originales de las 21 tablas permanecieron idénticos. No se hizo resolve/reset ni reparación de datos de negocio.
- Deploy Render: `dep-dakqqkek1f9s73cjo5l0`, estado `live`, commit exacto del release; finalizado el `2026-09-15T20:43:20.89525Z`. Build sin migración; Auto-Deploy Off. Mantenimiento retirado después del arranque, con un gate que lo reactivaría si fallaban los smoke tests.

Validación HTTPS pública: **15/15 PASS**. Health 200; bookings anónimas GET/POST/detalle y token inválido 401; checkout/PaymentIntent anónimos 401; providers administrativos/me y admin detail anónimos 401; webhook sin firma y con firma falsa 401; 15 listings públicos y provider detail cumplen allowlists; preflight CORS con Origin `https://www.wadatrip.com` y Authorization devuelve 204. Se hicieron únicamente lecturas y requests que debían rechazarse: cero bookings válidas creadas, cero llamadas al procesador y ningún evento firmado/reprocesado. El acceso SSH agotó el tiempo de conexión, por lo que la evidencia es HTTPS público, no un smoke por loopback/SSH ni una inspección directa de variables del proceso remoto.

Tras los smoke tests se volvieron a comparar las 21 tablas y el postflight: datos originales intactos. Excepciones conservadas: 69 inventory_state legacy NULL, 1 evento pendiente, 1 booking confirmed/completed sin respaldo financiero suficiente y 5 constraints NOT VALID pendientes de validación explícita. No faltan índices/constraints requeridos; occupancy_above_capacity, capacity_cache_mismatch, confirmed_without_held_inventory y event_completion_state_mismatch son cero. Estas excepciones no se reclasificaron como corregidas.

Incidentes del procedimiento, sin cambios de código de negocio: el primer git archive en Windows convirtió finales de línea por core.autocrlf; se preparó el artefacto Linux con `-c core.autocrlf=false`. En él, 16 migraciones antiguas coinciden byte por byte; dos conservan el mismo SQL pero difieren de su checksum histórico por un CRLF mezclado. Se verificó la equivalencia contra los originales locales cuyo hash coincide con la DB, sin cambiar SQL ni checksums almacenados. Además, la comparación textual del postflight Windows/Linux se detuvo por CRLF/LF; una revalidación READ ONLY confirmó todos los mismos valores y permitió continuar sin repetir DDL.

**Backend desplegado y disponible; dinero real sigue NO-GO.** Quedan el release/verificación del frontend, Stripe Test E2E del entorno desplegado y asociación del webhook, validación explícita de las cinco constraints, cierre de los casos históricos y disponibilidad/condiciones/payout reales del piloto. No se modificaron Vercel, DNS, mobile ni datos históricos; Stripe permanece configurado en Test. Los archivos protegidos y la corrección local del harness siguen fuera de commits nuevos.
