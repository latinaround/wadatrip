# Wadatrip: notas operativas de reservas y pagos

## Alcance actual

El marketplace web usa el Gateway como frontera de autenticación y negocio. La app móvil está en otro repositorio y no forma parte de este bloque.

La fuente de verdad de Wadatrip es PostgreSQL:

1. `Listing` aporta precio, moneda, fecha, hora, zona horaria, capacidad y política.
2. El Gateway valida identidad mediante JWT y crea la booking dentro de una transacción.
3. La booking conserva el total calculado y un snapshot de los términos aceptados.
4. La capacidad se reserva bajo lock de la fila del listing.
5. `PaymentRecord` representa el intento financiero y sus referencias externas.
6. Stripe solamente procesa el importe que Wadatrip ya calculó.
7. El webhook firmado observa Stripe y el backend decide el estado de booking e inventario.

## Reglas automatizadas

- No se crea una booking sin traveler autenticado.
- No se aceptan fechas pasadas, slots inexistentes ni cantidades inválidas.
- Una reserva moderna se cierra según `booking_cutoff_hours` antes de la salida.
- La política `flexible_24h_v1` devuelve el importe completo si el traveler cancela con al menos 24 horas.
- Una cancelación posterior no genera reembolso automático.
- Una cancelación durante un pago pendiente conserva la capacidad hasta verificar el resultado externo.
- Un pago tardío nunca convierte una booking cancelada en confirmada sin una decisión válida de inventario.
- Los refunds normales usan una clave idempotente por `PaymentRecord`.
- Reembolsos ambiguos, históricos o con evidencia incompleta quedan en revisión manual.
- Los tours gratuitos siguen las mismas reglas de fecha y capacidad y no llaman a Stripe.

## Activación controlada

El worker de refunds se inicia únicamente cuando `ENABLE_PAYMENT_AUTOMATION=true`. Debe permanecer desactivado hasta completar una prueba PostgreSQL desechable y una prueba Stripe Test.

Orden operativo:

1. Crear una base PostgreSQL local desechable, sin datos reales.
2. Aplicar la migración `20260923000000_booking_policy_automation` allí.
3. Ejecutar locks concurrentes, cancelación durante pago, webhook duplicado y refund idempotente.
4. Revisar migración y diff; crear commit separado.
5. Tomar backup autorizado de Render y ejecutar preflight histórico.
6. Aplicar la migración en Render solamente si el preflight no encuentra un bloqueo.
7. Desplegar Gateway y Provider Hub con `ENABLE_PAYMENT_AUTOMATION=false`.
8. Completar Stripe Test E2E y revisar estados en PostgreSQL.
9. Activar `ENABLE_PAYMENT_AUTOMATION=true` en Stripe Test y observar un ciclo completo.

## Señales mínimas para investigar dinero

Los logs estructurados deben correlacionar únicamente IDs técnicos y estados:

- `booking_id`
- `payment_record_id`
- `processor`
- `checkout_session_id` o `payment_intent_id`
- `event_id`
- idempotency key
- estado anterior y nuevo
- acción de inventario
- importe/moneda esperados y observados
- categoría de error

No registrar tokens, secretos, payloads crudos de Stripe ni PII.

## Estado de esta sesión

- Builds de common, Gateway, Provider Hub y web: correctos.
- Prisma validate/generate: correctos.
- Pruebas de seguridad, auth, precio, capacidad, política y ciclo de pagos: correctas.
- PostgreSQL desechable: validado; migración completa, locks, rollback, webhooks duplicados y carreras de cancelación/pago pasaron con dos clientes Prisma.
- Stripe Test E2E: validado con Checkout alojado, importe server-authoritative de USD 120, webhook firmado, confirmación y replay duplicado idempotente.
- Render, Vercel, DNS, Stripe Live y producción: sin cambios.
- Este bloque se mantiene aislado para el commit de automatización; los cambios históricos no relacionados permanecen fuera.

## Condición para el primer cobro real

No habilitar Stripe Live mientras exista un refund sin prueba Stripe Test o un operador sin disponibilidad, política, punto de encuentro y configuración de payout verificada.
