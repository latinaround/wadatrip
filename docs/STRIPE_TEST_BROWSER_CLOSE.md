# Sandbox: pago sin depender de la página de retorno

Objetivo pendiente: demostrar que un nuevo pago Test confirma la reserva por el
webhook permanente, sin que la página success/reconcile produzca primero el cambio.
Las pruebas anteriores de pago y reentrega de webhook no prueban por sí solas ese caso.

## Preparación verificada, 15 de octubre de 2026

Comprobación de solo lectura: `2026-10-16T03:42:17.1189814Z`.

- Backend sano. Stripe Test, Live desactivado.
- Webhook Test permanente habilitado en `/webhooks/stripe`, versión `2024-06-20`,
  con `checkout.session.completed` habilitado. No forwarding ni Stripe CLI requeridos.
- Tour `cmkn2oqsi0002ok2h71uczpj9`, perfil de Kiara existente; USD 50 por persona.
- Salida disponible: 30 de noviembre de 2026, 11:00 America/Lima; 10 cupos disponibles
  en ese instante. La API confirmó reservas abiertas y política `flexible_24h_v1`.
- Outbox: 4 enviadas; 0 pendientes, fallidas o con lease activo.
- No se creó reserva, Checkout, pago o correo durante esta preparación.

El navegador no está conectado a la sesión de Codex: la herramienta de inventario
devolvió cero navegadores. El usuario debe realizar la interacción del Checkout.
No crear otro operador ni pedir una nueva cotización para ejecutar esta prueba técnica.

## Ejecución por la dueña, pendiente

1. Usar la cuenta viajera de prueba existente, distinta de la operadora Kiara.
2. Abrir el tour, elegir la fecha indicada y 1 viajero; revisar/aceptar la política.
3. Iniciar Checkout y comprobar visualmente Sandbox/Test y USD 50. Si aparece Live,
   un importe distinto o datos incompatibles, detenerse. Nunca usar tarjeta real.
4. Completar el pago con datos sintéticos de Stripe Test. Cerrar la pestaña de
   Checkout después de enviar el pago y antes de llegar a la página de Wadatrip.
5. Avisar a Codex sin abrir todavía Mi cuenta/Mis viajes ni refrescar la reserva.
   El verificador realizará primero lecturas de DB y Stripe Test, sin reconciliar
   por API, reentregar eventos o marcar filas manualmente.

Si el retorno ocurrió antes de cerrar, registrar el caso como inconcluso respecto
al cierre del navegador. No presentarlo como prueba de independencia del browser.
Si cerrar abortó el pago, registrar su estado real: no suponer que se cobró ni
repetir la operación sin comprobar antes qué pasó con el intento original.

## Evidencia que debe comprobar Codex después

- Booking nueva, creada después del preflight y asociada al listing/cuenta esperados.
  Si hay varios candidatos, no elegir uno por intuición: identificar la referencia.
- Un PaymentRecord Test con importe esperado/observado 5000 centavos USD,
  Booking/Session/Intent asociados y estado succeeded.
- Booking confirmed/paid/held, un cupo consumido. Cualquier diferencia de ocupación
  requiere considerar tráfico concurrente; no aumentar capacidad para hacer pasar la prueba.
- PaymentEvent real `evt_` de Stripe Test procesado, con asociación correcta. Nunca
  imprimir raw payloads, correos, datos de tarjeta, cookies ni secretos.
- Notificaciones confirmed para traveler/operator: `source_event_id` corresponde
  al evento real procesado, no a una observación/reconciliación del browser.
  Verificar sent o registrar el fallo real; no confundir estado de envío con lectura.
- Inspección Test del pago y del evento mediante GET solamente. Comprobar modo,
  IDs e importes. La página success no se usa como primera fuente de evidencia.
- Solo después abrir Mis viajes y comprobar que muestra el mismo estado y las
  instrucciones guardadas, además de la visibilidad en el panel de la operadora.

No cancelar, reembolsar, borrar ni liberar esta reserva automáticamente. Cualquier
limpieza posterior se realiza por el lifecycle normal y se registra por separado.
No usar el resultado para aprobar payouts en Perú o Stripe Live.

RESULTADO ACTUAL: nuevo pago Test y confirmación asociada al webhook comprobados
el 16 de octubre; cierre del navegador antes del retorno NO DEMOSTRADO.

## Referencia anterior identificada durante la prueba — 2026-10-16

La dueña abrió Gestionar reserva y mostró `cmv8dgs9k0001n32kazm5rhv3`.
Una consulta acotada READ ONLY confirmó que fue creada el 14 de octubre de 2026
a las 17:16:50.073 UTC, antes del preflight. Está confirmed/paid/held, con
PaymentRecord Test succeeded, 5000 centavos USD y 1 viajero. Sus términos guardan
la salida del 30 de noviembre a las 14:30 UTC (09:30 America/Lima). El listing
actual tiene 11:00; no reescribir la hora de esa reserva histórica para igualarlos.

Las dos notificaciones confirmed figuran sent y asociadas al source event
`evt_3UQW5BAHNOOTJQKY1skNpsMV`, procesado el 14 de octubre a las 17:35:18.887 UTC.
Esto añade evidencia de una confirmación anterior asociada a un evento; no es una
reserva nueva ni demuestra que la dueña cerrara el navegador en la prueba pendiente.
No se llamó reconcile, no se contactó Stripe ni se cambió/reenvió/canceló nada.

