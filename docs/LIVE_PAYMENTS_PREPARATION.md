# Preparación de pagos reales de Wadatrip

Fecha de revisión: 2026-10-13. Commit revisado: `4bec9649cbe4fecea46cb4de20db46b8b9ab14d6`.

**Decisión: preparación realizada; activación Live bloqueada.** La revisión inicial fue
de solo lectura en Render/Stripe Test y PostgreSQL. Después, el usuario autorizó continuar
con el webhook Test permanente; la ejecución y sus límites constan al final. No se consultó
Stripe Live, no se cambiaron claves de cobro y no se ejecutaron nuevos pagos ni refunds.

## Evidencia de la revisión inicial, anterior al registro del webhook

| Elemento | Evidencia | Límite |
|---|---|---|
| Procesador del backend | `STRIPE_SECRET_KEY` Test; no alias `STRIPE_SECRET` | No acredita activación de la empresa en Live |
| Cuenta de plataforma consultada con clave Test | País US; charges/payouts enabled | Es información obtenida en contexto Test |
| Cuenta del piloto | Express, PE, agreement recipient; transfers active, payouts enabled, details submitted; sin requisitos pendientes | Sandbox; no acredita permiso para el mismo flujo en Live |
| Asociación del piloto | Metadata de cuenta coincide con provider ID local | Corroboración técnica; falta confirmar titular legal real |
| Webhooks Stripe Test registrados | 0; `has_more=false` | Se consultó solo la cuenta/sandbox de la clave configurada |
| Secreto de webhook | Presente en Render | No se verificó que pertenezca a un endpoint permanente |
| Automatización de pagos / emails | Ambas activas en Test | No cambiar la clave a Live con trabajos Test sin aislar |
| Comisión | `WADATRIP_FEE_PCT` ausente; código usa 15% | Falta acuerdo comercial explícito |
| Refund jobs abiertos / notificaciones abiertas | 0 / 0 | Snapshot; repetir antes de cualquier cambio |
| PaymentRecords con Checkout Session Test | 3 | No borrar ni convertirlos en registros Live |
| Referencias financieras sin prueba de modo por Session | 0 registros en esta consulta | El modelo no almacena modo; prefijos no son garantía general para Intent/Event/Account |

Piloto: listing `cmkn2oqsi0002ok2h71uczpj9`, provider `cmkn2ib1c0000ok2hsak4ystm`.
Listing publicado, provider verified, USD 50 por viajero, America/Lima, salida 09:30,
fecha disponible 2026-11-30, cutoff 24 horas, política `flexible_24h_v1`, meeting point y
contacto privado presentes. Disponibilidad: 19/20. Para ese día existe una booking
confirmed/paid/held y una cancelled/refunded/released, ambas realizadas durante Test.
La reserva Test restante conserva un cupo; cerrarla mediante el lifecycle normal cuando
se autorice. No incrementar capacidad ni borrar registros para ocultarla.

Resultados históricos conservados: 54 bookings con amount desconocido; 69 con inventory
legacy NULL; 22 días ocupados sin availability; un evento received/checkout.session.completed
sin processed_at; una confirmed/completed señalada por respaldo insuficiente. Cero
contradicciones booking/ledger, duplicados externos, orphans, cupos excedidos o discrepancias
de cache en las consultas actuales. Todos los índices/constraints exigidos por postflight
están presentes. Siete constraints permanecen NOT VALID.

## Primer bloqueo: la ruta de payout de Perú

El código actual crea Express con `tos_acceptance.service_agreement=recipient`, solicita
transfers y utiliza destination charges sin `on_behalf_of`. El Sandbox acepta esa combinación.

La documentación pública consultada hoy limita cross-border payouts de autoservicio a
US/UK/EEA/CA/CH y remite los acuerdos recipient a Global Payouts. No concluir que Wadatrip
dispone de una excepción comercial ni que el país PE es elegible en Live porque Test funcionó.
La situación específica de la cuenta necesita confirmación de Stripe.

Antes de crear una cuenta Live obtener:

1. País legal y estado de activación Live de WADATRIP LLC.
2. Titular legal y país real del operador. Teléfono US y actividad en Lima no prueban domicilio legal.
3. Confirmación escrita o habilitación visible de Stripe para **US platform -> PE Express
   recipient -> destination charge con application_fee_amount, sin on_behalf_of**.
4. Condiciones de payout, moneda bancaria, conversión, comisiones, restricciones y reversión
   de transfer/refund para esa cuenta.

Si Stripe no admite este flujo, detener Live y decidir la ruta comercial antes de implementar
otro producto de payouts. No cambiar el país del operador para sortear una restricción.

