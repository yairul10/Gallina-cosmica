import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';

const source = readFileSync(new URL('./play-purchase-verification.js', import.meta.url), 'utf8');
const { recordVerifiedPurchase, verifyGooglePurchase } = await import(
  'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
);

const grants = new Map();
const db = {
  prepare(sql) {
    return {
      bind(...values) {
        return {
          async run() {
            const [hash, player, product, coins, entitlement] = values;
            if (grants.has(hash)) return { meta: { changes: 0 } };
            if (entitlement?.startsWith('pack_') &&
                [...grants.values()].some(x => x.player_id === player && x.product_id === product)) {
              throw new Error('UNIQUE constraint failed: play_purchase_grants.player_id');
            }
            grants.set(hash, { player_id: player, product_id: product, coins, entitlement });
            return { meta: { changes: 1 } };
          },
          async first() { return grants.get(values[0]) || null; }
        };
      }
    };
  }
};

const env = { DB: db };
const original = await recordVerifiedPurchase(env, {
  playerId: 'p1', purchaseToken: 'token-1', productId: 'monedas_500000'
});
assert.equal(original.newlyRecorded, true);
assert.equal(original.coins, 500000);
const replay = await recordVerifiedPurchase(env, {
  playerId: 'p1', purchaseToken: 'token-1', productId: 'monedas_500000'
});
assert.equal(replay.newlyRecorded, false);
await assert.rejects(recordVerifiedPurchase(env, {
  playerId: 'p2', purchaseToken: 'token-1', productId: 'monedas_500000'
}), /PURCHASE_TOKEN_ALREADY_ASSIGNED/);
await assert.rejects(recordVerifiedPurchase(env, {
  playerId: 'p1', purchaseToken: 'token-1', productId: 'monedas_1000000'
}), /PURCHASE_TOKEN_ALREADY_ASSIGNED/);
await recordVerifiedPurchase(env, {
  playerId: 'p1', purchaseToken: 'pack-token-1', productId: 'pack_inicial'
});
await assert.rejects(recordVerifiedPurchase(env, {
  playerId: 'p1', purchaseToken: 'pack-token-2', productId: 'pack_inicial'
}), /PACK_ALREADY_CLAIMED/);
assert.equal(grants.size, 2);

// Validation of Google responses is tested without live credentials.
// The first response is an OAuth token; the second is a purchase lookup.
const serviceKey = await webcrypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
  true, ['sign', 'verify']
);
const pkcs8 = Buffer.from(await webcrypto.subtle.exportKey('pkcs8', serviceKey.privateKey))
  .toString('base64').match(/.{1,64}/g).join('\n');
const testEnv = {
  GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: JSON.stringify({
    type: 'service_account',
    client_email: 'gallina-compras-api@gallina-cosmica.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\n' + pkcs8 + '\n-----END PRIVATE KEY-----\n',
    token_uri: 'https://oauth2.googleapis.com/token'
  })
};
function fakeGoogle(purchase) {
  return async (url) => new Response(JSON.stringify(
    String(url).includes('oauth2.googleapis.com') ? { access_token: 'mock-access' } : purchase
  ), { status: 200, headers: { 'content-type': 'application/json' } });
}
const valid = {
  purchaseStateContext: { purchaseState: 'PURCHASED' },
  productLineItem: [{ productId: 'monedas_500000', productOfferDetails: { quantity: 1 } }]
};
assert.equal((await verifyGooglePurchase('purchase', 'monedas_500000', testEnv, fakeGoogle(valid))).productId, 'monedas_500000');
await assert.rejects(verifyGooglePurchase('purchase', 'monedas_500000', testEnv,
  fakeGoogle({ ...valid, purchaseStateContext: { purchaseState: 'PENDING' } })), /PURCHASE_NOT_COMPLETED/);
await assert.rejects(verifyGooglePurchase('purchase', 'monedas_500000', testEnv,
  fakeGoogle({ ...valid, productLineItem: [{ productId: 'monedas_1000000' }] })), /PURCHASE_PRODUCT_MISMATCH/);
console.log('Purchase verification and replay tests: OK');
