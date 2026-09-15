# Historial y datos de producción: investigación y plan de reparación

Fecha: 2026-09-14. Código de referencia: `1addb1118490b3308990edb2994581c8d2837825`.

Actualización posterior: el ensayo de los 20 archivos desde cero ya pasó en una DB nueva exclusivamente sintética, junto con seis checks del core y la validación de constraints. Véase [RECOVERED_HISTORY_VALIDATION.md](RECOVERED_HISTORY_VALIDATION.md). Los casos financieros y los datos operativos de este informe permanecen sin modificar.

**Resultado: recuperadas las seis migraciones originales con checksum exacto. Ninguna reparación financiera ejecutada.**

Este informe usa exclusivamente Git local y la copia previamente autorizada, restaurada en PostgreSQL 17.9. No se consultó producción ni Stripe en esta investigación. Las lecturas SQL usaron una transacción REPEATABLE READ READ ONLY, UTC y timeouts. Prisma se ejecutó únicamente con `migrate status` sobre las dos copias locales, con conexión configurada como read-only. No se ejecutó `migrate resolve`, ninguna migración, ningún webhook ni ningún UPDATE de datos.

La asociación actual entre el servicio Gateway de Render y la DB copiada sigue sin revalidarse mediante dashboard/API: el ensayo anterior documentó que la credencial local de Render devolvía 401. Las conclusiones describen el snapshot, no una inspección actualizada de producción. Tampoco se debe confundir este registro histórico de USD 120 de diciembre de 2025 con el Stripe Test E2E real de septiembre de 2026, realizado sobre datos sintéticos aislados.

## 1. Recuperación de migraciones

Se inspeccionaron las referencias locales `main`, `origin/main`, `origin/HEAD`, reflogs, historial de borrados, SQL legacy y objetos no alcanzables de Git. No hay tags locales. Se recorrieron 231 commits alcanzables, 20 versiones de SQL alcanzables y 461 blobs no alcanzables. Las seis coincidencias son SHA-256 de los bytes originales, sin normalización necesaria.

Los originales estaban en snapshots antiguos de Codex que permanecen en el almacén de objetos Git aunque las ramas actuales no los referencien. Se recuperaron solamente los seis `migration.sql`, no snapshots enteros, builds, configuraciones ni credenciales antiguas.

**MIGRATION: 20250924194741_add_auth_fields**
- DB CHECKSUM: `891099df3336e6a551cfac0b7d787b0598308ec0e9c05c86119578b51c1954f3`
- ORIGINAL FILE FOUND: YES
- SOURCE: commit `42c09d817801a33fb0a4bab857fb7d087b409f10`, blob `ec49f67f35d89ac6c80c8f7fa7dcd3a20db02f9f`, ruta original `libs/db/prisma/migrations/20250924194741_add_auth_fields/migration.sql`.
- CONTENT MATCHES DB STRUCTURE: YES (efectos compatibles, considerando migraciones posteriores).
- SAFE TO RESTORE TO REPO: YES. Recuperado; sin staging ni aplicación de SQL.

**MIGRATION: 20250925182141_make_password_optional**
- DB CHECKSUM: `fe00ca90ba27bba26f5e15a40c146a916373eaa15a42cee74b7c9d8d46856d73`
- ORIGINAL FILE FOUND: YES
- SOURCE: commit `42c09d817801a33fb0a4bab857fb7d087b409f10`, blob `8463a0652663f1272a6f78a5bce94fb819e062b8`, ruta original `libs/db/prisma/migrations/20250925182141_make_password_optional/migration.sql`.
- CONTENT MATCHES DB STRUCTURE: YES (efectos compatibles, considerando migraciones posteriores).
- SAFE TO RESTORE TO REPO: YES. Recuperado; sin staging ni aplicación de SQL.

**MIGRATION: 20251010021858_add_roles_operator_workflow**
- DB CHECKSUM: `5636d0b413d56a0840e3d3bda281e37d043406cafd33b2d95c06c7de0ba6d3b5`
- ORIGINAL FILE FOUND: YES
- SOURCE: commit `42c09d817801a33fb0a4bab857fb7d087b409f10`, blob `11cbbbceae5bd5fbc20930f14dbc310ae13c91ea`, ruta original `libs/db/prisma/migrations/20251010021858_add_roles_operator_workflow/migration.sql`.
- CONTENT MATCHES DB STRUCTURE: YES (efectos compatibles, considerando migraciones posteriores).
- SAFE TO RESTORE TO REPO: YES. Recuperado; sin staging ni aplicación de SQL.

**MIGRATION: 20251117201251_add_ai_verification_fields**
- DB CHECKSUM: `872f7ae680329b80fd215c1fc5936e581f5104501ebbcc6b10d393d62ac3cd99`
- ORIGINAL FILE FOUND: YES
- SOURCE: commit `42c09d817801a33fb0a4bab857fb7d087b409f10`, blob `b1a8a4fd423a9e06b7b50553dedf8a5be086afff`, ruta original `libs/db/prisma/migrations/20251117201251_add_ai_verification_fields/migration.sql`.
- CONTENT MATCHES DB STRUCTURE: YES (efectos compatibles, considerando migraciones posteriores).
- SAFE TO RESTORE TO REPO: YES. Recuperado; sin staging ni aplicación de SQL.

**MIGRATION: 20251126010631_provider_verification_ocr_fields**
- DB CHECKSUM: `3ca7d6f436919f06436080c8e7d32dd9a9d388bf4805f30b68c9dd367e0a33d6`
- ORIGINAL FILE FOUND: YES
- SOURCE: commit `6c82283ef7f5d87cdf7e1ec3c5ce809520ec0610`, blob `f234c245b7a4e2361c21bef985bf74f4e13ac641`, ruta original `libs/db/prisma/migrations/20251126010631_provider_verification_ocr_fields/migration.sql`.
- CONTENT MATCHES DB STRUCTURE: YES (efectos compatibles, considerando migraciones posteriores).
- SAFE TO RESTORE TO REPO: YES. Recuperado; sin staging ni aplicación de SQL.

