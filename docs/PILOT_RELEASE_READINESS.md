# Piloto: estado de lanzamiento y operación

Revisión del 20 de octubre de 2026. Esta es una lista de cierre, no una autorización
para cobrar en Live, cambiar variables, desplegar o enviar mensajes externos.
Los resultados anteriores siguen siendo históricos; esta revisión no los convierte
en evidencia de producción real ni de autorización comercial de Stripe.

## Versión reproducible

- Backend publicado: `c30b2dfa04e48f5e964358bcf20df155b617232f`.
- Frontend publicado: `operator-inbox-20261020-d1aa147347ba`, desplegado en
  `dpl_HN55dUcPWjGnQP3Cjm5SW9sKgNH4`.
- Rama de consolidación local: `release/pilot-consolidated-20261020`, basada en
  el mismo commit del backend. Reúne los 16 archivos frontend del manifiesto
  publicado, verificados por SHA-256, y las pruebas correspondientes.
- La consolidación no publica otra versión. `main`, su índice, los cambios pendientes
  de paquetes y el archivo de estado de Yarn se conservan.
- La modificación local informativa de `payments.controller.ts` que añade
  `payment_mode` a Connect status NO forma parte del backend publicado ni de esta
  consolidación. La UI admite que ese dato falte y muestra entorno no verificado;
  no deduce autorización Live. Su publicación futura necesita revisión separada.
- Antes de integrar/push: revisar el diff de esta rama contra `main`, confirmar
  auto-deploy/configuración de Render y Vercel, y publicar de forma coordinada.
  No desplegar un `main` anterior que sobrescriba la web actual.

## Evidencia nueva y límites

- Compilan common, DB, Gateway y Provider Hub.
- El frontend de la copia consolidada compila con API localhost y agentes/bypass
  desactivados. Eso verifica el código; no pretende reproducir el hash de un bundle
  compilado con variables públicas diferentes en Vercel.
- Core local: 242 pruebas aprobadas en procesos separados. Incluye seguridad,
  autenticación, precio, capacidad, lifecycle, recepción de eventos, migración,
  notificaciones y ownership de los avisos.
- Frontend consolidado: 93 pruebas aprobadas; países 5, readiness 14, inbox 12,
  descubrimiento 17, cuenta 15 y controles 30.
- Las pruebas UI usan Chrome headless, localhost y respuestas sintéticas con
  solicitudes externas bloqueadas. No prueban una sesión real de Kiara/Matticiana,
  entrega de correo real ni una nueva transacción de Stripe/PostgreSQL.
- Las pruebas PostgreSQL y Stripe Test de bloques anteriores conservan su evidencia
  original. No se presentan como si se hubieran vuelto a ejecutar en este cierre.
- Herramientas de browser actuales: instalación local ignorada de Playwright Core
  y Chrome Windows. Trasladarlas a un runner documentado/CI queda pendiente antes
  de depender de estas suites en otro equipo; no se añade un framework ahora.

## Corrección del contexto antiguo

La lista inicial de `LIVE_PAYMENTS_PREPARATION.md` es histórica. El código actual
ya contiene modo de procesador explícito, referencias de cuenta por modo, controles
de modo en eventos/operaciones, selección por modo del worker y gate de nuevos
cobros. Las rutas alternativas de PaymentIntent e itinerarios están deshabilitadas.
Las 15 pruebas de `payment-launch-safety.test.cjs` vuelven a comprobar estos controles.
Esto no prueba que estén configurados/permitidos para vender en Live.

El webhook permanente Test y los pagos/refunds Sandbox ya tienen evidencia. La
última confirmación se atribuyó al webhook antes de la reconciliación del browser;
el caso literal de cerrar la pestaña antes del retorno no fue observado. No crear
otro pago solo para repetir un caso ya conocido sin una hipótesis nueva.

## Aceptación con sesiones reales: pendiente

1. Kiara abre Bookings en su operator dashboard mediante su sesión normal.
2. Revisa la reserva Sandbox `cmvh7cgxc0003mj2kgtkkve70` y pulsa Mark as reviewed.
3. Recarga. El aviso debe desaparecer; la reserva permanece confirmed/paid y mantiene
   un cupo. No volver a cobrar, cancelar ni liberar inventario para probar el aviso.
