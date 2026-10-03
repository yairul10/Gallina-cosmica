# API de Gallina Cósmica (preparación)

El archivo `src/worker.js` es la copia recibida del Worker `gallina-cosmica-api` el 3 de octubre de 2026. Se guarda aquí para poder revisar y probar cambios junto con la app.

**No desplegar todavía:** falta la prueba real con Google, la migración D1 y los secretos del Worker. `POST /api/progress` sigue confiando en el saldo y las posesiones del teléfono para conservar el juego offline; `/api/rewards/claim` sigue identificando al jugador por `player_id`. La ruta nueva de compras exige identidad Play Games, valida en Google y acredita en D1 una sola vez. Los anuncios recompensados requieren verificación del servidor si sus premios han de ser resistentes a manipulación.

El workflow de API solo se ejecuta manualmente. Antes de usarlo, configurar `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` en GitHub Actions Secrets. El token de Cloudflare debe tener permisos de edición del Worker correspondiente. El UUID de la base D1 confirmada está en el workflow, sin credenciales. Mantener los secretos de Google en las variables cifradas del Worker, jamás en GitHub ni en la app. Confirmar que la D1 asociada al nombre `DB` es la misma base usada por el Worker actual.

La migración de tokens está escrita, pero no aplicada a D1. El registro por sí solo no acredita premios; la entrega tendrá que ser transaccional e idempotente junto al saldo administrado por el servidor. Definir cómo conservar los saldos anteriores y desplegar un cliente compatible antes de bloquear la ruta antigua. Revisar compras de prueba, packs, reconexión y progreso existente en una versión de prueba.

## Revisión del 3 de octubre de 2026

Configuración confirmada por capturas: cuenta de servicio `gallina-compras-api@gallina-cosmica.iam.gserviceaccount.com` activa en Play Console para `com.gallinacosmica.app`, permisos de datos financieros y gestión de pedidos; Google Play Android Developer API habilitada en el proyecto `gallina-cosmica`. Esto configura el acceso, pero todavía no valida compras en el Worker.

Flujo actual de `js/billing.js`: el cliente llama a `gallinaApplyPlayCoinPurchase` o `gallinaApplyPlayPackPurchase` antes de consumir o confirmar la compra. Solo deduplica tokens en `localStorage` (hasta 200), por lo que una reinstalación u otro dispositivo no comparte el registro. `js/estado.js` envía `coins`, `owned_ships` y `owned_extras` a `POST /api/progress`. El Worker acepta esos valores usando únicamente un `player_id` declarado por el cliente. También hay premios en `/api/rewards/claim` sin sesión.

### Orden de implementación obligatorio

1. Crear autenticación de Play Games en la API con código OAuth de un solo uso, obteniendo el ID de jugador desde Google; no confiar en `player_id` del cuerpo. La app ya expone `requestPlayGamesServerAuthCode()`; el Worker PvP muestra el intercambio y la verificación como referencia. El secreto OAuth queda solo en Cloudflare.
2. Añadir a D1 un registro único por token de compra, vinculado a jugador y producto, con entrega idempotente. Consultar `purchases.productsv2.getproductpurchasev2` con la cuenta de servicio, exigir `PURCHASED` y verificar `productLineItem.productId`, paquete y cantidad antes de entregar. La credencial de Google se guarda solo como secreto del Worker.
3. Para el lanzamiento inicial se confía en las monedas ganadas offline. `purchase_revision` impide que una escritura anterior a la compra borre el crédito, y el cliente reconcilia los cambios offline con el saldo nuevo del servidor. No garantiza protección contra un cliente modificado que invente monedas. Los derechos de packs se restauran desde la compra verificada.
4. La app nueva espera la respuesta del servidor, descarga el saldo acreditado y reintenta tokens pendientes al reabrir. Consume/acknowledge solo después de refrescar el progreso. No acredita monedas desde un token no verificado localmente.
5. Probar en un entorno aislado los casos: compra aceptada, pendiente, cancelada, token/producto incorrecto, token repetido, dos dispositivos, cierre antes de consumir, cambio de perfil Play Games y progreso antiguo. Desplegar API y AAB compatibles como un conjunto; bloquear las rutas heredadas después de migrar clientes.

**Estado:** la rama `api-security-staging` contiene validación de identidad Play Games y compras Google, crédito transaccional en D1, ruta `/api/purchases/verify` apagada por defecto (`PURCHASE_API_ENABLED=true` para habilitar), y cliente que pide confirmación del Worker antes de acreditar monedas. El progreso offline sigue siendo confiado: `purchase_revision` impide que un guardado anterior a la compra borre el crédito; la app conserva el cambio local desde `cloudSyncedCoins` y lo aplica sobre el nuevo saldo del servidor al reconectar. Pruebas locales de SQL, ruta y cliente pasan. **Sin desplegar:** la migración D1 no se ejecutó, faltan secretos del Worker y pruebas reales de Google. No ejecutar el workflow de API todavía.

## Límite de seguridad del juego actual

Por decisión del propietario, las monedas ganadas y gastadas offline siguen calculándose en el teléfono y se sincronizan con D1. Esto conserva el juego offline, pero permite que un cliente modificado declare monedas inventadas; **la validación de compras no evita ese fraude general del saldo**. Las compras sí se consultan en Google, se vinculan a la identidad Play Games y se registran una vez. La revisión de compra en `player_progress` rechaza los guardados anteriores al crédito para evitar que el progreso viejo borre una compra. No se debe describir el saldo total como inviolable.

## Orden de activación de prueba

1. Respaldar D1 y ejecutar `migrations/001_play_purchase_grants.sql` una sola vez en la base vinculada como `DB`. Verificar tabla, índice y columna `purchase_revision`; este SQL incluye `ALTER TABLE` y no se debe ejecutar dos veces.
2. Configurar en secretos del Worker `GOOGLE_OAUTH_CLIENT_SECRET` y `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`. No copiar la clave privada en el repositorio, la app o capturas.
3. Desplegar el Worker desde la rama y activar `PURCHASE_API_ENABLED=true` solo en el entorno de prueba. Hacer una compra de prueba real en Play, confirmando un solo crédito y recuperación tras cierre/reapertura. La app nueva necesita esa ruta activa para comprar.
4. Crear una AAB con la app de la misma rama y un `versionCode` nuevo; probar con un tester antes de producción. Durante el cambio, las AAB anteriores continúan confiando en el saldo local y no usan la ruta de compra nueva.
5. Verificar compra cancelada, pendiente, paquete permanente, token repetido, otro dispositivo, saldo offline pendiente y cambio de perfil. Revisar logs y D1 sin exponer tokens o secretos.