**MIGRATION: 20251218182845_init**
- DB CHECKSUM: `122d743a0403e77ad7e0ed9447f5b8826f2fbdbc55612d936eff004dd13c2eec`
- ORIGINAL FILE FOUND: YES
- SOURCE: commit `9c84bc30b818ed4e1992dc5f313e3acd563ae384`, blob `af5102c8ba20cc6051c01d3ca06b2e7f8d7e14d9`, ruta original `libs/db/prisma/migrations/20251218182845_init/migration.sql`.
- CONTENT MATCHES DB STRUCTURE: YES (efectos compatibles, considerando migraciones posteriores).
- SAFE TO RESTORE TO REPO: YES. Recuperado; sin staging ni aplicación de SQL.

Para las seis: `applied_steps_count=1`, `rolled_back_at=NULL`, `logs=NULL`. No hay logs de error guardados en esas filas. Los timestamps de abajo son los originales en UTC, conservando precisión.

| Migration | started_at UTC | finished_at UTC | Logs |
|---|---|---|---|
| 20250924194741_add_auth_fields | 2025-09-24T19:47:41.381938+00:00 | 2025-09-24T19:47:41.605092+00:00 | NULL |
| 20250925182141_make_password_optional | 2025-09-25T18:21:41.370296+00:00 | 2025-09-25T18:21:41.599395+00:00 | NULL |
| 20251010021858_add_roles_operator_workflow | 2025-10-10T02:18:58.706573+00:00 | 2025-10-10T02:18:58.91978+00:00 | NULL |
| 20251117201251_add_ai_verification_fields | 2025-11-17T20:12:51.423377+00:00 | 2025-11-17T20:12:51.764845+00:00 | NULL |
| 20251126010631_provider_verification_ocr_fields | 2025-11-26T01:06:31.834541+00:00 | 2025-11-26T01:06:32.104135+00:00 | NULL |
| 20251218182845_init | 2025-12-18T18:29:40.197199+00:00 | 2025-12-18T18:29:40.410831+00:00 | NULL |

Correspondencia de efectos con el catálogo de la copia:

| Migración | Efectos originales y evidencia actual |
|---|---|
| add_auth_fields | Agrega users.last_login_at y password_hash; el password inicialmente era NOT NULL. Ambas columnas existen; su nulabilidad actual se explica por la migración siguiente. |
| make_password_optional | Quita NOT NULL de users.password_hash. El catálogo confirma que hoy es nullable. |
| add_roles_operator_workflow | Agrega users.role/status con defaults traveler/active, listings.operator_id, default pending para listings.status, índices idx_listings_status/idx_listings_operator y FK al usuario con SET NULL/CASCADE. Catálogo compatible. |
| add_ai_verification_fields | Agrega cinco columnas de verificación de providers: detected_name, document_valid, risk_level, verification_score, verification_status. Tipos/defaults/nulabilidad coinciden. Recuperar DDL histórico no reactiva AI. |
| provider_verification_ocr_fields | Agrega seis campos financieros a bookings; cuatro campos de verificación a providers; crea PaymentEvent, PaymentRecord, OperatorWallet, sus PK y UNIQUE para booking_id/operatorId. Estructuras presentes; las columnas monetarias del ledger son NOT NULL en el baseline. No se incorporó funcionalidad documental nueva. |
| init de diciembre | Original de 30 bytes: únicamente un comentario de migración vacía. No crea objetos. Se recuperó su contenido exacto; no se inventó un placeholder. |

El archivo suelto `libs/db/prisma/migrations/add_itinerary_pricing_fields.sql` contiene declaraciones equivalentes de buena parte del schema, pero es un script de creación completa, no el lineage original. `baseline.sql` también es un comentario vacío, pero no sustituye la evidencia del blob/checksum original. Ninguno se ejecutó.

Verificación posterior a la recuperación:

- Copia original, 18 migraciones aplicadas: Prisma reconoce 20 archivos y muestra únicamente `20260909000000_restore_schema_history` y `20260910000000_payment_lifecycle` pendientes. Exit 1 por pendientes; desapareció la divergencia por archivos ausentes.
- Copia del ensayo anterior, 20 aplicadas: `Database schema is up to date!`, exit 0.
- Las seis migraciones restauradas son seguras para conservar en el repo. No se deben volver a ejecutar manualmente en una DB que ya las registra.
- El ensayo posterior desde una DB vacía con los 20 archivos recuperados pasó; su evidencia está separada en RECOVERED_HISTORY_VALIDATION.md. La prueba inicial cubrió 14 archivos y la ruta incremental sobre la copia real aplicó las dos migraciones nuevas en el ensayo anterior; no mezclar las tres ejecuciones.
- No hay contenido irrecuperable en este caso. Si faltara alguno, el procedimiento sería buscar backups del repositorio/artifacts de release y comparar bytes; si eso falla, diseñar explícitamente un baseline/cutover auditado y conservar el historial anterior. Nunca reemplazar archivos por SQL parecido, inventar checksums ni declarar resolved una historia desconocida.

## 2. Triage de los 54 importes desconocidos

`54` significa `Booking.amount_cents IS NULL`. No significa 54 cargos ni 54 reservas gratuitas. De esas 54, 53 no tienen PaymentRecord y una tiene un ledger legacy que afirma 12000 centavos. Ese dato local todavía no acredita un cobro externo ni un precio contractual válido.

Todas las fechas de esas bookings ya pasaron. Cincuenta tienen un viajero y cuatro tienen dos. Cincuenta no tienen siquiera total_price; las cuatro restantes guardan 120, 120, 1 y 1. Ninguna tiene availability para su día. Ninguno de sus listings tiene hoy el tag free_tour; esto no demuestra qué se ofreció históricamente.

| Grupo excluyente | Cantidad | Clasificación | Acción |
|---|---:|---|---|
| pending/unpaid, sin ledger ni referencias; total_price NULL | 48 | NEEDS INVESTIGATION; sin evidencia local de cargo | NO CHANGE. No completar importes ni cancelar en masa. |
| pending/unpaid, sin ledger ni referencias; total_price=1 | 2 | NEEDS INVESTIGATION / DATA QUALITY ISSUE | El listing vale hoy 89, pero no hay snapshot de precio ni evidencia de cobro. Conservar ambos datos sin inferir ni corregir. |
| pending/pending, total_price=120, sin ledger ni referencias | 1 | NEEDS INVESTIGATION | El estado pending no demuestra un flow externo. Revisar el intento original; no convertirlo a failed por antigüedad. |
| confirmed/paid, con ledger y referencias externas no verificadas | 1 | FINANCIAL RISK | Caso F1, verificar origen/modo y dinero antes de cualquier reparación/replay. |
| confirmed/unpaid, sin ledger, importe ni referencias | 1 | FINANCIAL RISK + CUSTOMER OBLIGATION RISK | Caso F2, verificar promesa al cliente/operador y cumplimiento histórico. No inventar un pago. |
| cancelled/unpaid, sin ledger ni referencias | 1 | NO ACTION REQUIRED; SAFE para conservar | No resucitar ni repricing. Unknown permanece NULL. No consume inventario según el fallback legacy. |

