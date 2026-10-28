# Conversaciones en Wadatrip: alcance acordado

Fecha de inicio: 23 de octubre de 2026. Actualización: 25 de octubre de 2026. Community web tiene una primera implementación local; ver `COMMUNITY_IMPLEMENTATION.md`. El chat privado sigue planificado. Nada de este bloque está publicado ni autoriza modificar producción.

## Objetivo

Permitir que una cuenta de Wadatrip sirva para descubrir, conversar, conectar y reservar. La comunidad debe aportar utilidad antes de una compra; el chat de una reserva debe ayudar a prestar el servicio contratado. Los espacios públicos y privados tendrán permisos y expectativas de privacidad separados.

Orden acordado con la dueña:

1. Chat privado del viajero con el operador, ligado a una reserva existente.
2. Community por destino buscado, disponible para cualquier país/ciudad admitido por el buscador. Lima es el primer escenario de aceptación, no una restricción del producto. Lectura pública gratuita; cuenta para publicar/responder; sin exigir una compra.
3. Mensajes privados generales mediante solicitud aceptada, después de validar participación y capacidad de moderación.

La aclaración posterior de la dueña sobre acceso global gratuito priorizó la primera implementación de Community web por destino. El chat privado de reservas queda separado como siguiente entrega; no presentar las preguntas públicas actuales como mensajes privados.

## Realidad verificada en el repositorio

- Gateway/PostgreSQL controlan identidad, propiedad de reservas, inventario y pagos.
- En el schema Prisma y en Gateway/web revisados no aparecen modelos o servicios de conversaciones privadas de reservas que podamos declarar terminados o reutilizar como un chat funcional.
- Mobile tiene `CommunityScreen.js` con publicaciones y respuestas en Firestore. Usa la identidad del SDK Firebase y puede construir un autor desde su correo o `Anonymous`; eso no equivale al contrato de identidad actual de Gateway.
- Mobile tiene componentes de mapa nativos/web y una pantalla de señales por destino. Su existencia no prueba que estén listos para uso público o que haya una búsqueda real por distancia.
- La web resuelve ubicación a país/ciudad para filtrar tours. No presentar ese filtro como una distancia exacta ni publicar la ubicación personal del viajero.

## Primera entrega: chat de la reserva

Entrada propuesta: acción «Message host / Mensaje al operador» en la reserva del viajero y «Message traveler / Mensaje al viajero» en la reserva del operador. Historial compartido entre web y mobile mediante la misma API autenticada y persistencia PostgreSQL.

Antes de implementar, concretar el contrato pequeño de datos y endpoints usando las utilidades de autorización existentes. Requisitos:

- El servidor identifica al usuario y comprueba su participación en cada lectura, envío y marca de lectura. Conocer un booking ID, tener un rol de guía o proporcionar un correo no concede acceso.
- El primer acceso operativo se limita a una reserva confirmada, incluida una reserva gratuita confirmada. Las consultas previas a reservar mantienen su propio flujo y no crean reservas ficticias.
- Definir explícitamente qué acceso permanece tras cancelación/finalización y ante cambios de propietario del provider. Conservar el historial no concede automáticamente acceso a personas nuevas.
- Acceso administrativo limitado a funciones autorizadas de soporte/moderación, con MFA y auditoría según el contrato existente; sin un buzón abierto para cualquier administrador por defecto.
- Mensajes de texto, paginación, límite de longitud, límite de envíos e idempotencia por mensaje del remitente. Un reintento no debe duplicar el mensaje.
- Lectura/revisión persistente, independiente del estado de la reserva. Leer o enviar nunca cambia pagos, cancelaciones, inventario, términos o confirmación del tour.
- Reportar, bloquear contacto abusivo y revisión por soporte. Definir la operación de soporte cuando bloquear impida coordinación necesaria; no prometer moderación automática completa.
- Nombres públicos y rol del autor obtenido del servidor; sin publicar correos, teléfonos o ubicación personal por defecto. No registrar contenido de mensajes ni credenciales en logs.
- Estado de error y reintento honesto. Sin confirmaciones visuales de envío antes de persistir, ni dependencia de un correo para acceder a la conversación.

Validación obligatoria: dos participantes correctos; otro viajero/operador sin acceso; cuenta suspendida; sesión cambiada mientras hay peticiones pendientes; mensaje duplicado concurrente; paginación; contenido mostrado como texto; límites de envío; reporte/bloqueo; acceso tras cancelación; manejo explícito de transferencia del provider; paridad web/mobile. Pruebas aisladas antes de cualquier aceptación con cuentas reales.

## Segunda entrega: Community abierta por destino

