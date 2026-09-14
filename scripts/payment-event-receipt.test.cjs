// Receipt error classification only. Concurrency acceptance runs separately on real PostgreSQL.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { receivePaymentEvent } = require('@wadatrip/common/payment-lifecycle');

function receipt({ error, processed = false, count = 1 } = {}) {
  let reads = 0, updates = 0;
  return {
    db: { paymentEvent: {
      upsert: async () => { if (error) throw error; },
      findUnique: async () => { reads++; return { id: 'evt_synthetic', processed_at: processed ? new Date(0) : null }; },
      updateMany: async () => { updates++; return { count }; },
    } },
    reads: () => reads, updates: () => updates,
  };
}
const receive = db => receivePaymentEvent(db, 'evt_synthetic', 'synthetic.succeeded', { external_id: 'synthetic-only' });

test('receipt recovers only a concurrent insertion of the same PaymentEvent id', async () => {
  const f = receipt({ error: { code: 'P2002', meta: { modelName: 'PaymentEvent', target: ['id'] } } });
  assert.equal(await receive(f.db), true); assert.equal(f.reads(), 1); assert.equal(f.updates(), 1);
});
test('receipt collision reloads processed state instead of reopening a completed event', async () => {
  const f = receipt({ error: { code: 'P2002', meta: { modelName: 'PaymentEvent', target: ['id'] } }, processed: true });
  assert.equal(await receive(f.db), false); assert.equal(f.updates(), 0);
});
test('receipt does not claim processing if another transaction finished before conditional update', async () => {
  const f = receipt({ count: 0 }); assert.equal(await receive(f.db), false);
});
for (const error of [
  { code: 'P1001' }, { code: 'P2034' }, { code: 'P2002' },
  { code: 'P2002', meta: { modelName: 'PaymentEvent', target: ['id','type'] } },
  { code: 'P2002', meta: { modelName: 'PaymentRecord', target: ['id'] } },
]) test(`receipt propagates unrelated/ambiguous database error ${JSON.stringify(error)}`, async () => {
  const f = receipt({ error });
  await assert.rejects(receive(f.db), e => e === error); assert.equal(f.reads(), 0); assert.equal(f.updates(), 0);
});
