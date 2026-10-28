# Piloto — navegación y búsqueda por destino

19 de octubre de 2026. Implementación local pendiente de revisión y publicación.

## Cambios

- Menú principal centrado en Tours, Mis viajes para usuarios autenticados y Ayuda.
  Se conservan acceso del anfitrión, cuenta, login/logout y rutas secundarias.
- En móvil se conserva un acceso explícito a Mi cuenta además de Mis viajes.
- Países seleccionados y nombres de país en enlaces se normalizan a códigos antes
  de consultar el catálogo. Al cambiar país se limpia la ciudad anterior.
- Las sugerencias del país seleccionado no arrastran ciudades de otro país.
- Resultado vacío por destino con opción de limpiar filtros cuando hay filtros activos.
- Etiquetas generales de checkout y «Top trusted host» sustituidas por textos que
  invitan a consultar fechas y condiciones. La portada no presenta todos los
  listings publicados como salidas listas ni todos los perfiles como verificados.
- Textos nuevos del catálogo disponibles en inglés, español y francés. Esto no
  significa que toda la aplicación haya sido traducida en este bloque.
- El endpoint privado existente de estado de Connect incluye `payment_mode`,
  derivado de la configuración del servidor y después de comprobar ownership.
  No inicia operaciones nuevas ni modifica permisos, cuentas o pagos.
- El panel distingue Test, Live y modo no verificado. El checklist no autoriza
  cobros reales ni promete un calendario de liquidación. Una versión anterior del
  backend sin el nuevo campo produce «Payment environment not verified».

## Lectura del catálogo público

Consultas GET a `/listings/search`, sin escrituras, sin DB directa ni llamadas a Stripe:

| Filtro | HTTP | Listings publicados devueltos | Códigos devueltos |
|---|---|---|---|
| PE | 200 | 9 | PE |
| EC | 200 | 0 | Ninguno |
| CO | 200 | 0 | Ninguno |

Es evidencia puntual del catálogo, no de fechas disponibles ni de que todos esos
operadores estén aprobados para pagos reales. Cero resultados en Ecuador/Colombia
no es un fallo de conexión ni autoriza crear tours o disponibilidad ficticios.

## Validación

- Regresión inicial de descubrimiento: 2/9 pasaron con el build anterior. Se
  reprodujeron problemas de enlace con nombre de país, ciudad retenida, textos y
  navegación. Después se corrigió una espera de red del propio test para evitar
  una carrera al pulsar Quito; no se alteró código productivo para esa espera.
- Se añadieron casos de ubicación sintética y permiso denegado.
- Descubrimiento final: 11/11, API simulada y origen localhost.
- Cuenta y separación viajero/operador: 15/15, localhost y fixtures.
- Controles web: 30/30, localhost y fixtures.
- Readiness, configuración existente de Connect y autenticación traveler: 34/34.
- Seguridad: 52/52, rutas HTTP locales con Prisma sintético.
- Total: 142 pruebas reportadas por esas suites. No son nuevas ventas ni un nuevo
  Stripe E2E. La ubicación real del dispositivo no se utilizó: posición, permiso
  y respuesta de geocodificación fueron simulados.
- Se actualizaron dos expectativas antiguas de texto/navegación para reflejar
  «Upcoming bookings» y el menú simplificado; la cobertura de autorización y
  navegación se conserva en las pruebas funcionales.
- Builds locales de frontend y gateway correctos. Vite mantiene una advertencia
  de tamaño de bundle; no se ha realizado una optimización de rendimiento aquí.
- Se comprobaron los hashes de los archivos previamente modificados/untracked:
  permanecen intactos. Staging vacío.

No hay nueva inspección visual de producción ni garantía sobre la disponibilidad
del geocodificador externo. «Usar mi ubicación» requiere permiso del viajero y busca
su posición actual; el país/ciudad manual sirven para planificar otro destino.
El matching de nombres de ciudad en la API existente sigue siendo exacto: para
evitar diferencias de escritura, elegir la ciudad sugerida. Este bloque no introduce
un buscador geográfico global ni cambia los códigos históricos almacenados en DB.

No se hicieron commits, push, deploy, cambios de variables, migraciones, nuevas
reservas, correos, pagos ni cambios mobile. El modo Live sigue siendo una aprobación
separada. Para publicar backend, recuperar acceso a Render y comprobar Auto-Deploy;
para publicar frontend, revisar este diff junto a los dos commits locales anteriores
que ya están en Vercel pero todavía no se han sincronizado con `origin/main`.