4. Matticiana entra con su cuenta y comprueba la misma referencia en la sección
   Sandbox de Mis viajes, con salida 30/11/2026 11:00 America/Lima y USD 50.
5. Kiara la ve como reserva de su cliente, no como compra propia. Ninguna cuenta
   debe ver los datos privados o las reservas ajenas por cambiar parámetros.

La última lectura de la limpieza autorizada registró una reserva Sandbox activa,
un aviso sin revisar y 12 cupos totales / 11 disponibles. Es un snapshot, no una
lectura en vivo de esta revisión. Un aviso revisado puede pasar a cero sin cambiar
ocupación. Los registros cancelados/refunded deben seguir en el histórico.

## Operación del piloto: decisiones pendientes

Responsable propuesto: dueña de Wadatrip para pagos/soporte; Kiara para entrega.
La asignación y la cobertura deben ser confirmadas por ambas partes.

| Pendiente | Evidencia exigida | Estado |
|---|---|---|
| Salida real | Kiara confirma 30/11/2026, 11:00-17:00, America/Lima | Por confirmar |
| Transporte | Vehículo/conductor y capacidad real contratables para la ruta | Por confirmar |
| Entradas | Disponibilidad y condiciones de museo/parque para esa fecha | Por confirmar |
| Viabilidad | Costos cerrados; cumplir USD 50/persona desde un viajero o ajustar oferta antes de nuevas ventas | Por confirmar |
| Comisión | Operador acepta 15%, costos, devoluciones y responsabilidades | Por confirmar |
| Titular del pago | País legal, titular y banco reales; no inferirlos del país del tour | Por verificar |
| Vía de pago | Respuesta específica de Stripe para el flujo y la cuenta de Wadatrip | Bloqueo Live |

La residencia declarada de Kiara en Estados Unidos y una simulación de banco peruano
no son la misma cosa. No crear una residencia legal ficticia para superar onboarding.
Si no se puede garantizar una salida con un viajero, usar solicitudes sin pago hasta
aprobar una oferta viable. No vender una reserva confirmada condicionada a llenar una van.

## Procedimiento operativo mínimo

Antes de abrir ventas, nombrar una persona que revise al inicio/final de jornada y
antes de la salida los siguientes casos. No existe todavía un panel único que reúna
todo esto; se usan los controles y reportes existentes con acceso autorizado.

| Caso | Acción segura | Criterio de cierre |
|---|---|---|
| Reserva confirmada sin revisar | Operador verifica fecha/viajeros/servicio; marca reviewed | Aviso registrado; booking/payment/inventory intactos |
| Pago o evento incierto | Correlacionar booking, ledger y evento; comprobar modo antes de lecturas externas | Estado final respaldado o caso asignado para conciliación |
| Checkout abandonado/hold antiguo | Investigar si el flujo aún puede pagar; no liberar por antigüedad sola | Cancelación/expiración externa verificada y transición normal, si procede |
| Cancelación durante pago | Mantener inventario mientras el pago aún pueda completarse | Lifecycle resuelto; no SQL manual de estados |
| Refund pendiente/fallido | Revisar intentos, leases, asociación y estado externo del mismo modo | Refund verificado o caso asignado; no segundo reembolso manual |
| Email fallido | Revisar outbox; usar mecanismo de recuperación autorizado | Envío registrado; no prometer recepción/lectura |
| Operador no puede cumplir | Detener nuevas ventas afectadas por la vía soportada; contactar al cliente y resolver obligaciones | Acuerdo/cancelación/refund respaldados, sin falsa confirmación |

Reportes READ ONLY existentes: `scripts/payment-preflight.sql`,
`scripts/payment-postflight.sql`, `scripts/payment-mode-readiness.sql` y
`scripts/notification-release-preflight.sql`. No cargan una DB de destino por sí
solos. Ejecutarlos únicamente mediante conexión autorizada READ ONLY con TLS y
timeouts; guardar conteos/IDs técnicos, sin payloads ni datos de contacto.
Que una automatización esté activa no sustituye verificar incidentes pendientes.

Para cada incidencia guardar: booking ID, PaymentRecord ID, modo, referencia externa
técnica, estado observado, responsable, próxima revisión y evidencia de cierre.
No registrar tokens, client secrets, tarjetas, correos ni payloads crudos.

