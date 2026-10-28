# Community por destino — primera entrega web

Estado al 25 de octubre de 2026: implementado y probado localmente, sin staging, commit, push, despliegue o migración de producción. La actividad de pruebas es sintética. Stripe Live y payouts no se han modificado.

## Resultado visible

- `/community` permite elegir un país y, opcionalmente, ciudad/región, sin crear cuenta ni comprar. Puede abrirse un destino sin tours ni publicaciones; el estado vacío invita a hacer la primera pregunta, sin inventar miembros o consejos.
- Entrada Community en el header y desde los filtros de Tours. El enlace de vuelta al catálogo conserva `country_code` y ciudad. No se afirma distancia física ni ubicación actual de los participantes.
- `/community/threads/:id` es un enlace público compartible. Preguntas y consejos reciben respuestas; el autor puede marcar una respuesta ajena como útil, resolver su pregunta o retirar su contenido de la vista pública. Útil no significa verificación oficial o reseña de compra.
- Una cuenta activa con correo verificado y nombre público puede publicar. El formulario avisa que texto y nombre serán públicos y solicita confirmación expresa. Los roles de guía/operador proceden del provider aprobado del usuario, nunca del body. Se muestra la declaración de quien recomienda su propio servicio.
- Reportes por categorías, bloqueo personal y desbloqueo. El bloqueo oculta publicaciones para esa cuenta e impide nuevas respuestas entre los participantes en sus propias preguntas; el contenido público sigue accesible para visitantes. No se promete privacidad frente a un visitante anónimo.
- `Actualizar` vuelve a leer la conversación y conserva un borrador no enviado mientras la lectura sea exitosa. No hay presencia, suscripciones, push ni actualización en tiempo real en esta entrega.
- UI de Community en inglés, español y francés, reutilizando el selector de idioma. Se revisaron escritorio y ancho móvil, enlaces, teclado del reporte y contraste. No se cambió la política global existente de selección/persistencia de idioma.
- `/admin/community` integra la revisión de reportes en el panel existente: ocultar contenido o cerrar sin ocultar. Requiere permisos administrativos y prueba MFA vigente vinculada al JWT, incluso si el switch global de compatibilidad de MFA está desactivado. Las lecturas y decisiones quedan auditadas; las decisiones y el audit se guardan en la misma transacción.

El CTA comercial actual lleva a Tours del destino. No hay nuevas tarjetas de ofertas individuales, reservas desde el texto de una respuesta, chat privado, matching de personas, importación de WhatsApp ni IA autónoma.

## Contrato y seguridad

Gateway/PostgreSQL son autoridad de contenido nuevo, identidad, permisos y moderación. La implementación no lee ni migra publicaciones históricas de Firestore y no altera su autoría. Mobile Community continúa como prototipo separado; no declarar paridad de Community web/mobile hasta alinear esa pantalla con esta API.

Se añaden cuatro tablas: `community_threads`, `community_replies`, `community_reports`, `community_blocks`. Nuevas FK a usuarios y contenido, claves únicas por remitente/request ID, índices de destino/fecha, estados y longitudes con CHECK, reportes de exactamente un objeto y un índice parcial que limita a una respuesta útil por conversación. Las relaciones añadidas al modelo Prisma de usuarios no añaden columnas a la tabla histórica `users`.

Los destinos se agrupan mediante país ISO2 y nombres normalizados de ciudad/región (espacios, mayúsculas y acentos). No es un registro geográfico certificado: alias traducidos de una ciudad y lugares homónimos sin región pueden seguir requiriendo curación. Las vistas existen por consulta, sin precargar salas de todos los países ni fabricar tráfico. Las vistas sin ciudad permiten explorar el país; una ciudad/región seleccionada identifica ese contexto normalizado.

Escrituras de un usuario se serializan mediante `SELECT id FROM users WHERE id = $1 FOR NO KEY UPDATE`, dentro de una transacción corta. Se revalidan estado y correo del actor. Las modificaciones de conversación toman también su fila en ese mismo orden. Se utiliza NO KEY UPDATE para no bloquear innecesariamente el KEY SHARE de las FK existentes. La moderación serializa la decisión sobre el reporte. No hay llamadas a procesadores, correo ni geocodificadores dentro de estas transacciones.