Texto preparado para soporte, no enviado:

> WADATRIP LLC operates a tours marketplace. Our platform account is based in the US and
> our intended pilot operator is legally based in Peru (subject to our verification).
> Our sandbox uses an Express connected account in PE with recipient service agreement
> and transfers capability. Checkout creates destination charges with application_fee_amount
> and transfer_data.destination, without on_behalf_of. Is this exact flow enabled and supported
> in Live for our account? If it needs a specific approval, what is required? Please confirm
> payout currencies/timing, fees, refund and transfer-reversal support, and whether your current
> Global Payouts guidance changes the integration required for this recipient.

## Cambios mínimos pendientes antes de Live

| Prioridad | Condición | Corrección / evidencia exigida |
|---|---|---|
| P0 | Webhook permanente ausente en la cuenta Test consultada | Registrar Test directamente a HTTPS del backend, asociar su secreto y probar entrega con browser cerrado y sin CLI; posteriormente registrar Live aparte |
| P0 | Test/Live no se almacena en PaymentRecord/provider y no se comprueba event.livemode | Aislar entorno/DB de Test o añadir modo explícito y selección/validación en creación, lectura externa, webhook, refund y workers; históricos unknown deben fallar cerrados |
| P0 | Provider tiene un único stripe_account_id del Sandbox | Conservar referencia Test; crear y asociar una cuenta Live aprobada sin reutilizar/reescribir historia financiera; comprobar país/titular/asociación |
| P0 | Ruta `/payments/itineraries/:id/checkout` accesible, crea sesiones fuera del ledger y sus eventos se ignoran | Deshabilitarla en backend para el piloto antes de abrir Live; pausar UI/AI no cierra la API |
| P0 | Ruta `/payments/create-intent` cobra comisión pero `preparePayment` solo lee request.payment_intent_data.application_fee_amount | Deshabilitarla para el piloto o corregir comisión/net/refund y demostrar equivalencia; actualmente el ledger puede indicar comisión 0 para un cargo con comisión |
| P0 | Falta control explícito para detener nuevos checkouts/Connect sin parar webhooks | Gate servidor y allowlist del piloto; cierre conserva webhook, consultas y recuperación de pagos existentes |
| P0 | Elegibilidad US -> PE recipient no acreditada | Confirmación de Stripe para el producto/flujo preciso y el titular real |
| P0 | Casos financieros legacy pendientes | Adjudicar o excluir explícitamente de automatización con evidencia y responsable; nunca backfill de precio actual |
| P1 | Constraints históricas sin validar | Ensayo/backup/preflight, validación controlada y postflight; no borrar historia para hacerlas pasar |

Cambios anteriores son propuestas; no se implementaron en este bloque de preparación.
La defensa de JWT/precio/capacidad/lifecycle existente se conserva. El nombre declarado
de traveler es dato operativo, no KYC ni prueba documental de identidad.

## Webhook permanente y prueba de independencia del navegador

Destino previsto: `https://wadatrip.onrender.com/webhooks/stripe` (POST). No depende de
api.wadatrip.com. No cambiar DNS para esta prueba.

Eventos mínimos compatibles con el handler actual:

- checkout.session.completed
- checkout.session.expired
- checkout.session.async_payment_succeeded
- checkout.session.async_payment_failed
- payment_intent.succeeded
- payment_intent.payment_failed
- payment_intent.canceled
- charge.refunded
- refund.created
- refund.updated
- refund.failed

Los destination charges del piloto se crean en la plataforma: sus eventos de pago deben
llegar desde esa cuenta. account.updated/payout.failed requieren manejo operativo separado;
el handler actual no transforma esos eventos en alertas. No prometer observación automática
de payouts. Verificar cuentas y payouts manualmente durante el piloto.

Revisar compatibilidad del formato con API version 2024-06-20 fijada en el SDK; elegir
snapshot events compatibles o adaptar y probar conscientemente. No asumir que el formato
predeterminado del Dashboard coincide con el handler.

Prueba Test necesaria: payout Test correcto, booking nueva, pagar Checkout, cerrar navegador
antes de return, verificar Stripe delivery y PaymentEvent processed, booking confirmed/paid/held,
ledger succeeded y dos emails enviados. Reentregar el mismo evento y comprobar una única
transición/notificación. Probar decline/3DS, expiración y refund con reversal/application fee.
La página success puede reconciliar por backend: ver confirmed después de volver al sitio
no demuestra por sí solo que se recibió un webhook.

## Comisión, responsabilidad y margen

