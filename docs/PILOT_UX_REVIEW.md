# Wadatrip — revisión de UX para el piloto

19 de octubre de 2026. Alcance: web marketplace, cuenta del viajero, reserva y
panel del operador. Revisión de código y registros existentes; no se ha realizado
una nueva sesión autenticada ni una prueba visual del sitio publicado.

## Evidencia y límites

El inventario de la herramienta de navegador devolvió cero navegadores conectados.
La herramienta de lectura web tampoco pudo recuperar home, catálogo ni el tour.
Ese resultado no demuestra una caída de Wadatrip. No se han evaluado en esta
sesión contraste, tamaños táctiles, recortes, rendimiento ni disposición real en
una pantalla móvil. Las pruebas de navegador previas están registradas en
[el historial del piloto](PILOT_LAUNCH_PACKET.md), con datos sintéticos separados
de la evidencia de pagos Test.

## Qué conservar

| Área | Evidencia en el código |
|---|---|
| Separación de cuentas | `Account.jsx`: `/account/trips` muestra viajes personales; los formularios de cuenta y anfitrión no se incrustan en esa vista |
| Navegación de regreso | Cuenta, viajes y panel de operador tienen destinos explícitos; no dependen solo del historial del navegador |
| Fecha de reserva | `TourDetail.jsx` usa `TourDatePicker` y consulta condiciones del backend para la fecha seleccionada |
| Nombre del viajero | Si falta, el texto explica que se guarda una vez y se conserva la fecha; botón «Save name and continue» |
| Solicitud de otra fecha | `TourDateRequests.jsx` colapsa la alternativa cuando ya hay fecha de reserva; la consulta no sustituye el pago |
| Confirmación | `CheckoutSuccess.jsx` consulta el backend autenticado; `bookingStatus.js` distingue confirmado, pendiente, cancelación y revisión |
| Cancelación | Se revisa antes de confirmar la acción; la política informativa no es un consentimiento para cancelar |
| Operador | Pestañas Bookings, Tours & availability y Host profile en `OperatorToursNew.jsx` |

## Ajustes propuestos, todavía no implementados

| Prioridad | Hallazgo | Cambio pequeño propuesto | Criterio de aceptación |
|---|---|---|---|
| Antes de promocionar el piloto | `Header.jsx` mantiene ocho destinos principales, incluidos productos/alertas fuera del foco comercial actual | Destacar Tours, Mis viajes al autenticarse, acceso del anfitrión y ayuda; llevar enlaces secundarios fuera del recorrido principal | Un viajero identifica dónde explorar y dónde consultar su reserva; no se elimina ninguna protección ni se reactiva un producto pausado |
| Antes de promocionar el piloto | `Tours.jsx` muestra «Online checkout available» para toda experiencia no gratuita; esa etiqueta no comprueba una salida ni la autorización Live | Usar una descripción neutral o un estado respaldado por el backend; distinguir publicado, fechas disponibles y venta habilitada | Una experiencia publicada sin fechas no promete disponibilidad; Test no se presenta como venta real habilitada |
| Antes de promocionar el piloto | `Tours.jsx` escribe «Top trusted host» de forma incondicional; home usa «Experiences ready to book now» sobre una selección de listings publicados | Usar «Anfitrión» y describir con precisión qué acredita cada verificación; no equiparar publicación con una salida reservable | Sin superlativos, reseñas, disponibilidad o verificación de servicio no demostrados |
| Antes de habilitar dinero real | `OperatorReadinessPanel.jsx` presenta «8/8» y «Payout account ready» sin mostrar el modo de pago en ese componente | Distinguir explícitamente preparación técnica en Test de aprobación para cobrar/pagar en Live; mantener la decisión authoritative en backend | Una cuenta Sandbox lista no parece una aprobación de pagos reales ni del calendario semanal de liquidación |
| Siguiente ajuste de claridad | Home, catálogo y pantallas operativas combinan traducciones con muchas cadenas inglesas fijas; Footer enlaza varios conceptos diferentes a la misma página | Traducir el recorrido principal con el i18n existente y conservar únicamente etiquetas que describen el destino real | El idioma elegido cubre instrucciones de reserva/estado/errores; ningún enlace promete una pantalla que no ofrece |
| Revisión visual pendiente | Sin acceso visual actual no se puede asegurar la ergonomía de móvil | Revisar home, catálogo, selector de fecha, confirmación, Mis viajes y operador a 390 y 1440 px | Sin desplazamiento horizontal imprevisto; etiquetas y botones legibles; foco de teclado visible; estados de carga/error útiles |

Los hallazgos sobre etiquetas son evidencia de código. Su efecto en conversión y
la reacción de un viajero real son hipótesis que se deben observar en el piloto.
No se requiere rediseñar el sitio ni añadir chat, AI, nuevas alertas o mobile.

## Orden de ejecución recomendado

1. Terminar la confirmación operativa de Kiara en la
   [ficha del piloto](PILOT_PRESENTACION.md#8-confirmación-operativa-para-kiara).
2. Revisar un diff pequeño de navegación y textos de disponibilidad/confianza.
   No sustituir validación de servidor por lógica de interfaz ni inventar estados.
3. Verificar las rutas y controles afectados con las pruebas existentes y el build.
4. Publicar únicamente el cambio revisado, preservando la separación Test/Live y
   comprobando el estado de Auto-Deploy antes de sincronizar los commits pendientes.
5. Revisar la experiencia visual publicada cuando haya navegador disponible.

Este documento propone cambios; no los aplica. No hay nuevas pruebas ejecutadas
por esta revisión, escrituras en producción, pagos, correos, staging, commits ni
deploys. Las confirmaciones operativas pendientes y la autorización de pagos reales
siguen siendo condiciones separadas de la calidad de las pantallas.
