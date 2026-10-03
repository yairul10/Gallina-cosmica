# API de Gallina Cósmica (preparación)

El archivo `src/worker.js` es la copia recibida del Worker `gallina-cosmica-api` el 3 de octubre de 2026. Se guarda aquí para poder revisar y probar cambios junto con la app.

**No desplegar esta copia como actualización de seguridad.** Actualmente `POST /api/progress` acepta saldo y posesiones enviados por el cliente, y `/api/rewards/claim` identifica al usuario por un `player_id` sin sesión. El siguiente cambio debe verificar la sesión de Play Games, validar los tokens de compra en Google Play Developer API, registrar cada token una sola vez en D1 y acreditar desde el servidor. Los anuncios recompensados también requieren verificación del servidor si sus premios han de ser resistentes a manipulación.

El workflow de API solo se ejecuta manualmente. Antes de usarlo, configurar `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` en GitHub Actions Secrets. El token de Cloudflare debe tener permisos de edición del Worker correspondiente. El UUID de la base D1 confirmada está en el workflow, sin credenciales. Mantener los secretos de Google en las variables cifradas del Worker, jamás en GitHub ni en la app. Confirmar que la D1 asociada al nombre `DB` es la misma base usada por el Worker actual.

Migración pendiente: añadir tabla de tokens verificados y desplegar cliente compatible antes de bloquear la ruta antigua. Revisar compras de prueba, packs, reconexión y progreso existente en una versión de prueba.