Con el valor actual por defecto, un cargo de USD 50 solicita USD 7.50 de comisión y USD 42.50
para el operador antes de costos adicionales de payout/FX. Los USD 7.50 no son beneficio neto.
Stripe documenta que la plataforma soporta fees del procesador, refunds y chargebacks en
destination charges. Obtener tarifas efectivas de la cuenta; no estimarlas como tarifa global.

Antes del piloto aprobar porcentaje explícito, quién asume fees/FX, qué sucede con costos no
recuperables al refund, responsabilidades fiscales/comprobantes y saldo/reserva para disputas.
El ledger net representa reparto contractual, no conciliación bancaria ni fees reales del procesador.
Confirmar regla de cancelación de 24 horas y derechos aplicables sin prometer excepciones legales.

## Datos y constraints antes del cambio de modo

Usar `scripts/payment-preflight.sql` y `scripts/payment-postflight.sql` mediante conexión
READ ONLY con TLS y timeouts. Repetir en copia autorizada y antes de la ventana. Guardar
solo conteos/IDs técnicos necesarios, nunca payloads, contactos ni dumps en Git.

Constraints NOT VALID observadas:

- PaymentRecord_booking_id_fkey
- availability_capacity_valid
- booking_external_ids_nonempty
- booking_participants_positive
- payment_external_ids_nonempty
- refund_attempts_nonnegative
- refund_status_valid

NOT VALID comprueba nuevas escrituras; aún no prueba que todo el histórico cumple.
Ensayar VALIDATE CONSTRAINT sobre copia con duración/locks; hacerlo en producción requiere
ventana y aprobación específica. No ejecutar esas alteraciones como build/startup.

El histórico desconocido debe permanecer desconocido. Una excepción formal que excluya
registros viejos de cobro/worker es distinta de fingir conciliación. No usar OperatorWallet
histórico como prueba de fondos o autorización de payout.

## Secuencia de activación propuesta

1. Confirmar país/titular y permiso Stripe del payout; resolverlo antes de crear otra integración.
2. Cerrar cambios mínimos de modo, rutas de pago, gate de checkout y contabilidad anterior.
3. Registrar y comprobar webhook Test permanente; completar los casos Test anteriores sin CLI.
4. Cerrar reserva Test restante mediante cancelación/reembolso normal; conservar historial.
5. Ensayar migración necesaria, validar constraints y registrar excepciones legacy en copia.
6. Preparar backup restaurable, release preciso, responsables y ventana coordinada. Cerrar
   nuevas bookings/checkouts temporalmente, conservando webhooks/recuperación existentes.
7. Obtener autorización explícita para Live. Crear la cuenta Live del operador correcto y
   completar su onboarding real; guardar el vínculo en un almacenamiento consciente del modo.
   Confirmar transfers/payouts/requirements y titular, no solo existencia de acct_.
8. Registrar webhook Live de plataforma y guardar su signing secret en Render. Configurar
   clave Live de backend con permisos mínimos para las rutas aprobadas, comisión acordada
   y modo coherente. No compartir secretos en chat/Git/archivos web.
9. Actualizar publishable key de Vercel únicamente si se habilita una ruta Elements que la use;
   TourDetail usa redirección a Checkout alojado y no requiere una pk_live para esa redirección.
10. Desplegar coordinadamente con gate cerrado y automation detenida hasta verificar selección
    por modo; validar webhook/configuración. Abrir solo el piloto y un comprador real consentido.
11. Primera transacción real por una experiencia realmente ofrecida, con comprador autorizado.
    No usar tarjetas reales para simular pruebas ni presentar una compra como test de Stripe;
    el importe real y cualquier cancelación se autorizan por separado.
12. Verificar total, moneda, comisión/transfer, webhook, ledger, booking, cupo y emails; revisar
    refund/reversal si se cancela de verdad. Transfer al balance conectado no significa payout
    bancario completado. Verificar destino y estado de payout antes de abrir promoción pública.

## Stop / recuperación

Detener nuevos cobros si hay modo/país/titular ambiguo, webhook ausente, payout no elegible,
amount/currency/fee discrepante, evento pendiente no explicado, saldo sin conciliar o cupos
inconsistentes. No liberar cupos de un pago incierto.

Después de un primer cobro Live, no volver globalmente a clave Test ni restaurar un backup que
olvide el cargo. Mantener webhook Live y consultas de recuperación; cerrar nuevas sesiones,
correlacionar booking/payment/event y resolver refund/conciliación con el modo correcto.
Rollback de código solo a una versión compatible con schema y operaciones ya creadas.

