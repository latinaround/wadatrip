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