La cuenta de riesgo financiero priorizado es **2 bookings distintas: F1 y F2**. No es una cuenta de cargos reales demostrados. El core trata conservadoramente los importes NULL como riesgo potencial; eso no convierte automáticamente las 54 filas en 54 incidentes monetarios confirmados. El intento pending/pending y las otras 50 pendientes conservan revisión, aunque no muestran referencias o ledger.

No se encontró un historial versionado de precios de listings que pruebe el precio vigente al reservar. `itinerary_versions` pertenece a otro dominio. `listings.price_from` actual, un total enviado antiguamente por el browser, una coincidencia de importes o una moneda por default no permiten reconstruir un contrato histórico.

Los grupos contienen fechas, participantes, listing/provider técnico, estado, total legacy, precio actual etiquetado como no histórico, presencia de referencias/ledger y disponibilidad. El inventario histórico no debe completarse usando un cupo inventado. Las reservas de días pasados sin slot no ocupan los nuevos slots de fechas futuras.

## 3. F1: referencia financiera externa

| Evidencia | Valor |
|---|---|
| Booking | cmjbseze30004flrkxog8t4ms |
| Listing / provider | cmjbsezau0002flrkgq3qay04 / cmjbscu2l0001fl6glleicwhw |
| Booking status / payment_status | confirmed / paid |
| Booking expected amount | NULL; no backfill autorizado |
| Legacy total / participantes / currency | 120 / 2 / usd |
| Creada / fecha del tour | 2025-12-18 18:42:10.732 / 2025-12-18 18:42:10.730 UTC |
| Booking updated_at | No existe ese campo; no inventar hora de confirmación |
| PaymentRecord | cmjbsf0740005flrkac3n429k |
| Estado / moneda del ledger | paid / usd |
| Importe bruto / comisión / neto local | 12000 / 1800 / 10200 centavos |
| Creado / actualizado el ledger | 2025-12-18 18:42:11.708 UTC, ambos |
| Checkout Session | cs_test_1766083330893, coincide en booking/ledger/evento |
| PaymentIntent | pi_test_1766083330893, coincide en booking/ledger/evento |
| Importe realmente cobrado | UNKNOWN; baseline sin amount_charged_cents |
| Modo Stripe demostrado | UNKNOWN |

Los tres IDs session/intent/event comparten un sufijo igual a un timestamp en milisegundos: 2025-12-18 18:42:10.893 UTC. Es un indicio fuerte de un fixture construido localmente. `cs_test_` aparenta Test; `pi_test_...` y `evt_test_...` no son prueba de objetos emitidos por Stripe. El payload no guarda livemode. No concluir automáticamente “fue un Stripe Test real” ni “no hubo dinero real”.

El único OperatorWallet local afirma totalEarned=12000, pendingPayouts=10200, commission=1800, totalReleased=0. Son totales contables locales, no evidencia de fondos en Stripe. No se deben usar para autorizar un payout. No se modificaron.

Verificación externa futura, todavía NO ejecutada:

1. Confirmar la cuenta/entorno Stripe y si la operación pertenecía a la plataforma o a una cuenta conectada. No buscar por email, nombre ni datos de tarjeta.
2. GET de la Checkout Session técnica anterior; comprobar id, livemode, created, status, payment_status, amount_total/currency, payment_intent, client_reference_id y metadata de asociación. Metadata corrobora los IDs/ownership locales, no los reemplaza.
3. GET del PaymentIntent asociado; comprobar el ID exacto, amount/amount_received/currency, estado y referencia del cargo. Consultar únicamente estado/importes de refund si fuera necesario; no emitir refund/cancel/expire.
4. Intentar GET del evento si sigue disponible y contrastar id/type/livemode/created/asociación. Un evento antiguo no recuperable o un 404 en una cuenta/modo no prueba que no existió un cargo en otra cuenta/modo. No reintentar automáticamente con credenciales Live.
5. Exportar solo una conclusión sanitizada y técnica. Si el origen sintético se demuestra con el artifact/operador de la prueba, conservar esa evidencia y diseñar una reparación contable explícita; no borrar filas para que postflight pase.

Clasificación: **READ-ONLY SAFE** para una consulta futura limitada a la cuenta Test explícitamente identificada, con permiso de lectura. **REQUIRES LIVE AUTHORIZATION** antes de cualquier consulta que use credenciales/cuenta Live. El modo financiero del caso sigue UNKNOWN y no autoriza por sí mismo ese acceso.

## 4. Evento pendiente asociado a F1

| Campo | Evidencia |
|---|---|
| ID / type | evt_test_1766083330893 / checkout.session.completed |
| created_at / processed_at | 2025-12-18 18:42:11.264 UTC / NULL |
| Processor | Forma de evento Stripe; no existe columna processor en PaymentEvent. No prueba de procedencia auténtica. |
| Booking asociada | metadata.booking_id=cmjbseze30004flrkxog8t4ms; referencias coinciden con la fila |
| PaymentRecord asociado | cmjbsf0740005flrkac3n429k, por booking y referencias; no metadata.payment_record_id |
| Estado/attempts/failure fields en baseline | Esas columnas no existen; no equivalen a un intento fallido registrado ni a cero intentos reales |
| Metadata financiera extraída | amount_total=12000; currency y payment_status ausentes en objeto; no livemode en raíz ni objeto |
| Estado que daría la migración nueva | received, attempts=0, processed_at=NULL; defaults de migración, no reconstrucción del número de intentos histórico |

**Causa de código identificada; atribución operativa todavía inferida.** En el snapshot Git `9c84bc30b818ed4e1992dc5f313e3acd563ae384`, archivo `services/payments/src/queues/processors/stripe-event.processor.ts`, líneas 31–35, el upsert:

- En `create` guardaba id/type/payload y omitía processed_at.
- En `update` asignaba processed_at antes de aplicar el evento.
- Después ejecutaba handleCheckoutCompleted, actualizando Booking/PaymentRecord/OperatorWallet en otra transacción.
- No marcaba el primer evento como procesado al terminar.
- Sin firma, buildEvent aceptaba JSON directamente (líneas 51–60).