Responsables por confirmar: owner financiero, soporte al viajero, operador, intervención de
refund/disputa y persona con acceso al backup. Monitorear fallos de entrega, PaymentEvents sin
processed_at, estados reconciliation/refund_required, holds antiguos y payout failures; no
registrar claves, client secrets, tarjetas, correos ni payloads crudos en logs.

## Decisión de la revisión inicial

PREPARATION READY: YES
STRIPE LIVE READY: NO
LIVE CREDENTIALS CHANGED: NO
PRODUCTION DATA MODIFIED: NO
WEBHOOKS CREATED: NO
MOBILE MODIFIED: NO

Primer paso recomendado: confirmar elegibilidad de payout del titular real y registrar el
webhook Test permanente. Ambos son necesarios; las credenciales Live permanecen fuera del
servidor hasta cerrar aislamiento de modo, rutas alternativas y gate de nuevos cobros.

## Fuentes verificadas

- [Cross-border payouts](https://docs.stripe.com/connect/cross-border-payouts)
- [Service agreement types](https://docs.stripe.com/connect/service-agreement-types)
- [Destination charges / hosted Checkout](https://docs.stripe.com/connect/destination-charges?platform=web&ui=stripe-hosted)
- [API keys y separación Sandbox/Live](https://docs.stripe.com/keys)
- [Webhooks](https://docs.stripe.com/webhooks)
- [Go-live checklist](https://docs.stripe.com/get-started/checklist/go-live)

La habilitación particular de Wadatrip debe verificarse en su cuenta; la documentación
general y un flujo Sandbox exitoso no prueban autorización comercial Live.

## Cierre operativo: webhook Test permanente, 2026-10-13

El usuario autorizó continuar con la preparación. Se registró el endpoint de plataforma
`we_1UQ9nnAHNOOTJQKYwq9fga2A` en el contexto de la clave Test configurada:

- URL: `https://wadatrip.onrender.com/webhooks/stripe`.
- `livemode=false`, enabled, API version `2024-06-20`, 11 eventos del listado anterior.
- Se actualizó únicamente `STRIPE_WEBHOOK_SECRET` de Render. Se compararon las demás
  variables y conservaron sus valores. No se cambió la clave Test ni el estado de automation.
- Se desplegó el mismo commit `4bec9649cbe4fecea46cb4de20db46b8b9ab14d6` para cargarlo;
  deploy `dep-db76ti59fdbs73f8gcpg`, estado live. Sin código ni migraciones nuevas.
- El secreto anterior y el nuevo se conservaron cifrados con Windows DPAPI bajo logs
  ignorados por Git para recuperación, sin imprimirlos ni incorporarlos a documentos.

Se verificó previamente la asociación de un evento Test real de Checkout con su session,
booking y PaymentRecord. Stripe CLI se usó únicamente para pedir a Stripe un resend al
endpoint registrado: no hubo `stripe listen`, forwarding local, firma generada localmente
ni dependencia del browser. Las respuestas crudas del CLI no se imprimieron ni guardaron.

| Evidencia | Resultado después de dos entregas |
|---|---|
| Event | `evt_1UOnlvAHNOOTJQKYZuCia2Ut`, checkout.session.completed, Test |
| Booking | `cmv1lzu610003lo2284x8uaqs`, confirmed/paid/held |
| PaymentRecord | `aec9574e-9954-41b7-8b34-485e356993cc`, succeeded, resolution NULL |
| Importe esperado / recibido | 5000 / 5000 centavos USD, sin cambio |
| PaymentEvent | Una fila; processed, processed_at presente; attempts=1 después de la segunda entrega |
| Cupos del piloto | 19/20, sin cambio |
| Notificaciones de esa booking | 0 antes y después; no envío adicional por un éxito ya confirmado |

La primera entrega creó el registro del evento Test mediante el handler normal en la DB
existente. La segunda salió por deduplicación. No se realizaron escrituras SQL manuales,
nuevos cargos, bookings, refunds, cambios de cupos ni notificaciones externas adicionales.
El evento histórico pendiente permanece intacto; no se reprodujo ni se marcó processed.

**Límite de esta evidencia:** es entrega firmada real y deduplicación de una reserva que
ya estaba confirmada. Falta pagar una booking Test nueva, cerrar el browser antes de return
y acreditar la primera confirmación y emails exclusivamente por el webhook permanente.
El webhook Test ahora está disponible para esa prueba sin herramientas locales activas.

La siguiente intervención requiere confirmar país/activación de WADATRIP LLC y titular
legal del operador; consultar la habilitación del payout a Perú sin cambiar país ni acuerdo
por inferencia. Mensaje de soporte preparado arriba, todavía no enviado. Live sigue NO-GO
por modo, rutas alternativas, payout y pendientes históricos descritos en esta preparación.