Límites iniciales por usuario: 2 preguntas/consejos por minuto y 20 por día; 10 respuestas por minuto y 100 por día; 5 reportes por minuto y 20 por día; máximo 500 bloqueos personales. Se verifican bajo el lock del usuario. Listas de 20 elementos y máximo 100 páginas. La moderación es humana; estos límites no equivalen a detección completa de abuso.

Cada envío lleva UUID v4. La unicidad por usuario y los locks evitan repetir una escritura al reenviar. El navegador conserva solo el nonce bajo una clave de sesión derivada de cuenta, conversación y hash del contenido; no persiste texto, correo o JWT en ese registro. Se elimina tras éxito confirmado. Un resultado incierto permite reintentar el mismo envío en esa pestaña. No hay replay automático al volver a iniciar sesión. Cambiar de cuenta/destino limpia el contexto visual; una preparación tardía después del logout no envía el mensaje.

Las respuestas públicas seleccionan nombre, rol derivado y campos públicos; no correo, teléfono, documentos, credenciales ni referencias financieras. El contenido se renderiza como texto, sin HTML, adjuntos o previews ejecutables. Un filtro de excepciones evita que un error de ORM publique argumentos de consultas o mensajes en el logger de Nest. Solo registra una categoría técnica segura.

## Evidencia

| Validación | Resultado | Tipo de evidencia |
|---|---:|---|
| Community backend | 41 pasan | Nest HTTP/JWT reales y fixture Prisma sintético |
| Cliente y reintentos | 7 pasan | Servicio real, almacenamiento y HTTP sintéticos |
| Community web | 18 pasan | Chrome, aplicación completa en localhost, APIs interceptadas |
| Migración/concurrencia | 13 pasan | PostgreSQL real desechable y dos clientes independientes |
| Regresión del núcleo | 304 pasan | Suites separadas de seguridad, traveler auth, precio, capacidad, pagos/eventos, migraciones, cancelación, notificaciones, date requests y administración |
| Total de checks distintos | **383** | No incluye repeticiones de QA visual |

Prisma validate/generate pasan con configuración explícita sin dotenv y datasource sintético no conectable. Common, DB, Gateway y Provider Hub compilan con TypeScript local; el frontend compila con configuración pública sintética y API localhost. Yarn no encontró `tsc` en este Windows, por lo que se ejecutó el mismo compilador local directamente; no se instalaron ni actualizaron dependencias para ocultar el fallo del wrapper. Diff check pasa.

Los 13 checks PostgreSQL aplicaron la cadena completa a una DB nueva con marcador, usuario y puerto de pruebas verificados. Comprobaron locks/dedupe entre dos conexiones, límites concurrentes, FK, UNIQUE, CHECK, selección útil, rollback, reportes/audit y ausencia de bookings/payments/inventory creados. Esto no es un ensayo sobre una copia actual de producción ni una prueba de carga.

Contraejemplos retenidos antes de su corrección: coerción de país no-string, herencia de un bypass global de MFA, navegación lista/detalle con datos de la vista anterior, envío tardío tras logout y error de persistencia propagado al logger. PostgreSQL detectó además que un CHECK permitía resolución NULL por la semántica de NULL: se corrigió antes de probar de nuevo en otra DB nueva. No se editó `_prisma_migrations` ni se usó resolve. El harness tenía también selectores de login/idioma incorrectos y una espera de respuesta insuficiente; se distinguieron de los errores del producto, sin relajar los controles del sistema.

La QA visual encontró contraste insuficiente sobre el fondo global y una etiqueta de textarea que incorporaba el valor. Se corrigieron con fondo claro local y asociación explícita de label/id. Las capturas finales usan nombres y mensajes sintéticos, no usuarios o sesiones reales.

