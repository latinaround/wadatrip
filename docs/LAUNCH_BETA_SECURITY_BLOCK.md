# Beta privada: primer bloque de seguridad y fuente reproducible

Cierre local: 26 de octubre de 2026. La dueña aprobó comenzar el programa; este bloque no autoriza despliegues, staging, commit, Stripe, ventas ni invitaciones externas. Evidencia local ignorada en `logs/launch-beta-20261025/` (fecha de inicio).

## Estado actual — 27 de octubre de 2026

El plan inicial de «Siguiente grupo autorizado» al final de este informe quedó
superado por los bloques [OPERATOR_BETA_SECURITY_SECOND_BLOCK.md](OPERATOR_BETA_SECURITY_SECOND_BLOCK.md)
y [OPERATOR_BETA_CONTROLS_AND_ANDROID.md](OPERATOR_BETA_CONTROLS_AND_ANDROID.md).
Esos documentos registran la implementación local de límites persistentes de login,
frontera de administración/leads, controles de beta de preparación/publicación y
uploads cerrados. La decisión vigente sigue siendo **NO-GO para invitaciones externas**
hasta cerrar release, configuración/runtime y verificación de almacenamiento indicados
allí.

Validación adicional realizada el 27 de octubre: `scripts/auth-return-ui.test.cjs`
pasó 6/6 escenarios en Chrome contra Vite en `127.0.0.1:4196`, con API interceptada
y respuestas sintéticas; reportó `production_calls=0`. El servidor local se cerró
al terminar. Esta prueba solo actualiza evidencia de retorno de login; no valida una
sesión real ni modifica el estado de despliegue.

## Resultado y límites

Se cerró localmente el retorno inseguro del login. La beta sigue **NO-GO** hasta cerrar límites de autenticación, permisos de leads, orígenes/timeouts, invitaciones y preparación comercial, y seguridad de archivos. No anunciar que todo A1/A2 o la beta completa estén terminados.

- El registro/login por contraseña ahora usa AuthContext, igual que el código de correo. No hay un segundo escritor de sesión en GuideSignupPage.
- Los retornos admiten rutas internas validadas. Se rechazan destinos externos, separadores codificados, normalizaciones peligrosas, controles y parámetros/fragmentos de credenciales.
- Ya no se añade un JWT a la URL. Los lectores de AuthContext y del operador ignoran credenciales de fragmentos antiguos; AuthContext retira el fragmento emitido históricamente sin aceptar su contenido.
- Una respuesta inválida o un cambio de sesión no simula autenticación ni navega como éxito.
- Se conservó la navegación por historial existente después de que una modificación adicional rompiera tres casos de cambio de cuenta. No se relajaron esos controles.
- JWT web sigue en localStorage. Este cambio no añade cookies HttpOnly, revocación de servidor ni cifrado del almacenamiento web. Los enlaces antiguos con credenciales ya no sirven para iniciar sesión; se requiere el login normal.

## Reproducción y evidencia

Antes de modificar producción, 17 controles sobre el componente/helpers reales con I/O sintético dieron 1 pass y 16 fallos. Son assertions, no 16 vulnerabilidades independientes. Tras la corrección, 17/17 pasan.

Validación final local:

| Grupo | Pass | Evidencia |
|---|---:|---|
| Núcleo existente, administración y Community backend/cliente | 352 | Procesos separados; fixtures/HTTP sintéticos según cada suite |
| Retorno y sesión nuevos | 17 | Componente/helpers reales con red sintética |
| Manifiesto de release | 14 | Git/source contracts con fixtures de archivos locales |
| Navegador: retorno, límites de sesión y login existente | 19 | Chrome localhost, APIs interceptadas |
| Controles web | 30 | Chrome localhost, APIs interceptadas |
| Readiness | 14 | Render del componente con datos sintéticos |
| Descubrimiento | 17 | Chrome localhost, APIs interceptadas |
| Community UI | 18 | Chrome localhost, APIs interceptadas |
| Total distinto | **481** | No incluye repeticiones del mismo caso en el candidato |

Las 19 pruebas de autenticación se repitieron sobre el candidato aislado, con instalación limpia. No se volvió a probar PostgreSQL, email real, Stripe ni sesiones reales. No se contactaron servicios de producción ni se generaron pagos/correos.