Ese bug explica exactamente cómo una primera entrega podía producir un ledger paid y dejar processed_at NULL. La escritura del evento precede al ledger por 444 ms, compatible con ese orden. Se encontró código contemporáneo que puede producirlo, pero no se dispone del deployment log/job original que pruebe que fue ese proceso concreto. También pudo insertarse un fixture o existir un fallo parcial. No se atribuye la causa a Stripe ni a una caída de DB sin evidencia.

El servicio antiguo se leyó desde Git; no se restauró ni se ejecutó. No se añadió Redis/colas ni se alteró el core actual. No se imprimió payload raw. La ausencia de customer_details/client_secret en las rutas inspeccionadas no autoriza a publicar todo el JSON.

**No replay ahora.** Condiciones previas: origen/modo y estado externo verificados, asociación inequívoca, evaluación del ledger/wallet ya afectados, clasificación de la obligación histórica y decisión explícita sobre inventario. Después, ensayar una observación autenticada por el core actual en una copia aislada; probar deduplicación y ausencia de segunda aplicación contable/notificación. Si se confirma que era un fixture, no pasarlo al procesador real: requiere una resolución administrativa documentada y autorizada. No basta con llenar processed_at ni con la existencia del registro para dar el caso por resuelto.

## 5. F2: confirmed sin respaldo suficiente

| Campo forense | Valor |
|---|---|
| Booking ID | cmg1nvaka0002fltgqm9kfcpg |
| Listing / provider | cmfyuce010004fl9c0nbakogk / cmfyecnnt0001fl9cqktkuq5k |
| Booking status | confirmed |
| Payment status | unpaid |
| PaymentRecord | AUSENTE |
| Expected amount | UNKNOWN: amount_cents=NULL y total_price=NULL |
| Charged amount | UNKNOWN; no evidencia local de cargo |
| External IDs | No Checkout Session ni PaymentIntent |
| Inventory state | Columna ausente en baseline; NULL en copia migrada. El fallback conservador trata confirmed como held, pero no acredita un slot real. |
| Participants | 2 |
| Availability | 0 rows para ese listing/día |
| Date | 2025-10-10 00:00:00 UTC |
| Created | 2025-09-27 02:38:04.858 UTC |
| Updated | No existe updated_at en Booking; UNKNOWN |
| Precio actual del listing | 75 USD; NO demuestra precio histórico ni obligación por 150 USD |

Invariant exigible para una confirmación monetaria verificable: precio/moneda acordados y persistidos, más pago auténtico consistente con ellos; una confirmación gratuita necesita evidencia autoritativa de gratuidad. Este caso no demuestra ninguna de las dos condiciones. Tampoco demuestra la asignación histórica de capacidad. Es una confirmación **no acreditada**, no un cargo impagado demostrado.

`paid_confirmation_without_ledger` es el nombre de una alerta conservadora de postflight: también selecciona confirmed con amount NULL y payment_status unpaid. No significa que el sistema haya observado un pago. La comparación con `booking_paid_without_ledger=0` del preflight no es contradicción: sus predicados son distintos.

Clasificaciones: **DATA QUALITY ISSUE, FINANCIAL RISK, CUSTOMER OBLIGATION RISK, LEGACY INCOMPATIBILITY**. Verificar con registros operativos autorizados si fue una prueba, si se prestó el servicio, si existió una promesa gratuita o un pago fuera de sistema. No cancelar automáticamente una obligación que pudo existir, ni marcar paid/amount=0 para silenciar la alerta. La falta de prueba de capacidad histórica no se corrige creando un slot ficticio pasado.

## 6. Quince listings públicos y primer piloto

Todos están en USD. Todos tienen **0 availability rows**, ninguna capacidad canonical disponible y ningún `providers.stripe_account_id`. Todos sus providers tienen status verified y verified_level community, pero approved_at es NULL. Esos estados no prueban KYC, acuerdo comercial ni verificación suficiente para el piloto.

| Listing ID | Provider ID | Estado | Precio actual | Moneda | Capacidad | Availability | Setup de pago |
|---|---|---|---:|---|---|---:|---|
| cmfyeco300003fl9c1nff8q5t | cmfyecnnt0001fl9cqktkuq5k | published | 89 | USD | UNKNOWN | 0 | Sin referencia Connect |
| cmfyeco300004fl9cfimrm1oz | cmfyecnnt0001fl9cqktkuq5k | published | 75 | USD | UNKNOWN | 0 | Sin referencia Connect |
| cmfyuc6i30003flso11gz3aoz | cmfyecnnt0001fl9cqktkuq5k | published | 89 | USD | UNKNOWN | 0 | Sin referencia Connect |
| cmfyuc6i30004flsofeqiu8j9 | cmfyecnnt0001fl9cqktkuq5k | published | 75 | USD | UNKNOWN | 0 | Sin referencia Connect |
| cmfyuce010003fl9c543o5njp | cmfyecnnt0001fl9cqktkuq5k | published | 89 | USD | UNKNOWN | 0 | Sin referencia Connect |
| cmfyuce010004fl9c0nbakogk | cmfyecnnt0001fl9cqktkuq5k | published | 75 | USD | UNKNOWN | 0 | Sin referencia Connect |
| cmgmuav440005flzk1z6mrelf | cmfyecnnt0001fl9cqktkuq5k | approved | 89 | USD | UNKNOWN | 0 | Sin referencia Connect |
| cmgmuav440006flzkkj6vwula | cmfyecnnt0001fl9cqktkuq5k | approved | 75 | USD | UNKNOWN | 0 | Sin referencia Connect |
| cmkn2oqsi0002ok2h71uczpj9 | cmkn2ib1c0000ok2hsak4ystm | published | 50 | USD | UNKNOWN | 0 | Sin referencia Connect |
| cmkophqip0005k12jzz6mzprw | cmkoozlg50002k12j5hwrtk28 | published | 460 | USD | UNKNOWN | 0 | Sin referencia Connect |
| cmmo7du1q000fflfwap3pxdad | cmfyecnnt0001fl9cqktkuq5k | approved | 89 | USD | UNKNOWN | 0 | Sin referencia Connect |
| cmmo7du1q000gflfwou3345ou | cmfyecnnt0001fl9cqktkuq5k | approved | 75 | USD | UNKNOWN | 0 | Sin referencia Connect |
| cmqhjfqu80005oz57s0uu9io9 | cmmclziqc000tk32iy36cqwrk | published | 100 | USD | UNKNOWN | 0 | Sin referencia Connect |
| cmqhk6j2h0001r95raxvxb8ih | cmmclziqc000tk32iy36cqwrk | published | 120 | USD | UNKNOWN | 0 | Sin referencia Connect |
| cmqhkcidc0005r95r4bccdmsw | cmmclziqc000tk32iy36cqwrk | published | 150 | USD | UNKNOWN | 0 | Sin referencia Connect |

