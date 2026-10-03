import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../js/billing.js', import.meta.url), 'utf8');
let credited = 0, consumed = 0, verified = 0, newlyCredited = true;
const statusEl = { textContent: '' };
const plugin = {
  async buy() { return { purchaseToken: 'token-a', products: ['monedas_500000'] }; },
  async consume() { consumed++; },
  async getProducts() { return { products: [] }; },
  async getPurchases() { return { purchases: [] }; }
};
const window = {
  Capacitor: { Plugins: { GallinaBilling: plugin } },
  addEventListener() {},
  GallinaPlayerIdentity: { getCurrent: () => ({ id: 'p1' }) },
  requestPlayGamesServerAuthCode: async () => 'auth-code',
  gallinaFlushCloudProgressBeforePurchase: async () => true,
  gallinaRefreshCloudProgress: async () => true,
  gallinaApplyPlayCoinPurchase: () => { credited++; return { success: true }; },
  gallinaApplyVerifiedPlayEntitlement: () => {},
  updatePackOffers() {}
};
const context = {
  window, document: { getElementById: () => statusEl, querySelector: () => null },
  fetch: async (_url, options) => {
    assert.equal(credited, verified); // API call comes before local credit.
    assert.equal(JSON.parse(options.body).auth_code, 'auth-code');
    verified++;
    return new Response(JSON.stringify({
      success: true, player_id: 'p1', productId: 'monedas_500000', newlyCredited
    }), { status: 200 });
  },
  Response, console, setTimeout
};
vm.runInNewContext(source, context);
await window.GallinaBilling.buy('monedas_500000');
assert.equal(credited, 1);
assert.equal(consumed, 1);
newlyCredited = false;
await window.GallinaBilling.buy('monedas_500000');
assert.equal(credited, 1);
assert.equal(consumed, 2);
console.log('Billing verifies before credit and avoids replay: OK');