## Ampliación: destinos sin inventario

La dueña aclaró que el catálogo debe permitir buscar otros países aunque aún no
tengan tours. La lista compartida pasa de 14 destinos a los 249 códigos ISO de
países/territorios oficialmente asignados. Referencia de datos consultada:
https://github.com/unicode-org/cldr/blob/main/tools/cldr-code/src/main/resources/org/unicode/cldr/util/data/external/iso_3166_status.txt

- Nuevo selector buscable del catálogo, con componentes Popover/Command ya
  presentes en el proyecto. Nombres en inglés, español y francés; búsqueda sin
  distinguir mayúsculas ni acentos, independiente del idioma mostrado.
- Buscar South Africa o Sudáfrica selecciona ZA. Se elimina el recorte de nombres
  desconocidos que antes podía convertir South Africa en SO (Somalia).
- Países desconocidos no se convierten silenciosamente en otro código.
- Una región sin sugerencias de ciudades no hereda las de Perú. La ciudad se
  puede escribir manualmente; no se han creado tours, ciudades ni fechas ficticias.
- El estado vacío se conserva hasta que la API devuelva publicaciones para ese
  destino. La prueba de una futura publicación en Sudáfrica es solo un fixture
  local; no es una publicación real ni prueba de onboarding o payouts en ese país.
- La lista compartida sigue disponible para los formularios de cuenta y operador.
  Elegir un país no sustituye verificación de proveedor ni habilitación de pagos.

Reproducción: las cinco pruebas del helper fallaron antes de corregirlo; pasan
después. Validación de esta ampliación: 5 pruebas del helper, 15 de descubrimiento,
30 de controles web y 15 de contexto de cuenta, todas aprobadas (65 en esas suites).
Build frontend y diff check correctos; no se modificó backend en esta ampliación.
Los cambios de este bloque y del ajuste anterior siguen locales, sin staging,
commit, push ni deploy. No se han realizado nuevas consultas a Stripe ni escrituras
en producción.

## 2026-10-20 — Ciudad visible y publicación solo del frontend

La dueña seguía viendo Filters/All countries y no encontraba las ciudades. Lectura
HTTP confirmó que el dominio aún servía el catálogo anterior (`Tours-BlOgPxo6.js`),
no los cambios locales. No se atribuyó el problema a la caché del navegador.

- Nuevo `DestinationCityPicker.jsx`: mantiene entrada libre de ciudad y añade un
  botón visible que abre sugerencias buscables. Si no hay ciudades sugeridas,
  explica que se puede escribir una y permite buscar el texto introducido.
- Se conserva selección de país, limpieza de ciudad al cambiar de país y búsqueda
  de países sin inventario. No se crean ciudades, tours ni disponibilidad en DB.
- Nuevas traducciones para el selector de ciudad en inglés, español y francés.
- Reproducción local: los dos casos nuevos fallaban antes del arreglo; después
  pasaron. Validación final: 17 descubrimiento, 30 controles web, 15 contexto de
  cuenta y 5 helper geográfico = 67 pruebas. Build frontend y diff check correctos.
- Captura local sintética a 390px revisada: ciudad desplegada, Lima seleccionable,
  sin overflow horizontal. No es una sesión visual autenticada de producción.

Publicación Vercel directa, sin Git push ni cambios de configuración:

- Deployment: `dpl_DjGq5y4pCyqD3Qjapyq3B5BwxykC`, READY y promovido.
- Release: `discovery-20261020-1b4f78c118b9`.
- Base Git: `50a290b492db383193e372e701be2f39264f4d9e` más diez overlays frontend
  explícitos y verificados por SHA-256; NO es un nuevo commit de Git.
- Hash de overlays: `1b4f78c118b9543778824972dffe8bf52253df98d8145699925a83364697b79a`.
- Fuente aislada y manifiesto: `logs/city-discovery-source-20261020/` y
  `logs/city-discovery-release-state.json`; fase `public_release_verified`.
- Paquete dry-run inspeccionado: 423 archivos; sin logs, node_modules, dist,
  `.env`, install-state ni backups. Los diez overlays contienen solo frontend.
- Proyecto/root y flags públicos verificados antes de crear candidato. Candidato
  construido sin asignar dominios, identidad/estado READY verificados y después
  promovido. Deployment anterior conservado:
  `dpl_7V8nS13r9eTvBab1qQghPMLzsNoe`.