## Puerta de lanzamiento

Live sigue NO-GO hasta cerrar todos los siguientes puntos:

- Aceptación de ambas cuentas y operación económicamente viable del piloto.
- Ruta de cobro/pago al titular real aprobada para la cuenta. No asumir habilitación
  de Global Payouts, Treasury o Connect a partir de una recomendación de soporte.
- Acuerdo de comisión/costos, cancelaciones, responsabilidad del servicio y
  obligaciones legales/fiscales revisadas por los responsables adecuados.
- Preparación/migración necesaria ensayada, backup restaurable y excepciones de
  datos históricos con dueño y exclusión segura de automatizaciones.
- Credenciales, referencias y webhook Live separados de Test; comprobación de modo
  y allowlist del operador. Autorización explícita antes de activar Live.
- Procedimiento para cerrar nuevos cobros sin bloquear webhooks o recuperación,
  y responsables de soporte, conciliación, devoluciones y disputas disponibles.
- Release consolidado y smoke tests del despliegue que se vaya a aprobar.

Siguiente automatización propuesta, después del piloto: recordatorios ligados al
estado real y una lista de excepciones operativas. No añadir agentes de ventas,
otros procesadores, proveedores ficticios, chat ni funciones mobile en este cierre.

## Aceptación de la revisión por Kiara — 20 de octubre, 23:36 UTC

La dueña mostró los tres grupos de avisos en cero. Una consulta autorizada READ ONLY
confirmó el receipt de la última reserva para el propietario actual del provider.
La reserva `cmvh7cgxc0003mj2kgtkkve70` permanece confirmed/paid/held, un viajero,
USD 50; su PaymentRecord sigue succeeded, modo test y sin resolución pendiente.
Quedan cero reservas confirmadas sin revisar, una reserva activa y 11 de 12 cupos
disponibles. La comprobación no cambió datos ni realizó llamadas a Stripe.
Esto cierra la aceptación del aviso por el operador; la comprobación visual de
Matticiana y los requisitos comerciales/Live anteriores siguen pendientes.
Este apunte es posterior al commit local de consolidación y aún no está committed.

## Continuación Sandbox con Kiara — 20 de octubre, 23:42 UTC

La dueña aclaró que Kiara es la operadora de prueba. No hace falta contratar un
operador ni confirmar transporte real para continuar pruebas técnicas. Esas
condiciones se exigen antes de ventas reales; las cuentas y salidas de Sandbox no
prueban identidad legal, relación contractual ni capacidad efectiva de prestar el servicio.

La comprobación READ ONLY de la reserva existente confirmó cuentas activas distintas
para traveler y owner, un cliente confirmado en el provider y cero reservas personales
confirmadas de la operadora. Importe esperado/cobrado: 5000 centavos USD, Test,
PaymentRecord succeeded y booking confirmed/paid/held. Salida guardada:
30/11/2026 11:00 America/Lima. Un envío confirmed al traveler y otro al operador
figuran sent; no es evidencia de lectura. La revisión del aviso sigue guardada y
quedan 11 de 12 cupos. No se crearon pagos ni se consultó Stripe.

El primer intento del verificador dio un falso negativo al comparar DateTime local
con UTC. Se reprodujo con el snapshot guardado, se comprobó que ambos representan
el mismo instante y se corrigió solo la comparación del verificador a Unix seconds.
La segunda lectura pasó; el producto y la fecha persistida no fueron modificados.

Pendiente de aceptación visual: en Bookings de Kiara, Refresh bookings debe conservar
una reserva futura del cliente aunque New reservations esté en cero. En la sesión
viajera, la misma referencia debe verse en Test bookings and payments de Mis viajes.
No crear otra booking para esta comprobación. Los apuntes posteriores al commit
local siguen sin staging ni nuevo commit.

## Cambio de cuenta y logout: corrección local pendiente de publicación