Evidencia ignorada por Git: `logs/community-20261023/`, incluyendo fallos iniciales, resultados PostgreSQL de ambas DBs, regresiones, hashes y capturas. El directorio conserva la fecha de inicio aunque el cierre es del 25 de octubre. La instancia PostgreSQL empleada es la desechable existente de P0 #5, iniciada con autorización y guardas de etiqueta, localhost y ausencia de volúmenes. No se accedió a una DB de producción.

## Activación y recuperación: pendiente de autorización/review

`ENABLE_COMMUNITY` permanece sin configurar en producción y el código exige el valor literal `true`. La ruta de status puede anunciar disponibilidad sin leer tablas. No se añadieron migraciones a build, generate o startup; la migración solo se aplica con una orden explícita de deploy.

1. Revisar este bloque y aislar el release conservando la versión web ya publicada, incluidas sus correcciones de sesión y recuperación de checkout. El `main` primario es antiguo respecto de publicaciones directas anteriores: no desplegarlo ni hacer push indiscriminadamente. Los archivos modificados con trabajo previo necesitan comparación de contenido, no solo una lista de nombres para staging.
2. Ensayar la migración nueva sobre una copia actual autorizada y verificar lineage, backup recuperable, FK/índices y duración/locks. La migración solo crea tablas nuevas, usa BEGIN/COMMIT y timeouts locales de lock 3s / sentencia 60s. Un fallo hace rollback del DDL; investigar el estado de Prisma antes de cualquier acción de recuperación, sin resolve automático.
3. Mantener Community desactivada mientras se migra y publica el backend. El schema aditivo puede coexistir con código antiguo; el código nuevo no consulta sus tablas si la función está desactivada. Publicar frontend después del backend compatible.
4. Verificar el acceso de la moderadora real con MFA, asignar responsable y procedimiento para reportes, abuso repetido, información privada y conservación de contenido. La UI actual oculta/retira contenido, no lo borra físicamente ni implementa una política completa de eliminación de cuentas.
5. Con autorización explícita, activar el flag y hacer aceptación con las cuentas reales en un destino, sin pagos: lectura anónima, login que conserva destino, publicación pública consciente, respuesta de otro usuario, helpful/resolve, reporte, moderación, bloqueo y logout/cambio de cuenta. Probar también un destino vacío fuera de Perú.
6. Para detener escrituras/lecturas del módulo, desactivar el flag y conservar tablas/contenido. Un rollback de código no requiere borrar tablas ni cambiar reservas/pagos. No usar DROP como recuperación de primera opción.

La comunidad gratuita puede tener su propio gate de publicación; no necesita habilitar Stripe Live. Los cobros/payouts reales conservan sus aprobaciones y condiciones operativas independientes.

## Manifiesto de archivos de esta entrega

1. `apps/gateway/src/app.module.ts`
2. `apps/gateway/src/controllers/community.controller.ts`
3. `apps/gateway/src/services/community.service.ts`
4. `apps/gateway/src/services/community-exception.filter.ts`
5. `libs/db/prisma/schema.prisma`
6. `libs/db/prisma/migrations/20261024000000_destination_community/migration.sql`
7. `apps/web/src/App.jsx`
8. `apps/web/src/components/Header.jsx`
9. `apps/web/src/pages/Tours.jsx`
10. `apps/web/src/pages/Community.jsx`
11. `apps/web/src/services/community.js`
12. `apps/web/src/utils/communityCopy.js`
13. `apps/web/src/admin/AdminApp.jsx`
14. `apps/web/src/admin/Community.jsx`
15. `scripts/community.test.cjs`
16. `scripts/community-client.test.cjs`
17. `scripts/community-ui.test.cjs`
18. `scripts/community.postgres.test.mjs`
19. `docs/COMMUNITY_AND_BOOKING_CHAT_PLAN.md`
20. `docs/COMMUNITY_IMPLEMENTATION.md`

Los cambios anteriores de `.yarn/install-state.gz`, `apps/web/src/pages/Account.jsx`, `package.json`, archivos de pagos, autenticación, readiness y demás trabajo ajeno se conservaron por hash. No hay cambios de mobile en este bloque. No staged, commit, push o deploy.