- Verificación HTTP final en www.wadatrip.com y wadatrip.com: 200; entrada
  `index-c_PmHwkC.js`, catálogo `Tours-CO5u15Aq.js`, con búsqueda de país y selector
  de ciudad nuevos. El antiguo texto de filtros no está en ese chunk.

No staging, commit, push, deploy de Render, migración, cambios DNS, nuevas reservas,
emails ni llamadas/cambios Stripe. El campo informativo backend `payment_mode`
sigue únicamente en working tree: NO se incluyó en esta publicación. Mientras ese
campo no se publique, el panel actualizado muestra modo no verificado de forma
segura y no infiere aprobación Live.

Los cambios locales previos ajenos al bloque se conservaron por hash. La web
publicada incluye estos overlays todavía sin commit; no desplegar otra vez el
antiguo main ni resetear este trabajo. Recuperar acceso/verificar Auto-Deploy de
Render antes de sincronizar Git. La publicación de UI no aprueba pagos reales.

## 2026-10-20 — Información de empresa restaurada en el header

La dueña aprobó mantener Tours, Sobre Wadatrip y Contacto en el menú principal,
con Mis viajes al autenticarse; el logo sigue llevando al inicio. Se reutilizan
las páginas existentes /about-us y /contact. Mismo menú en escritorio y móvil.

- Diferencia respecto a la publicación anterior: solo `Header.jsx` y una nueva
  etiqueta en cada locale en/es/fr (cuatro archivos de producto).
- Build frontend, diff check y 47 comprobaciones locales correctos: 17 de
  descubrimiento/navegación y 30 de controles web, con APIs sintéticas.
- Deployment Vercel `dpl_5TkipcBUXnBfE15gps8yz9M62J2v`, READY y promovido.
- Release `navigation-20261020-d844c98a81e9`, fuente aislada
  `logs/company-nav-source-20261020`, estado/manifiesto en
  `logs/company-nav-release-state.json` y `wadatrip-release.json` de esa fuente.
- La fuente conserva el mismo base Git y diez overlays de la publicación de
  países/ciudades; el guard verificó que solo los cuatro archivos previstos cambiaron.
- Ambos dominios verificados por HTTP con entrada `index-Dyju9nbs.js`, navegación
  nueva de empresa y rutas /about-us y /contact con respuesta 200. Los selectores
  de país y ciudad nuevos siguen presentes en el catálogo servido.
- Sin staging, commit, push, deploy/configuración Render, DNS, cambios de datos,
  pagos ni Stripe. Los cambios locales anteriores se conservaron por hash.

Esta es ahora la versión frontend publicada; todavía no existe un commit nuevo
que incluya estos overlays. No publicar el antiguo main ni perder el working tree.

## 2026-10-20 — Preflight de la próxima prueba de pago

Preflight de solo lectura completado a las 20:39 UTC, guardado en
`logs/browser-close-preflight-20261020.json`.

- Backend responde ok; listing piloto publicado, USD 50 por persona.
- Una fila pública de disponibilidad para 2026-11-30 con 9 cupos disponibles.
- Salida 16:00 UTC / 11:00 America/Lima; cierre de reservas 2026-11-29 16:00 UTC.
- Modo Test y gate Live cerrado comprobados con configuración actual del backend.
- Tres GET a Stripe Test: balance para comprobar modo, plataforma para comprobar
  asociación y endpoint permanente para comprobar modo Test, estado enabled, URL
  `/webhooks/stripe` y evento checkout.session.completed. No se imprimieron payloads
  ni secretos. La presencia/configuración del endpoint no sustituye el nuevo E2E.
- No se creó booking/checkout, no hubo pagos/refunds/transferencias, consultas DB
  directas ni correos. El caso de cerrar el navegador sigue pendiente de ejecutar.

Recuperación de acceso: el lector antiguo de la clave en cli.yaml recibió un
rechazo de autorización. `render login` (CLI instalado 2.2.0) indicó ya autenticado;
la posterior lectura oficial `render services --output json` renovó la sesión
local. El mismo preflight entonces pasó. No se borró configuración, no se creó
una clave manual ni se expusieron tokens. Para futuros rechazos, validar/renovar
primero mediante el CLI oficial, sin asumir que basta leer una clave cacheada.
Referencia: https://render.com/docs/cli

Acceso Render REST nuevamente operativo y Auto-Deploy verificado `no`. Esto
resuelve el bloqueo de acceso anterior, pero no autoriza por sí solo push, deploy
de backend, migración, Stripe Live ni conciliación de datos históricos. No se hizo
ninguna de esas acciones en este preflight.