Capacidad máxima: no hay campo max_guests/capacity en Listing; el máximo real es `listing_availability.spots_total` por día. `start_date/end_date` son límites del listing, no slots ni evidencia de cupos. No es correcto inventar spots_total a partir de participantes históricos o del precio.

**Mejor candidato por completitud:** `cmqhk6j2h0001r95raxvxb8ih`, provider `cmmclziqc000tk32iy36cqwrk`.

- Published, price_from=120 USD, duración 240 minutos, descripción y portada presentes.
- Listing.operator_id coincide con provider.user_id; existe ownership para operar con auth real.
- Email y teléfono operativos presentes: se verificó presencia, no se imprimieron ni se comprobó que respondan.
- Rango 2026-09-21 a 2026-10-07, futuro respecto a esta revisión. No es una promesa de disponibilidad.
- El listing del mismo provider `cmqhjfqu80005oz57s0uu9io9` está igualmente completo pero terminó el 2026-08-21; el de USD 150 carece de portada. Los otros providers tienen mayores carencias de ownership/datos operativos o fechas vencidas.
- Ninguno está listo para una primera reserva pagada segura mientras falten cupos reales y payout readiness.

Datos exactos por obtener del operador antes de escribir availability real:

| Dato requerido | Contrato actual / evidencia necesaria |
|---|---|
| Owner y autorización | Confirmar que la cuenta dueña corresponde al operador y está autorizada para este piloto; no asociar usuarios por nombre/email parecido. |
| Fechas reales | Fechas futuras explícitamente confirmadas por operador, dentro del rango autorizado del listing. |
| Timezone / hora de inicio | Zona IANA y hora local, más regla documentada de conversión al día UTC del modelo actual. Una fila por listing/día; no simular múltiples salidas con capacidad mezclada. |
| spots_total | Cupo total real reservado para Wadatrip, contando ventas por otros canales que puedan reducirlo. Confirmar quién controla el cupo compartido. |
| Cutoff | Antelación mínima y hora de cierre acordadas. No hay campo canonical ni enforcement horario de cutoff; validar un procedimiento operativo de cierre antes de aceptar dinero. spots_available=0 por sí solo no cierra el inventario authoritative. |
| Cancellation policy | Plazos, condiciones del operador/traveler y tratamiento si cancela el operador; evidencia del texto aceptado. No hay campo dedicado/versionado de política en Listing/Booking. |
| Meeting point | Punto e instrucciones precisos para el traveler; no hay campo específico en schema. Confirmar y publicar información operativa apropiada, sin exponer contacto privado por accidente. |
| Operational contact | Contacto privado que responde, horario y responsable ante incidencia; provider.email/phone existen, presencia no equivale a disponibilidad operativa. |
| Price confirmation | Confirmar 120 USD por participante según el cálculo actual, inclusiones/exclusiones y vigencia. Nunca usar este acuerdo para rellenar precios de bookings viejas. |
| Commission agreement | Porcentaje/neto acordado por escrito. Hoy existe WADATRIP_FEE_PCT global con default 15; no sustituye aceptación del operador ni un acuerdo versionado. |
| Payout readiness | Destinatario y ruta de liquidación verificados. Connect account ID ausente; la presencia futura de un acct_ tampoco prueba charges_enabled/payouts_enabled/capabilities o que sea Live. |
| Responsabilidades operativas | Operador real del servicio, obligaciones de facturación/impuestos/reembolsos y quién responde al traveler; el core no calcula taxes ni acredita esos acuerdos. Confirmar fuera del código sin inventar funcionalidad. |

El checkout actual **sí puede crear un cobro de plataforma sin cuenta Connect**, usando metadata connect_fallback=true. Por tanto, la ausencia de acct_ no impide técnicamente que el cliente pague: es un blocker comercial/operativo para activar Live si no existe una ruta de liquidación aprobada. No se considera el fallback una solución de payouts. No se modificó Connect ni se creó otra integración.

## 7. Plan de reparación, sin ejecución de SQL correctivo

**AUTOMATIC SAFE REPAIR**

| Repair | PRECONDITION | EXPECTED CHANGE | ROLLBACK / RECOVERY | POST-VALIDATION |
|---|---|---|---|---|
| Recuperar seis migration.sql originales — realizado localmente | Nombre/ruta original y SHA-256 idéntico al snapshot DB; archivo ausente | Solo reaparecen los seis archivos; ninguna fila/metadata DB cambia | Revertir exclusivamente esos archivos nuevos si se detectara evidencia contraria; mantener manifest/checksums para investigación | 6/6 hashes exactos; Prisma status baseline solo dos pendientes, copia migrada up-to-date |
| Auto-repair de importes, inventario, pagos o eventos históricos | No satisfecha | **NINGUNO permitido** con evidencia actual | Preservar snapshot y filas originales | Counts/IDs sin alteración; Unknown sigue unknown |

**MANUAL REVIEW**