- Corrección explícita de la dueña: Community sigue el destino que cualquier persona busca y debe servir para atraer visitas, aunque el destino todavía no tenga tours publicados. No limitar el acceso a Lima ni exigir una reserva para explorar.
- Leer preguntas y recomendaciones será gratuito y público en la web. Publicar, responder, guardar o participar en conversaciones requiere la cuenta de Wadatrip y los permisos correspondientes. Avisar claramente que una publicación comunitaria será pública antes de enviarla; los chats privados mantienen sus permisos privados.
- Una búsqueda por país y ciudad abre su vista de destino sin requerir que un administrador cree manualmente cada comunidad. Usar identificación canónica de país/destino, no solo el texto libre de una ciudad, para evitar mezclar lugares homónimos. No crear en masa salas, mensajes ni miembros ficticios.
- Propuesta de navegación: destino elegido con dos entradas claras, «Tours» y «Community». Cada destino puede tener un enlace público compartible desde grupos o redes. Web y mobile deben resolver el mismo destino y contenido.
- Si no hay tours, mostrarlo con honestidad y mantener las preguntas comunitarias disponibles. Si tampoco hay publicaciones, mostrar «Todavía no hay preguntas sobre este destino. Haz la primera pregunta». Ese vacío no significa servicio disponible ni prueba demanda.
- El primer ensayo será Lima; incluir como prueba un país/ciudad sin tours ni contenido. Una persona anónima puede explorar y luego registrarse para participar, conservando el destino/contexto tras el login. Mobile hoy protege su stack principal con login: habilitar exploración pública requiere revisar esa navegación, no quitar autorización a escrituras o reservas.
- La captación orgánica es una hipótesis a medir, no una garantía de tráfico. Primero contenido real y útil; publicación/indexación y difusión externa son pasos separados. No fabricar recomendaciones ni páginas vacías de contenido promocional para aparentar cobertura mundial.
- Aclaración de la dueña: la información y las conversaciones forman parte del proceso comercial. Las personas deben poder ver que alguien necesita ayuda en un destino, responder entre ellas y conservar información relevante para otros visitantes.
- Primera organización propuesta: «Preguntas / Necesito ayuda» y «Consejos y recomendaciones», filtrados por destino elegido. La visibilidad corresponde al espacio comunitario al que la persona decidió publicar; nunca convertir mensajes privados de reservas en publicaciones públicas.
- Cada pregunta muestra destino, tema, nombre público, rol del autor y fecha. Otros miembros pueden responder; el autor puede marcar una respuesta como útil o la pregunta como resuelta. «Útil» no significa información oficialmente verificada.
- Conservar las respuestas en su contexto y permitir compartir el enlace de la conversación. Destacar consejos requiere un criterio editorial/moderación y fecha visible; no tratar como vigente o verdadero todo contenido popular.
- El operador puede recomendar una experiencia propia con su relación comercial visible y un enlace al tour real. El botón lleva al flujo normal de fechas/precio/reserva; una conversación no reserva inventario ni autoriza cobros.
- Mostrar preguntas del destino que el usuario eligió. Los avisos proactivos por ciudad/tema requieren suscripción voluntaria y control para desactivarlos; no exponer GPS ni inferir que alguien se encuentra físicamente allí.
- Medir consultas que derivan en reservas reales y servicios completados, separando Sandbox y sin presentar una recomendación, un clic o un mensaje como una venta.
- Entrada Community desde la cuenta, con adhesión voluntaria al destino y perfil público básico. Verificar el correo no equivale a verificar identidad legal o experiencia profesional.
- Preguntas, recomendaciones y respuestas asociadas a un lugar/destino. Identificar si el autor es viajero o guía y si recomienda su propio servicio.
- Mostrar fecha del contenido y distinguir recomendaciones de reseñas derivadas de una experiencia realizada. La actividad Sandbox no genera una reseña de compra real.
- Reutilizar país/ciudad y tours publicados reales. Un consejo no garantiza precio, disponibilidad, reserva ni calidad verificada de un lugar.
- Ubicación personal privada; el destino puede seleccionarse manualmente. La ubicación de un lugar recomendado y la ubicación de quien escribe son conceptos diferentes.
- Corregir la autoría, autorización y moderación del prototipo antes de exposición pública; no copiar el patrón de publicar correos ni abrir Firestore para hacer funcionar la interfaz.
- Sincronizar identidad y permisos con Gateway y definir una única autoridad del contenido nuevo; cualquier tratamiento de publicaciones históricas de Firestore requiere revisión explícita, sin inventar autores ni migrar silenciosamente.
- Comenzar con usuarios reales que participen voluntariamente. No fabricar conversaciones, viajeros, reseñas ni contadores de actividad.

## Captación desde grupos y redes

La dueña participa como miembro en grupos de viajeros. El primer canal será compartir consejos propios y enlaces relevantes siguiendo las reglas de cada grupo. El viajero elige visitar Wadatrip y unirse a su comunidad. No asumir acceso a mensajes o teléfonos de los miembros, ni permiso para enviarles campañas privadas.

Medir progresivamente visitas atribuidas, participación útil, consultas y reservas reales, separando Sandbox. Validar utilidad y moderación antes de ampliar ciudades, grupos, funciones o automatizaciones de ventas.

## Próximo hito comercial: conversación a reserva

Objetivo confirmado por la dueña: convertir ayuda relevante en una venta. Hoy
Community enlaza al catálogo filtrado por destino. Adjuntar un tour reservable a
una respuesta y atribuir la conversión todavía no está implementado.

El siguiente incremento será una recomendación de tour con relación comercial
visible y enlace a la ficha real. El servidor comprobará publicación, propiedad
cuando se presente como oferta propia y destino. La ficha seguirá consultando
precio, fechas y cupos; si no hay salida, ofrecerá una solicitud de fecha. La
cuenta, aceptación de política y pago continúan en el flujo existente.

La evidencia de conversión debe distinguir clic, solicitud, booking, pago,
servicio completado y payout verificado. Un hilo puede originar varias consultas;
una misma booking no puede sumar ingresos dos veces. Nunca contar actividad
Sandbox como venta. No recolectar mensajes privados ni contactos de grupos para
atribución. Este hito sigue pendiente; la limpieza y los tests actuales no lo
habilitan ni habilitan cobros reales.

## Límites operativos

No activa pagos Live, payouts, una suscripción social, nuevos proveedores, chat autónomo con IA, extracción de grupos, envío de campañas, despliegues ni cambios de producción. La aprobación comercial de pagos internacionales y la operación real del piloto siguen siendo gates independientes. Las funciones descritas aquí aún requieren implementación, pruebas y revisión de release.