Durante la preparación de la prueba manual se reprodujeron siete contraejemplos
en nueve casos locales, con el frontend anterior y datos exclusivamente sintéticos:
respuestas de perfil tardías después de logout/cambio de cuenta, error tardío que
cerraba la sesión siguiente, verificación de código y guardado de perfil pendientes,
retorno heredado que reutilizaba el token de la URL tras logout y fragmento malformado
que impedía cargar la cuenta. El cierre normal con Atrás/recarga y el rechazo de
una sesión actual expirada ya pasaban. Esto no implica acceso autorizado al backend
con otra identidad: es un fallo de aislamiento/consistencia de la sesión del frontend.

Se corrigió únicamente `apps/web/src/context/AuthContext.jsx`: invalidación síncrona
de respuestas anteriores, protección de perfil/login/registro/verificación/guardado,
orden de peticiones del perfil y consumo único del retorno heredado. Se conserva
el JWT, la clave de almacenamiento y el sistema de autenticación existente.

`scripts/auth-session-boundaries-ui.test.cjs` reproduce los nueve casos con Chrome
headless, localhost, códigos/tokens/cuentas sintéticos y API interceptada. Resultado
anterior: 2/9; corregido: 9/9, repetido sobre el build final. Regresión: 135 pruebas
distintas aprobadas (9 nuevas, 4 auth existente, 15 cuenta, 12 inbox, 30 controles,
13 traveler auth, 52 seguridad). Build frontend y diff check pasan. Lint: cero
errores y el aviso existente de Fast Refresh por exportar el hook junto al provider.
Los previews se cierran al terminar. No se usan sesiones reales ni se envían correos.

Esta corrección NO está publicada, staged ni committed. No cambia el backend,
Stripe, pagos, reservas, inventario, DNS o mobile. Requiere una publicación frontend
acotada desde la versión consolidada para que pueda aceptarse en el dominio público.
La versión pública actual no debe describirse como corregida por estas pruebas locales.

Aceptación manual después de publicar: abrir Mis viajes como Matticiana, cerrar
sesión, usar Atrás y recargar; debe pedir login y no mostrar sus datos privados.
Después iniciar sesión normalmente como Kiara y abrir Operator dashboard; debe
mostrar las reservas de clientes de Kiara. No cambiar tokens manualmente, enviar
códigos a Codex, crear otra reserva ni realizar pagos para esta prueba.

## Corrección de sesión publicada — 21 de octubre de 2026

La dueña autorizó expresamente publicar únicamente este ajuste del frontend. Este
resultado reemplaza el estado «pendiente de publicación» de la sección anterior.

- Commit local aislado: `0131a36694756152f7e0d447c75f94d60fb54960`,
  `fix(auth): isolate sessions across logout and account changes`.
- Rama `fix/web-auth-session-20261021`, basada en la versión consolidada `e82ace8`.
  Exactamente dos archivos: AuthContext y la nueva prueba de nueve casos. Se verificó
  que el resto del frontend coincide con la versión previamente publicada.
- Vercel: `dpl_EdUjtiL5CdNaYjgqe19XcdsQM3Rf`, READY y promovido.
  Release: `auth-session-20261021-0131a3669475`.
- Ambos dominios sirven `/assets/index-CW7RtHJc.js`. Se comprobaron por GET las
  rutas de cuenta, Mis viajes, catálogo, operador, información y contacto, todas 200,
  y los marcadores del nuevo aislamiento de sesión y consumo del retorno heredado.
  Los avisos del operador, navegación y origen API existente se conservaron.
- Se preservaron root/build/install/output y las variables públicas verificadas de
  Vercel. Sin cambios de Render, DB, Stripe, DNS o mobile; sin nuevos correos/pagos.
- Fuente exportada únicamente desde Git. Dry run: 436 archivos; sin env privados,
  logs, dependencias instaladas, builds, estado Yarn o artefactos sensibles.
- No se hizo Git push. HEAD e índice primarios y los cambios anteriores se conservaron.
  No desplegar `main` antiguo: la base web para una próxima publicación es este commit
  o una descendiente revisada que conserve la consolidación y esta corrección.
- La evidencia es de 135 pruebas locales con API sintética y comprobación de archivos
  y rutas desplegados; NO se impersonó una sesión real ni se dio por completada la
  aceptación manual de Matticiana/Kiara con la versión nueva.

