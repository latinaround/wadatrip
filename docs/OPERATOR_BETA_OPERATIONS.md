# Beta de operadores: procedimiento de apertura

Preparado el 27 de octubre de 2026. Máximo inicial: cinco cuentas invitadas.
Estado: preparado para revisión; no hay invitaciones enviadas ni apertura externa.
Responsable del piloto y decisiones de aprobación: la dueña de Wadatrip (Kiara/Danae).
Canal de soporte: `kiara@wadatrip.com` y la página Contact existente.

## Qué ofrece esta beta

Crear una cuenta, preparar el perfil de operador, guardar tours en borrador y
definir fechas/capacidad reales. No promete publicación, ventas, reservas pagadas
ni habilitación de payouts. País del servicio, residencia/entidad legal y país de
cobro son datos distintos; ofrecer un tour en Perú no convierte al titular en una
entidad peruana. El primer grupo opera en Perú; los criterios usan país y destino
explícitos, sin cambiar el motor de reservas.

Esta es una guía operativa. No sustituye términos legales, contrato comercial,
verificación profesional ni requisitos del proveedor financiero.

## Condiciones de entrada y revisión manual

1. La persona crea su propia cuenta y demuestra control del correo mediante el
   login normal. Nadie comparte su código, contraseña, JWT o MFA con soporte.
2. La dueña comprueba por llamada y referencias públicas quién ofrece el servicio,
   su relación con la empresa si aplica y su facultad para publicar ese catálogo.
   Correo verificado y provider `verified` por sí solos no acreditan licencia/KYC.
3. Revisar nombre público, destino, idiomas, descripción, inclusiones/exclusiones,
   precio/moneda, duración, zona horaria, punto de encuentro, política y cutoff.
   Verificar derechos de las fotos. Usar portadas revisadas o URLs públicas propias;
   cargas desde dispositivo y documentos siguen cerrados.
4. Confirmar fechas y cupos con el operador. Capacidad, guía, transporte, entradas
   y otras inclusiones críticas deben poder cumplirse antes de abrir ventas.
5. Registrar privadamente ID de cuenta/provider, país/destino, revisor, fecha,
   evidencia mínima de revisión, versión de aviso aceptada y siguiente acción.
   No guardar documentos, datos bancarios, códigos o datos de viajeros en Git/chat.
   Usar un registro privado autorizado; este bloque no añade almacenamiento nuevo.
6. Añadir solo el ID de cuenta revisado a la allowlist de preparación. Publicación
   permanece vacía. Comprobar lectura y edición propia y rechazo de otro operador.
   Revocar la admisión retirando el ID en todas las instancias; no borrar su cuenta,
   históricos, reservas o registros financieros.

## Aviso preparado para la persona invitada (no enviado)

> Te invitamos a una beta privada de Wadatrip para preparar tu perfil, tours y
> disponibilidad. Por ahora tus nuevos tours se guardan como borradores: participar
> no habilita cobros, payouts ni publicación automática. Usa información real y
> contenido que tengas derecho a publicar. No introduzcas documentos de identidad,
> datos bancarios ni información de clientes en fotos, descripciones o mensajes.
> El soporte nunca te pedirá códigos de acceso ni contraseñas. Para ayuda utiliza
> Contact en Wadatrip o kiara@wadatrip.com. Antes de publicar o vender revisaremos
> contigo el servicio y las condiciones comerciales aplicables.

Guardar aceptación del aviso y fecha en el registro privado antes de añadir el ID.
No afirmar que existe un consentimiento persistente en el backend: es manual en
este primer grupo. No publicar este texto como contrato legal aprobado.

## Soporte y seguimiento durante el grupo

La dueña revisa al menos diariamente incidencias y progreso mientras haya cuentas
activas. Si no puede cubrir el seguimiento, pausa nuevas admisiones. Cada operador
tiene un responsable, siguiente acción y fecha; no abrir más de cinco a la vez.

Para una incidencia registrar ID técnico, paso que falla, resultado esperado,
categoría y hora, sin tokens, documentos ni payloads privados. Incidente de acceso:
suspender nuevas admisiones y mutaciones afectadas, conservar evidencia técnica,
revisar sesiones/permisos con la administradora y verificar cierre antes de reabrir.
No modificar dinero ni inventario para cerrar un ticket de soporte.

Medir por destino: invitados revisados, cuentas admitidas, perfiles completos,
tours en borrador completos y salidas reales preparadas. Separar estos hitos de
publicación, pago, servicio completado y payout verificado. Sandbox no cuenta como
ingreso ni como cliente atendido.

## Aceptación desplegada requerida antes de la primera invitación

- Release exacto identificado, migración ensayada con copia autorizada actual,
  backup restaurable, rollout coordinado y configuración validada en cada servicio.
- Login, logout y sesión tras recargar funcionan; email repetido/paralelo se limita;
  administración requiere MFA de la cuenta real, leads/documentos permanecen cerrados.
- Miembro admitido prepara un borrador; cuenta no admitida y otra cuenta no acceden;
  intento de publicación no autorizado falla en Gateway y Provider Hub.
- Comprobación de Firebase: reglas/bucket/identidad exactos, rechazos de escritura
  anónima y cruzada, rutas antiguas cerradas y ningún documento por flujo público.
  El frontend con upload deshabilitado no prueba las reglas cloud.
- Preparación explícita, cero permisos de publicación, Live explícitamente apagado;
  webhook, conciliación y recuperación siguen disponibles para históricos.
- Soporte activo, registro privado autorizado y aceptación manual del aviso listos.

Si alguno falla, no enviar invitaciones. Dinero real requiere además corredor y
titular aprobados, costos/contratos revisados y el ensayo completo autorizado de
venta, servicio, conciliación y payout. La respuesta comercial de dLocal está pendiente.
