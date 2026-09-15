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