| Repair propuesto | PRECONDITION | EXPECTED CHANGE | ROLLBACK / RECOVERY | POST-VALIDATION |
|---|---|---|---|---|
| Resolver F1 y su efecto en ledger/wallet | Evidencia de origen real/sintético, cuenta/modo y dinero; aprobación del responsable financiero | Una resolución explícita, sin segundo cargo ni notificación. Si fue fixture, excluirlo de obligaciones/payouts mediante corrección contable aprobada, nunca borrar historia | Backup por IDs técnicos; cambios transaccionales con old-value preconditions. Si hay dinero externo, recuperación financiera explícita; un rollback SQL no revierte un cobro | Booking, ledger, evento y wallet explicables; no importe cobrado inferido; no payout basado en el fixture |
| Resolver F2 | Evidencia de prestación, promesa, gratuidad/pago y resultado operativo | Clasificación/cierre coherente con lo demostrado; precio permanece desconocido si no puede acreditarse | Mantener evidencia y valores anteriores; reparación transaccional individual; no mensaje al cliente sin revisión | No confirmación engañosa; no pago/capacidad ficticios; cualquier alerta residual documentada con ID |
| Cerrar el evento pendiente | F1 investigado; distinguir efectos ya aplicados de falta de timestamp; autenticidad demostrada o fixture identificado | Procesamiento idempotente ensayado o resolución administrativa separada y autorizada | Conservar evidencia original; si falla, dejar evento retryable/pendiente e investigar. No usar processed_at para ocultar error | Una sola aplicación financiera, sin wallet duplicado, sin notificación falsa; estado final auditable |
| Dar de alta cupos del piloto y ownership faltante cuando proceda | Autorización real del operador, fechas/cupo/contrato/payout y owner confirmados | Únicamente availability real para piloto y asociaciones demostradas | Detener ventas antes de retirar cupo; no liberar reservas/pagos activos como rollback; cancelar por lifecycle cuando sea válido | Día UTC único; total >= ocupación; intento al último cupo probado; datos operativos publicados apropiadamente |

Estos son planes, no scripts listos para ejecutar. No se generó SQL de reparación especulativo: faltan valores y evidencia para definir un cambio correcto. El SQL añadido es exclusivamente de diagnóstico.

**READ-ONLY EXTERNAL VERIFICATION**

| Verificación | PRECONDITION | EXPECTED CHANGE | ROLLBACK / RECOVERY | POST-VALIDATION |
|---|---|---|---|---|
| Session/Intent/Event de F1 | Cuenta/modo definidos y permiso correspondiente; Live requiere autorización explícita | Ninguna escritura externa/local: informe técnico sanitizado | Si faltan objetos/retención/credenciales, conservar UNKNOWN; no cambiar de modo ni cuenta automáticamente | IDs/monto/currency/livemode/status/asociación contrastados; diferencias escaladas |
| Readiness del destinatario de payout | Acuerdo del operador y cuenta autorizada para consulta | Ninguna escritura; acreditar capacidades y destino | Si no hay cuenta o permisos, seguir NO-GO para dinero | No confundir acct_ existente con onboarding terminado o settlement habilitado |

**NO CHANGE**

| Datos preservados | PRECONDITION | EXPECTED CHANGE | ROLLBACK / RECOVERY | POST-VALIDATION |
|---|---|---|---|---|
| 50 pending/unpaid, un pending/pending y un cancelled/unpaid sin referencias | No hay evidencia suficiente para reconstrucción ni cierre masivo | Ninguna | Mantener snapshot y dossier por IDs | amount_cents sigue NULL; no precio histórico inferido; no reactivación ni generación de pagos |
| Precios actuales y política inexistente para el pasado | Ausencia de historial contractual probado | Ninguna | No aplica | No backfill desde listing.price_from ni tagging gratuito retroactivo |
| Estado migration history | Los seis originales ya están recuperados | Ninguna escritura a _prisma_migrations | No resolve/reset/squash sobre la copia/producción | 18 aplicadas originales intactas; nuevos archivos no implican SQL aplicado |

## 8. Matriz GO / NO-GO por nivel

Las columnas de producción describen el estado actual, no autorizan ejecución. Un ambiente Test completamente separado, con datos sintéticos, no hereda por sí mismo todos los incidentes de este snapshot.

| Hallazgo | A: code only sobre schema viejo | B: schema migration | C: Test desplegado aislado / sobre DB real | D: Stripe Live | E: primera booking real |
|---|---|---|---|---|---|
| Historial: seis ausentes | Recuperación completada; no es ya un blocker por contenido perdido | Originales recuperados; status correcto y cadena de 20 validada desde cero. Revisar release exacto y target antes de aprobar rollout | No impide Test en DB sintética con cadena validada | No activar sin release aprobado | Igual |
| Core nuevo necesita columnas/constraints nuevas | **BLOQUEA** ejecutar code only contra schema viejo | Exige orden: detener escritores, migrar, arrancar todos con misma versión | Schema Test debe coincidir; no mezclar Gateway nuevo/Hub viejo | **BLOQUEA** coexistencia de escritores antiguos | **BLOQUEA** |
| 52 desconocidos sin referencia (50+1+1) | No borrar/backfill; core debe mantener fail-closed legacy | No bloquean por sí mismos las dos DDL ensayadas; NULL está soportado | No bloquean Test aislado; no reutilizarlos como fixtures | No necesitan todos un monto artificial para lanzar: registro de excepciones y exclusión de cobro/payout automático | No afectan cupos de nuevos días futuros; conservar investigación |
| F1 + evento + wallet no verificados | No ejecutar replay/conciliación como smoke | No bloquean físicamente DDL por sí solos; no resuelven dinero | Test aislado permitido con otros IDs; **no replay de F1** contra Stripe | **BLOQUEA** operación financiera sin adjudicar ese caso/excluirlo con evidencia | **BLOQUEA** liquidación basada en saldos contaminados |
| F2 confirmed no acreditada | Riesgo de mostrar confirmación legacy | No bloquea físicamente DDL; preserve and review | Test sintético independiente; no tratar F2 como prueba de pago | **BLOQUEA** presentar historial financiero como conciliado | Resolver/registrar obligación antes de lanzar al cliente |
| 0 availability | El código nuevo rechaza nuevas bookings sin slot | No bloquea DDL | Test aislado puede usar cupos sintéticos; en DB real se necesitan cupos de prueba explícitos/aislamiento | **BLOQUEA** piloto bookable | **BLOQUEA** |
| Payout/operador/política/cutoff incompletos | No bloquea build ni schema | No bloquea DDL | No bloquea Test aislado sin obligación comercial real | **BLOQUEA** Live para ese operador | **BLOQUEA** |
| Target actual/rollout no revalidados | **BLOQUEA** deploy accidental sobre otro schema | **BLOQUEA** aprobación operativa hasta confirmar destino y ventana | No se ha verificado un entorno desplegado independiente; debe identificarse | **BLOQUEA** | **BLOQUEA** |