Próxima acción de la dueña: recargar la web con Ctrl+Shift+R, probar logout/Atrás/recarga
y volver a iniciar sesión como la otra cuenta. Mantener la reserva Sandbox existente.
Estado y recuperación en `logs/auth-session-web-release-20261021.json`; despliegue
anterior conservado como referencia de rollback, no ejecutado. Las notas de esta
publicación permanecen locales y fuera del commit de dos archivos.

## Aceptación manual y rechazo Sandbox — 21 de octubre de 2026

La dueña comprobó que el nombre desaparece al cerrar sesión, volvió a iniciar sesión
y cambió de Matticiana a Kiara. El operador vio la reserva de su clienta y el inventario
coherente. Esto valida ese recorrido visible; no acredita por sí solo todos los casos
de Atrás/recarga o respuestas tardías, cubiertos separadamente por pruebas locales.

Durante la preparación, Link utilizó la tarjeta exitosa guardada 4242. Se creó la
reserva Sandbox `cmvie3iqk0009oi2j3eoe6zhp`, posteriormente cancelada y reembolsada
desde el flujo normal de la web por la dueña. No se convirtió en una venta real.

La dueña repitió la prueba con la tarjeta de rechazo 0002, sin Link. Stripe mostró
«Your credit card was declined». La reserva `cmviep8i2000boi2j0ml8t72v` permaneció
payment_pending/unpaid en Mis viajes, sin confirmación falsa. Después solicitó su
cancelación desde la revisión explícita; la web mostró cancelled y el panel del
operador volvió a 11 de 12 cupos. No se requirió pagar nuevamente.

Verificación técnica independiente, solo lectura, a las 18:20 UTC:

- DB: intento rechazado cancelled/failed, inventory_state=released, sin resolución
  pendiente ni refund. El importe cobrado local permanece null; no se inventó cero.
- Stripe Test GET: sesión expired/unpaid, PaymentIntent canceled, amount_received=0;
  asociación booking/PaymentRecord/objetos externos verificada. La sesión anterior
  ya no puede completarse. No se recuperó ni expuso su URL ni client secret.
- PaymentEvent: payment_failed, payment_intent.canceled y checkout.session.expired
  procesados, sin error; reconciliaciones locales también procesadas.
- Ninguna notificación de confirmación para el intento rechazado. Una cancelación
  enviada a cada audiencia: traveler y operador (envío no prueba lectura).
- Reserva accidental de Link: cancelled/refunded/released, refund_status=succeeded.
- Reserva conservada `cmvh7cgxc0003mj2kgtkkve70`: confirmed/paid/held,
  ledger succeeded/test, USD 50. Inventario: 12 total, 11 disponibles.

Evidencia local: `logs/declined-checkout-readonly-result.json`; verificador acotado
`logs/verify-declined-checkout-readonly.ps1`. Exactamente un GET Stripe Test, DB con
transacciones READ ONLY, cero mutaciones durante la verificación. Sin cambios de
código de producto, staging, commit, deploy, infraestructura, mobile ni Stripe Live.
El error original del rechazo se observó en la UI; el objeto cancelado ya no conserva
last_payment_error. Esta evidencia no sustituye una prueba de 3DS ni habilita Live.

## Recuperación de checkout pendiente — corrección local, sin publicar

Al iniciar la prueba 3DS, Link ofreció el OTP de Sandbox para información guardada.
La indicación de volver atrás sacó a la dueña del checkout. La reserva
`cmviga9sj000hoi2jtqve8svp` quedó pendiente/sin pagar según la pantalla compartida;
no se ha acreditado todavía un desafío 3DS. No crear otra reserva para sortearlo.

La página de estado no ofrecía retomar el checkout. El endpoint autenticado existente
ya recupera el mismo PaymentRecord y objeto externo; se preparó únicamente un ajuste
frontend en CheckoutSuccess y travelerBooking para usarlo desde «Continue payment».
No envía identidad, precio ni body; no llama POST /bookings; no crea otro sistema auth.
Solo ofrece la acción para una reserva pagable pendiente, con importe positivo,
sin cancelación iniciada ni inventario liberado. La autoridad final sigue en backend.
Solo permite navegar a una URL HTTPS del checkout Stripe devuelta por el servidor.

