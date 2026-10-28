# Ensayo de copia autorizado — 28 de octubre de 2026

Resultado actual: PASS sobre un snapshot reciente de producción, obtenido el
28 de octubre de 2026 a las 17:28:56 UTC mediante TLS verificado y sesión de solo
lectura. Se cifró con DPAPI fuera del repositorio, con ACL privada; la restauración
y las migraciones se ejecutaron únicamente en PostgreSQL local aislado.

La copia actual pasó de 27 a 29 migraciones en 2,46 segundos. Se conservaron las
27 tablas de negocio y los 27 registros históricos de migración. Pasaron los seis
contratos de tablas/índices/constraints de la nueva funcionalidad, el rollback de
una transacción sintética y el preflight/postflight. No se cambiaron datos de
producción ni se contactó Stripe/dLocal. El ensayo previo descrito abajo usó el
backup del 20 de octubre; queda como evidencia histórica separada.

El postflight actual conserva excepciones históricas: 54 bookings sin importe
esperado, un evento sin procesar, una confirmación sin respaldo suficiente y siete
constraints core NOT VALID. Cero diferencias de capacidad cacheada, sobreventa,
IDs financieros conflictivos o constraints/índices requeridos ausentes. No se
reparó ni reclasificó ningún caso automáticamente. Estos casos requieren revisión
antes de dinero real; la beta de preparación mantiene nuevos pagos cerrados.

Se verificó el hash del archivo cifrado tras descifrarlo en memoria y se restauró
en PostgreSQL 17.9, red Docker interna, sin puertos publicados y con datos solo en
tmpfs. El contenedor y la red se retiraron al terminar. No se guardó dump sin cifrar.

La fuente usada fue el candidato Node 24 previamente verificado, base publicada
`c30b2dfa04e48f5e964358bcf20df155b617232f`, 1.446 archivos y 114 cambios declarados.
Este informe es evidencia posterior; no cambia ese candidato inmutable.

## Evidencia del ensayo previo sobre el backup del 20 de octubre

- Se restauraron 26 migraciones terminadas. Aplicaron únicamente inbox de
  operadores, Community y límites persistentes de login: 26 → 29 migraciones.
- Duración del comando de migración: 2,69 segundos. No hubo error SQL ni timeout.
- Las 26 tablas de negocio existentes conservaron recuentos y fingerprints de
  todas sus columnas. Ningún valor original fue impreso en los informes.
- Los 26 registros originales de `_prisma_migrations` conservaron todos sus
  campos. Las tres migraciones nuevas tienen el checksum exacto del candidato.
- El conjunto de constraints históricas NOT VALID permaneció intacto.
- Preflight de límites de login: tabla ausente, cero migraciones inconclusas.
  Postflight: cuatro constraints, dos índices, cero filas inválidas y cero
  migraciones inconclusas.
- Los contratos observados de inbox y de threads/replies/reports tienen sus
  constraints e índices. Las pruebas funcionales y de concurrencia previamente
  documentadas son evidencia separada; no se cuentan como nuevas en este ensayo.

El primer intento paró antes de ejecutar DDL por una comparación de checksum
demasiado estricta del harness. Dos migraciones históricas exportadas a LF
(`20260106133000_add_agent_itineraries` y `20260513124500_add_provider_owner`)
difieren de los originales por fines de línea. Se comprobó que los archivos
originales locales coinciden byte por byte con el checksum almacenado y que su
SQL normalizado a LF coincide exactamente con el candidato. No se modificaron
los originales, el SQL candidato ni los checksums de la base. La evidencia
individual está conservada; una diferencia de contenido habría detenido el ensayo.

Resultado local agregado y evidencia sin PII:
`logs/beta-copy-20261028T170302Z/result.json` y
`historical-checksum-evidence.json` en la misma carpeta.
Harness local: `logs/beta-copy-rehearsal-20261028.ps1`.

## Acceso y siguiente paso

La consola autenticada de Render sigue mostrando c30b2df, Node 20.11.1,
`PAYMENTS_LIVE_ENABLED=false` y `PAYMENTS_ACCEPT_NEW=true`. No se guardó ningún
cambio. La credencial local inicialmente devolvió 401; se renovó mediante el login
oficial de Render CLI y la comprobación GET posterior pasó. Auto-Deploy está
desactivado y no hay despliegues activos. El backup reciente ya fue completado.

El registro privado de snapshot está en `logs/beta-fresh-backup-state-20261028.json`.
Solo contiene referencia al archivo cifrado y métricas técnicas. No enviar API
keys, DATABASE_URL, JWT, códigos ni MFA por chat.

El siguiente paso es cerrar nuevas compras durante el corte, aplicar las
migraciones aditivas explícitamente y publicar servicios/web
compatibles con cohorte vacía. Verificar Node 24, health, login/logout, límites,
MFA y aislamiento antes de admitir hasta cinco operadores en preparación.

Storage efectivo y su configuración cliente también requieren aceptación antes
de habilitar cargas. Live permanece apagado. El corredor de payout aprobado es
un gate independiente de ventas reales; no impide preparar la beta cerrada.