Decisión actual para el destino de producción existente: **NO code-only; NO autorización operativa de schema migration todavía; NO Stripe Test contra esa DB; NO Live; NO primera booking real.** Esto no significa que los 54 NULL impidan migrar ni que deban limpiarse antes de cualquier Test. La ruta incremental de schema ya tiene evidencia positiva sobre la copia; falta cerrar el release completo y su ejecución segura en el target correcto. Un Test desplegado independiente con DB sintética, test credentials y esa versión/schema validados puede continuar sin esperar la resolución de todos los NULL históricos, una vez definido y autorizado ese ambiente.

Orden mínimo: el ensayo de la cadena recuperada de 20 migraciones en otra DB vacía desechable ya pasó. Sigue confirmar target/backup/ventana con escritores detenidos; revalidar preflight sobre snapshot actualizado; migrar antes de arrancar Gateway/Hub nuevos; comprobar constraints y smokes; frontend después de API compatible. No hacer rollback a escritores antiguos sobre operaciones financieras nuevas. Ante fallo de DDL transaccional, mantener maintenance e investigar; ante un pago externo ya iniciado, no restaurar ciegamente un snapshot que lo olvide.

## 9. Evidencia, límites y próximo trabajo

- SQL diagnóstico: `scripts/production-forensic-readonly.sql`, ejecutado correctamente sobre el baseline restaurado. Emite IDs técnicos, importes/estados y flags de presencia; nunca contacto, documentos, tokens, payload raw o datos de tarjeta.
- Las lecturas produjeron 54 amount NULL, 1 ledger, 1 evento pendiente, 1 alerta de confirmación no respaldada, 15 listings públicos y 0 availability. No hubo escritura en DB.
- Cinco tests existentes de contrato de migración pasan. No se modificó lógica de aplicación ni se atribuyen estos cinco tests a una nueva ejecución del E2E o de todas las pruebas de core.
- Los ocho core checks y pruebas de rollback/lock del ensayo anterior siguen siendo evidencia anterior, no se volvieron a ejecutar sobre la copia en esta revisión.
- La ejecución separada del historial completo desde cero ya pasó y está documentada en RECOVERED_HISTORY_VALIDATION.md. `migrate status` por sí solo no prueba la ejecución de toda la cadena ni un diff exhaustivo de schema.
- Se conservaron intactos `.yarn/install-state.gz`, `apps/web/src/pages/Account.jsx`, `package.json` y el informe previo de ensayo. No mobile, staging, commit, push, deploy, Stripe ni acceso a producción.

Los cinco blockers prioritarios son: (1) cierre del release/target/rollout con la cadena recuperada, (2) F1 y su evento/wallet no verificados, (3) obligación F2 sin evidencia, (4) cupos operativos reales del piloto, (5) payout/acuerdo/cutoff/cancelación del primer operador. Cincuenta y dos NULL sin referencia no justifican inventar importes ni meses de limpieza antes del primer piloto.

Si fuera mi empresa, protegería la recuperación de Git y la evidencia del ensayo completo ya realizado en un cambio revisable; obtendría la evidencia de origen del posible fixture de diciembre y los cupos/condiciones del operador candidato. Después haría la consulta externa estrictamente de lectura autorizada, si esa evidencia no basta, y resolvería los dos casos priorizados. Abriría ventas para un único operador/día/cupo real después del rollout y del smoke Test desplegado. No habilitaría Live para descubrir estos problemas con el dinero del primer cliente.

## Anexo: las 54 filas desconocidas, solo evidencia técnica

Todas tienen amount_cents=NULL, moneda local usd y 0 availability para su día. Ningún precio actual de la tabla es prueba de precio histórico. Solo F1 tiene referencias, ledger y evento asociado; los demás no tienen asociación financiera local. INV significa NEEDS INVESTIGATION, no autorización de cambio. Los timestamps sin offset se interpretan como UTC según el contrato almacenado.