Prueba previa: UI 6/11 aprobadas, 5 fallaban por falta de la acción; ocho contratos
unitarios tampoco existían. Después se añadió otra prueba que reprodujo navegación
tardía al abandonar la página mientras el endpoint respondía. Se corrigió comprobando
sesión, generación de petición y URL actual, incluso antes del commit de una ruta lazy.

Resultado final local: 150 pruebas unitarias/core (incluye ocho nuevas, traveler auth,
payment lifecycle, launch safety y security), 12 UI de recuperación, 9 de aislamiento
de sesión y 15 de cuenta: 186 aprobadas. Build frontend aprobado; lint de los dos
archivos de producto sin avisos/errores; git diff --check aprobado. Vista móvil
inspeccionada, sin overflow horizontal. Todo con APIs, cuentas, tarjetas y URLs de
checkout sintéticas/interceptadas: no es evidencia de Stripe 3DS real.

Archivos de este ajuste: apps/web/src/pages/CheckoutSuccess.jsx,
apps/web/src/services/travelerBooking.js, scripts/traveler-checkout-resume.test.mjs y
scripts/traveler-checkout-resume-ui.test.cjs. Estas notas y evidencia local son aparte.
Sin staging/commit/push/deploy, cambios backend/schema, nuevas reservas/pagos ni mobile.
La web pública todavía NO ofrece el botón. Base de una publicación futura: 0131a366,
conservando todo el frontend ya publicado; no desplegar main antiguo.

## Recuperación de checkout publicada — 21 de octubre de 2026

La dueña autorizó publicar exclusivamente el ajuste frontend. Esta sección reemplaza
el estado «sin publicar» de la sección anterior; la aceptación 3DS sigue pendiente.

- Commit local aislado `4e2b2625971b3d126f9a2a1371ff6d7edab6521b`,
  `fix(booking): resume existing traveler checkout`, basado en 0131a366. Cuatro archivos:
  dos de producto y dos de pruebas, 261 inserciones y 10 eliminaciones. Sin push.
- Vercel `dpl_HLYSJYVi6Xj67mVLsvbXBwyNrrmZ`, READY y promovido;
  release `checkout-resume-20261021-4e2b2625971b`.
- Ambos dominios sirven `/assets/index-BkpFtw4T.js`, checkout
  `CheckoutCancel-Cl8UEzWO.js` y helper `travelerBooking-BXS1OS0b.js`. GET público
  comprobó las etiquetas de continuar pago, los guards de sesión/URL/estado y JWT,
  el fix de autenticación previo, inbox de operador y origen API existente.
- Cuenta, Mis viajes, catálogo, retorno success/cancel, operador, información y
  contacto responden 200 en ambos dominios. Esto no equivale a una sesión real
  autenticada: la dueña debe validar el botón en su propia reserva.
- Se conservaron root/build/install/output y variables públicas comprobadas. Fuente
  congelada desde Git, 620 archivos frontend fijados por hash; dry run 438 archivos
  sin secretos, env privados, logs, dependencias instaladas, dist o backups.
- Cero llamadas a Render, DB o Stripe; sin cambios de configuración, DNS, mobile,
  reservas ni pagos durante esta publicación. HEAD/índice primarios y archivos
  anteriores verificados intactos antes de añadir esta nota local. Sin Git push.

Estado de publicación y referencia de recuperación:
`logs/checkout-resume-web-release-20261021.json`. Puntero actual actualizado en
`logs/latest-public-web-release.json`. La versión anterior permanece disponible
como referencia de rollback, que no se ejecutó.

Próximo paso: como Matticiana, recargar y abrir la reserva pendiente
`cmviga9sj000hoi2jtqve8svp`, pulsar Continue payment si el backend aún permite el
checkout y usar la tarjeta 3DS sintética 3220 en Sandbox. Si expiró, detenerse y
comprobar el estado; nunca forzar otra sesión ni crear automáticamente otra reserva.

## Primer intento 3DS interrumpido — evidencia solo lectura

La dueña recuperó la misma sesión mediante Continue payment, añadió la tarjeta 3220
y observó la pantalla de desafío 3DS Test. Al consultar Mis viajes posteriormente,
la reserva `cmviga9sj000hoi2jtqve8svp` ya figuraba cancelled/failed. Se indicó no
completar ni pagar en la pantalla antigua y se investigó sin mutaciones.

