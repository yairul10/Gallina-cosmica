import assert from 'node:assert/strict';
import worker from '../src/worker.js';

const request = (path) => new Request('https://example.test' + path, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}'
});
const disabled = await worker.fetch(request('/api/purchases/verify'), {});
assert.equal(disabled.status, 503);
assert.equal((await disabled.json()).error, 'PURCHASE_API_DISABLED');

for (const path of ['/api/progress', '/api/rewards/claim']) {
  const blocked = await worker.fetch(request(path), { PURCHASE_API_ENABLED: 'true' });
  assert.equal(blocked.status, 426);
  assert.equal((await blocked.json()).error, 'CLIENT_UPGRADE_REQUIRED');
}
console.log('Purchase route disabled and legacy write guards: OK');