| Booking ID | Grupo | Listing ID | Participantes | Fecha | Creada | Total legacy | Precio actual, NO histórico |
|---|---|---|---:|---|---|---:|---:|
| cmg1nvaka0002fltgqm9kfcpg | F2 | cmfyuce010004fl9c0nbakogk | 2 | 2025-10-10T00:00:00 | 2025-09-27T02:38:04.858 | NULL | 75 |
| cmg1qjqiw0002flvw1lwxdbgm | NO ACTION | cmfyuce010004fl9c0nbakogk | 2 | 2025-10-10T00:00:00 | 2025-09-27T03:53:04.52 | NULL | 75 |
| cmi9hq2f20002fls4nns2rxl6 | INV-NULL | cmfyuce010004fl9c0nbakogk | 1 | 2025-11-22T23:27:36.595 | 2025-11-21T23:27:37.406 | NULL | 75 |
| cmi9hq2t90005fls475j4v4zl | INV-NULL | cmfyuce010004fl9c0nbakogk | 1 | 2025-11-22T23:27:37.566 | 2025-11-21T23:27:37.917 | NULL | 75 |
| cmi9hq34n0008fls453ti67wh | INV-NULL | cmfyuce010004fl9c0nbakogk | 1 | 2025-11-22T23:27:37.829 | 2025-11-21T23:27:38.327 | NULL | 75 |
| cmi9hqeze000bfls4qxxscl1s | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-22T23:27:53.387 | 2025-11-21T23:27:53.69 | NULL | 89 |
| cmi9hqfj0000efls4l86i9z06 | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-22T23:27:54.112 | 2025-11-21T23:27:54.397 | NULL | 89 |
| cmi9hqg8j000hfls4grrp38ue | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-22T23:27:55.041 | 2025-11-21T23:27:55.315 | NULL | 89 |
| cmi9hqgl4000kfls4nyh1yiqb | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-22T23:27:55.479 | 2025-11-21T23:27:55.768 | NULL | 89 |
| cmi9i9ewf000nfls4x3tuxvdm | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-22T23:42:39.141 | 2025-11-21T23:42:40.047 | NULL | 89 |
| cmi9i9jpu000qfls4j7s22oqc | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-22T23:42:46.019 | 2025-11-21T23:42:46.29 | NULL | 89 |
| cmi9i9odk000tfls48qkifq0f | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-22T23:42:52.028 | 2025-11-21T23:42:52.328 | NULL | 89 |
| cmi9i9rho000wfls4v8s92yap | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-22T23:42:56.034 | 2025-11-21T23:42:56.364 | NULL | 89 |
| cmi9jbi600002flnsco3fjgmh | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-23T00:12:16.172 | 2025-11-22T00:12:17.209 | NULL | 89 |
| cmi9jbita0005flnsde86d9bp | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-23T00:12:17.742 | 2025-11-22T00:12:18.047 | NULL | 89 |
| cmi9jbnky0008flns2k12xlqh | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-23T00:12:23.954 | 2025-11-22T00:12:24.226 | NULL | 89 |
| cmi9jbo7n000bflnsqwqxnepc | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-23T00:12:24.743 | 2025-11-22T00:12:25.044 | NULL | 89 |
| cmi9jbpqs000eflns7x20nbn1 | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-23T00:12:26.733 | 2025-11-22T00:12:27.028 | NULL | 89 |
| cmi9ldlw8000hflnssjkummdj | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-23T01:09:53.79 | 2025-11-22T01:09:54.585 | NULL | 89 |
| cmi9ldn2v000kflns1mpuyqmx | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-23T01:09:55.88 | 2025-11-22T01:09:56.119 | NULL | 89 |
| cmi9leezz000nflnsm2dbwov8 | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-23T01:10:32.063 | 2025-11-22T01:10:32.303 | NULL | 89 |
| cmic32z1k000qflns5ou2f3w0 | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-24T19:01:03.268 | 2025-11-23T19:01:03.848 | NULL | 89 |
| cmic330e3000tflnsb7njcxfj | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-24T19:01:05.293 | 2025-11-23T19:01:05.595 | NULL | 89 |
| cmic332iy000wflns2v1irvy8 | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-24T19:01:08.001 | 2025-11-23T19:01:08.362 | NULL | 89 |
| cmic33m0l000zflnshvec9xn1 | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-24T19:01:33.295 | 2025-11-23T19:01:33.621 | NULL | 89 |
| cmic3nn8t0012flns3v0eagvu | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-24T19:17:07.893 | 2025-11-23T19:17:08.334 | NULL | 89 |
| cmic3nom90015flnsc50hlia0 | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-24T19:17:09.846 | 2025-11-23T19:17:10.114 | NULL | 89 |
| cmic3o3yn0018flnswpsj7ddi | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-24T19:17:29.642 | 2025-11-23T19:17:29.999 | NULL | 89 |
| cmic3qhc2001bflns13yunnms | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-24T19:19:17.159 | 2025-11-23T19:19:20.643 | NULL | 89 |
| cmic3r39f001eflnstg1l8chj | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-24T19:19:48.67 | 2025-11-23T19:19:49.06 | NULL | 89 |
| cmic3urii001hflns5wtjafg9 | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-24T19:22:39.474 | 2025-11-23T19:22:40.459 | NULL | 89 |
| cmic42v6m001kflns8nalu5bm | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-24T19:28:57.996 | 2025-11-23T19:28:58.463 | NULL | 89 |
| cmic42w4j001nflnsu8wb7q7l | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-24T19:28:59.345 | 2025-11-23T19:28:59.683 | NULL | 89 |
| cmic42wt2001qflnsmqry5vjg | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-24T19:29:00.255 | 2025-11-23T19:29:00.567 | NULL | 89 |
| cmic42x61001tflns9ktq5x6r | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-24T19:29:00.709 | 2025-11-23T19:29:01.033 | NULL | 89 |
| cmic43txz001wflnsx46xjlwy | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-24T19:29:43.115 | 2025-11-23T19:29:43.511 | NULL | 89 |
| cmic4430g001zflnsqb5bcrey | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-24T19:29:54.794 | 2025-11-23T19:29:55.265 | NULL | 89 |
| cmic443sh0022flnskur7hu7t | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-24T19:29:55.982 | 2025-11-23T19:29:56.274 | NULL | 89 |
| cmic4anie0025flnscdrrj0nx | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-24T19:34:59.928 | 2025-11-23T19:35:01.766 | NULL | 89 |
| cmic4in2p0002flsodh4u6z4o | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-24T19:41:13.951 | 2025-11-23T19:41:14.45 | NULL | 89 |
| cmic4ioyl0005flsobad6yzrc | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-24T19:41:16.614 | 2025-11-23T19:41:16.894 | NULL | 89 |
| cmiddjd0y0008flsoeet335mk | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-25T16:41:30.213 | 2025-11-24T16:41:30.802 | NULL | 89 |
| cmiddpbxw000bflsorkto0ljf | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-25T16:46:08.973 | 2025-11-24T16:46:09.332 | NULL | 89 |
| cmidju78w000eflsozy9n365k | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-25T19:37:53.774 | 2025-11-24T19:37:54.224 | NULL | 89 |
| cmidju8tm000hflsoihw470eg | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-25T19:37:55.994 | 2025-11-24T19:37:56.267 | NULL | 89 |
| cmidmqujf0002fl5kmln9lzc3 | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-25T20:59:16.153 | 2025-11-24T20:59:16.636 | NULL | 89 |
| cmidmrbl60005fl5kawieu9gb | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-25T20:59:38.42 | 2025-11-24T20:59:38.73 | NULL | 89 |
| cmidqt5o70008fl5keo1uvmc3 | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-25T22:53:02.418 | 2025-11-24T22:53:02.839 | NULL | 89 |
| cmijqq4f70002fluoy7fh0fpv | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-30T03:37:17.851 | 2025-11-29T03:37:18.307 | NULL | 89 |
| cmijrkx8k0005fluot3cqorek | INV-NULL | cmgmuav440005flzk1z6mrelf | 1 | 2025-11-30T04:01:14.82 | 2025-11-29T04:01:15.333 | NULL | 89 |
| cmjbscu8h0005fl6g25l4xtex | INV-PENDING | cmjbscu5c0003fl6g9vvh74pc | 2 | 2025-12-18T18:40:30.736 | 2025-12-18T18:40:30.738 | 120 | 120 |
| cmjbseze30004flrkxog8t4ms | F1 | cmjbsezau0002flrkgq3qay04 | 2 | 2025-12-18T18:42:10.73 | 2025-12-18T18:42:10.732 | 120 | 120 |
| cmkeqkqtc0002pi2ijbsgkn77 | INV-TOTAL1 | cmfyuce010003fl9c543o5njp | 1 | 2026-01-16T00:53:40.637 | 2026-01-15T00:53:41.184 | 1 | 89 |
| cmkesqwgt0005pi2idcdmjedx | INV-TOTAL1 | cmfyuce010003fl9c543o5njp | 1 | 2026-01-16T01:54:27.126 | 2026-01-15T01:54:27.677 | 1 | 89 |