## Nueva sesión de prueba abierta — 2026-10-16

Después de que la dueña abrió el Checkout, la consulta READ ONLY identificó una
única candidata nueva: `cmvbdugqz0001ma2ksf2xret8`, creada a las 19:50:46.859 UTC.
Estaba payment_pending con PaymentRecord pending. Un GET de la sesión asociada
usando exclusivamente credenciales Test confirmó `livemode=false`, importe
5000 centavos USD, sesión open, pago unpaid y metadata.booking_id coincidente.
Esto acredita el modo y la asociación en ese instante, no un pago completado.
No se llamó confirm, reconcile, resend, cancel ni se realizó ninguna escritura.
Usar esta referencia para la próxima comprobación; no confundirla con la anterior.

### Confusión de título y reservas aclarada

La dueña preguntó por el cambio Hiking in Lima -> Lima histórica/moderna y si
aparecerían ambas reservas. Se confirmó en código que Account y BookingDetails
leen `listing.title` actual, no un título contractual guardado. El cambio público
del 15 de octubre reutilizó el mismo listing; las horas de reservas anteriores
permanecen en sus booking_terms. La conservación de filas no preserva por sí sola
el título mostrado cuando el listing cambia. Pendiente evaluar un snapshot de título
para nuevas reservas, sin inventar/backfillear historia ni modificarla en esta revisión.

Consulta READ ONLY de la misma cuenta y listing, 16 de octubre: tres reservas Test:
`cmvbdugqz0001ma2ksf2xret8` (16 oct, 11:00 Lima, payment_pending/unpaid/held),
`cmv8dgs9k0001n32kazm5rhv3` (14 oct, 09:30, confirmed/paid/held), y
`cmv45va74000blo220gst6dkg` (11 oct, 09:30, cancelled/refunded/released).
Son referencias distintas; no existe evidencia de que la nueva ya esté pagada.
No crear una cuarta reserva para continuar la misma prueba ni cancelar ninguna
automáticamente. Los tres títulos mostrados proceden del mismo listing actual.

## Nuevo pago confirmado y consulta de cancelación — 2026-10-16

Después de pagar, la dueña mostró la página de confirmación para
`cmvbdugqz0001ma2ksf2xret8` y preguntó si la casilla de cancelación se confunde
con aceptar/leer condiciones. No reportó haber cerrado el browser antes del retorno.

Consulta READ ONLY posterior: Booking confirmed/paid/held; un PaymentRecord Test
`418484f7-4cbe-4ce9-8f3e-318e74ae1290`, succeeded, importe esperado/observado
5000 centavos USD, resolution NULL. Salida guardada 30 de noviembre 16:00 UTC
(11:00 Lima); cutoff de cancelación 29 de noviembre 16:00 UTC. No hay solicitud
de cancelación. Availability: 9 disponibles de 12; antes del nuevo intento había 10.

Las dos notificaciones confirmed figuran sent y tienen como source_event_id
`evt_3URHFoAHNOOTJQKY0PY2Fwvv`, payment_intent.succeeded, modo test, procesado
a las 19:57:26.584 UTC. La asociación del outbox con ese evento acredita la ruta
de confirmación por evento en el estado almacenado. No equivale a verificación
independiente de apertura del correo ni prueba literal de cierre del navegador.
No se ejecutó reconcile, reentrega, cancelación, reembolso ni escritura manual.

Recomendación UX pendiente de implementar: separar política informativa y acción
de cancelar; abrir una revisión explícita desde un botón secundario, mostrar efectos
y exigir una confirmación distinta de «leer condiciones», con opción de mantener
la reserva. La aceptación de política al reservar y la intención de cancelar deben
ser inequívocamente distintas. No se modificó código de cancelación en esta revisión.

## Revisión de cancelación implementada — 2026-10-16

Ante «entonces qué hacemos», se implementó y publicó únicamente la mejora frontend
en `30116a7c7ec4b75862393768d97d67bde9a78e7e`. La política se muestra sin una
casilla que parezca aceptación; «Review cancellation and refund» abre una revisión.
Keep my booking/Escape cierran sin POST. El diálogo enfoca por defecto mantener la
reserva; únicamente Confirm cancellation llama al endpoint existente con JWT y sin
importe de reembolso ni identidad cliente. El backend conserva toda autoridad.

Antes: 14 de los 15 casos del nuevo flujo fallaron. Después: 15/15 revisión, 18/18
resumen, 30/30 controles y 17/17 auth/política, 80 casos distintos. Build frontend y
diff check pasaron. Se probaron expiración de plazo, pagos pendientes/gratuitos,
401, fallo del request, doble clic, foco/Escape, móvil y controles en español;
solo fixtures/API interceptada, sin cancelaciones o emails reales.

Vercel `dpl_H8aJubpWDwpcZ68JgbFhGJSrHZa4` READY para el commit exacto. HTTP GET
de www.wadatrip.com confirmó los textos nuevos y el chunk de la ruta con la revisión,
sin la casilla antigua. Esto es comprobación del bundle desplegado; las pruebas
interactivas fueron locales. Render auto-deploy sigue off; no se desplegó backend.
Consulta READ ONLY final: la reserva `cmvbdugqz0001ma2ksf2xret8` sigue
confirmed/paid/held, Test, 5000 centavos y sin cancellation_requested_at.
No se hicieron peticiones de cancelación, llamadas Stripe ni cambios de datos.
