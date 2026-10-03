// Google Play verification primitives for the API Worker. No credentials belong in source control.
const GAMES_CLIENT_ID = '672762312251-iub1fld742850kn1v637dvhle7e0mdv4.apps.googleusercontent.com';
const GAMES_APP_ID = '672762312251';
const PACKAGE_NAME = 'com.gallinacosmica.app';

const b64url = bytes => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};
const encode = value => b64url(new TextEncoder().encode(value));

// The client supplies a one-use server auth code, never a player ID to trust.
export async function verifyPlayGamesPlayer(authCode, env, requestFetch = fetch) {
  if (!env.GOOGLE_OAUTH_CLIENT_SECRET) throw new Error('GAMES_AUTH_NOT_CONFIGURED');
  if (typeof authCode !== 'string' || !authCode || authCode.length > 4096) throw new Error('INVALID_AUTH_CODE');
  const form = new URLSearchParams({
    code: authCode,
    client_id: GAMES_CLIENT_ID,
    client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
    grant_type: 'authorization_code',
    redirect_uri: ''
  });
  const tokenResponse = await requestFetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form
  });
  const token = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !token.access_token) throw new Error('GAMES_TOKEN_EXCHANGE_FAILED');
  const response = await requestFetch(`https://games.googleapis.com/games/v1/applications/${GAMES_APP_ID}/verify`, {
    headers: { authorization: `Bearer ${token.access_token}` }
  });
  const player = await response.json().catch(() => ({}));
  const playerId = String(player.player_id || player.playerId || '').trim();
  if (!response.ok || !playerId || playerId.length > 128) throw new Error('GAMES_PLAYER_VERIFY_FAILED');
  return playerId;
}

async function publisherAccessToken(env, requestFetch) {
  if (!env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON) throw new Error('PLAY_SERVICE_ACCOUNT_NOT_CONFIGURED');
  let account;
  try { account = JSON.parse(env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON); }
  catch { throw new Error('INVALID_PLAY_SERVICE_ACCOUNT'); }
  if (account.type !== 'service_account' ||
      account.client_email !== 'gallina-compras-api@gallina-cosmica.iam.gserviceaccount.com' ||
      !account.private_key || account.token_uri !== 'https://oauth2.googleapis.com/token') {
    throw new Error('INVALID_PLAY_SERVICE_ACCOUNT');
  }
  const der = Uint8Array.from(atob(account.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '')), ch => ch.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const unsigned = encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' +
    encode(JSON.stringify({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: account.token_uri, iat: now, exp: now + 3600 }));
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const response = await requestFetch(account.token_uri, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + b64url(new Uint8Array(signature)) })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error('PLAY_ACCESS_TOKEN_FAILED');
  return data.access_token;
}

// Returns only a PURCHASED item matching the requested catalog ID and quantity.
// D1 must claim the purchase token atomically before any reward is granted.
export async function verifyGooglePurchase(purchaseToken, productId, env, requestFetch = fetch) {
  if (typeof purchaseToken !== 'string' || !purchaseToken || purchaseToken.length > 4096 ||
      typeof productId !== 'string' || !/^(monedas_(500000|1000000|5000000|15000000|50000000)|pack_(inicial|pvp))$/.test(productId)) {
    throw new Error('INVALID_PURCHASE_REQUEST');
  }
  const accessToken = await publisherAccessToken(env, requestFetch);
  const response = await requestFetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/purchases/productsv2/tokens/${encodeURIComponent(purchaseToken)}`,
    { headers: { authorization: `Bearer ${accessToken}` } }
  );
  const purchase = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error('PLAY_PURCHASE_LOOKUP_FAILED');
  if (purchase.purchaseStateContext?.purchaseState !== 'PURCHASED') throw new Error('PURCHASE_NOT_COMPLETED');
  const lines = purchase.productLineItem;
  if (!Array.isArray(lines) || lines.length !== 1 || lines[0]?.productId !== productId ||
      Number(lines[0]?.productOfferDetails?.quantity || 1) !== 1) throw new Error('PURCHASE_PRODUCT_MISMATCH');
  return { productId, orderId: String(purchase.orderId || ''), test: !!purchase.testPurchaseContext };
}