El primer harness estático devolvía 403 en `/`; se corrigió y se repitió la suite de controles sin cambiar el producto para satisfacerla. Los fallos originales permanecen en los logs locales. La compilación conserva la advertencia existente de chunks mayores de 500 kB.

## Candidato y herramientas reproducibles

Base documentada: `4e2b2625971b3d126f9a2a1371ff6d7edab6521b`. Esto identifica la base local de la web publicada anteriormente, no una nueva verificación de la versión actual del servicio.

Se exportó el commit con `git -c core.autocrlf=false archive`, sin checkout, cambio de ramas o modificación de historial. La exportación inicial con conversión de fin de línea fue rechazada por el verificador; no se normalizaron SQL históricos para ocultar la discrepancia.

El manifiesto final verifica 1.389 archivos contra el árbol Git y SHA-256. Solo permite cuatro overlays de aplicación:

1. `apps/web/src/pages/GuideSignupPage.jsx`
2. `apps/web/src/context/AuthContext.jsx`
3. `apps/web/src/pages/OperatorToursNew.jsx`
4. `apps/web/src/utils/authReturn.js`

Se excluyen explícitamente los dos install-state históricos de Yarn. Los ZIP de dependencias inmutables se verifican contra el blob original, sin interpretar comprimidos como texto ni permitirlos como overlays. Se rechazan modificaciones no listadas, archivos faltantes/adicionales, symlinks, archivos privados/generados y algunos patrones de credenciales privadas; no equivale a un análisis exhaustivo de secretos o dependencias.

`scripts/release-manifest.mjs` crea el manifiesto fuera de la fuente y se niega a sobrescribir uno existente. `scripts/verify-release.mjs` verifica nuevamente árbol, alcance y bytes. Ninguno carga dotenv, migra, llama servicios o despliega. Ambos necesitan ejecutar Git local de solo lectura.

Ejemplo reproducible, después de materializar una copia de fuente y aplicar los cuatro overlays explícitos:

```powershell
node scripts/release-manifest.mjs --root <source-directory> --repo . --base 4e2b2625971b3d126f9a2a1371ff6d7edab6521b --changes <four-paths.json> --out <new-manifest.json>
node scripts/verify-release.mjs --root <source-directory> --repo . --manifest <new-manifest.json>
```

Otra copia del frontend se instaló con Yarn 3.6.4, `--immutable --immutable-cache --mode=skip-build`, scripts y acceso de red desactivados. Se compiló con Node 24, Vite local de esa instalación, `envDir:false`, API localhost y SDK inline de Stripe/agente desactivados. Se volvió a verificar la fuente original contra su manifiesto. Los paquetes/lockfiles de trabajo y el candidato de fuente permanecen intactos.

Esto valida instalación/compilación local de la web con configuración sintética. No reproduce variables públicas de Vercel, no prueba Linux/Render y no reconstruye el backend. No hacer push/deploy del main antiguo ni del bundle sintético. Community y cambios locales de retorno de checkout ajenos a estos cuatro overlays no forman parte del candidato.

## Alcance de cambios para revisión

- Los cuatro archivos de aplicación anteriores.
- Nuevos `scripts/auth-return.test.cjs`, `scripts/auth-return-ui.test.cjs`, `scripts/release-manifest.mjs`, `scripts/verify-release.mjs`, `scripts/release-manifest.test.mjs`.
- `scripts/auth-session-boundaries-ui.test.cjs`: cambiar el contrato de fragmentos retirados para comprobar que no establecen sesión. Las otras pruebas de cambio de cuenta se mantienen.
- Este documento.

No hay migración. Los cambios anteriores de Account, package.json, install-state y trabajo ajeno se conservan por hash. Mobile no se modifica. No staging, commit, push o deploy.

## Plan inicial (histórico; reemplazado por el estado actual anterior)

1. Reproducir límites ausentes de solicitudes de códigos y cerrar abuso concurrente con PostgreSQL.
2. Cerrar el proxy de leads y accesos directos; comprobar MFA e identidad interna.
3. Restringir orígenes y timeouts conservando webhooks y checkout.
4. Verificar almacenamiento de imágenes y revisión documental; no recoger documentos sensibles por un flujo no validado.
5. Añadir invitaciones vinculadas a correo, borradores y estados claros de preparación/venta antes de abrir la beta de cinco operadores.

No enviar invitaciones ni habilitar ventas mientras esos gates estén pendientes. Mantener el trabajo de corredor financiero separado y registrar como desconocido lo no aprobado.
