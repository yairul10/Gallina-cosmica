import assert from 'node:assert/strict';
import worker from '../src/worker.js';

const request = (path) => new Request('https://example.test' + path, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}'
});
const disabled = await worker.fetch(request('/api/purchases/verify'), {});
assert.equal(disabled.status, 503);
assert.equal((await disabled.json()).error, 'PURCHASE_API_DISABLED');

const invalid = await worker.fetch(new Request('https://example.test/api/purchases/verify', {
  method: 'POST', body: '{'
}), { PURCHASE_API_ENABLED: 'true' });
assert.equal(invalid.status, 400);
assert.equal((await invalid.json()).error, 'INVALID_JSON');
console.log('Purchase route feature gate: OK');