Stripe Test y PostgreSQL confirmaron dos hechos separados:

- A las 19:29:51 UTC: payment_intent.payment_failed, código
  payment_intent_authentication_failure; intent requires_payment_method y cobrado 0.
  Esto no prueba qué botón o timeout interrumpió el desafío; no atribuirlo al usuario.
- Sesión creada a las 18:33:27 UTC con expires_at=19:33:27 UTC, una hora. A esa hora
  se emitió checkout.session.expired; PaymentIntent terminó canceled, razón automatic,
  amount_received=0. No fue una cancelación solicitada desde Wadatrip.
- Ledger failed, booking cancelled, inventory released, sin reconciliación pendiente;
  eventos procesados sin error. Cero notificaciones confirmed para este intento;
  una notificación cancelled enviada por audiencia. Inventario: 11 de 12 disponibles.
- La reserva anterior cmvh7cgxc0003mj2kgtkkve70 permanece confirmed/paid/held.

Evidencia en logs/3ds-interrupted-readonly-result.json. Tres GET acotados a Stripe Test
(sesión, evento de expiración y evento de fallo), DB READ ONLY; no payload crudo, datos
de tarjeta, PII, URL de sesión ni secrets impresos. Ninguna corrección de datos/código,
cancelación, cargo, refund o cambio de infraestructura ejecutado durante el diagnóstico.

No declarar 3DS exitoso: se observó el desafío, pero falló antes de que la sesión
expirara. La cancelación terminal y liberación de cupos sí están acreditadas. Para
probar éxito se necesita un intento Sandbox nuevo deliberado, ya que el anterior
está cerrado, completando el desafío en la sesión fresca y verificando después los
estados finales. No resucitar la reserva ni sustituir su PaymentRecord/checkout.

## 3DS completado en Stripe Sandbox — 21 de octubre de 2026

La dueña creó deliberadamente un intento fresco como Matticiana y completó el
desafío Test. Wadatrip mostró confirmed para `cmvijedv1000joi2jvd3oiq53`.
Verificación independiente READ ONLY a las 20:06:45 UTC:

- Stripe: Checkout complete/paid; PaymentIntent succeeded, amount_received=5000 USD;
  Charge succeeded/paid/captured por 5000, refund=0. Objetos asociados a la misma
  booking/PaymentRecord, todos livemode=false.
- Evidencia específica 3DS: result=authenticated, authentication_flow=challenge,
  version=2.1.0. Esta vez sí se acredita un desafío exitoso en Stripe Test, distinto
  de la prueba UI simulada y del intento anterior interrumpido.
- DB: booking confirmed/paid/held, 1 viajero, Nov 30 a las 11:00 America/Lima;
  PaymentRecord succeeded/test, esperado=cobrado=5000 USD, resolution=null.
- payment_intent.succeeded y checkout.session.completed procesados, un intento cada
  uno y sin error. Se crearon exactamente dos notificaciones confirmed con
  source_event_id del webhook succeeded a las 20:04:39 UTC, antes de la reconciliación
  del retorno del navegador a las 20:04:42. Ambas notificaciones figuran sent;
  este estado no acredita lectura por el destinatario.
- La reserva anterior cmvh7cgxc0003mj2kgtkkve70 sigue confirmed/paid/held; el intento
  3DS anterior cmviga9sj000hoi2jtqve8svp sigue cancelled/failed/released. Hay DOS
  reservas Sandbox confirmadas de una persona para la salida; inventario correcto:
  12 total, 10 disponibles. No confundir este resultado con un único cupo consumido.

Evidencia: logs/3ds-success-readonly-result.json; verificador acotado
logs/verify-3ds-success-readonly.ps1. Un GET Stripe Test y consultas DB READ ONLY;
cero mutaciones durante la verificación. Sin payload crudo, secretos, client secrets,
datos de tarjeta ni PII impresos. Sin cambios de código, staging, commit, deploy,
infraestructura o mobile. Las nuevas reservas/pago fueron acciones de la dueña en
Sandbox, no cargos ejecutados por el verificador. Stripe Live sigue NO aprobado.

La prueba 3DS exitosa queda cerrada. No se necesitan más pagos para repetirla. La
nueva reserva permanece confirmada como evidencia; no cancelarla automáticamente.
