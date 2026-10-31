// node src/lib/usageQueue.test.mjs — usage batching: one insert per batch, silent stop when the table is missing
import assert from 'node:assert/strict';
import { createUsageQueue, normalizeRoute, cleanName } from './usageQueue.ts';

const row = (n) => ({ tenant_id: 't', user_id: 'u', event: 'click', name: `b${n}`, meta: {}, created_at: '2026-10-31T00:00:00Z' });

// Batches: 120 events with maxBatch 50 go out as 50 + 50 + 20, in order.
{
    const sent = [];
    const q = createUsageQueue({ send: async (rows) => { sent.push(rows.map(r => r.name)); return 'ok'; }, maxBatch: 50 });
    for (let i = 0; i < 120; i++) q.push(row(i));
    await q.flush(); await q.flush(); await q.flush(); await q.flush();
    assert.deepEqual(sent.map(b => b.length), [50, 50, 20]);
    assert.equal(sent[0][0], 'b0');
    assert.equal(sent[2][19], 'b119');
    assert.equal(q.size(), 0);
}

// Nothing queued: no network call.
{
    let calls = 0;
    const q = createUsageQueue({ send: async () => { calls++; return 'ok'; } });
    await q.flush();
    assert.equal(calls, 0);
}

// A flush while one is in flight doesn't send the same rows twice.
{
    const sent = [];
    let release;
    const q = createUsageQueue({ send: (rows) => { sent.push(rows.length); return new Promise(r => { release = () => r('ok'); }); } });
    q.push(row(1)); q.push(row(2));
    const first = q.flush();
    await q.flush();
    assert.deepEqual(sent, [2]);
    release(); await first;
}

// Table not there yet (app published before the migration): stop quietly, drop everything, accept nothing more.
{
    let calls = 0;
    const q = createUsageQueue({ send: async () => { calls++; return 'missing'; } });
    q.push(row(1));
    await q.flush();
    q.push(row(2));
    await q.flush();
    assert.equal(calls, 1);
    assert.equal(q.disabled(), true);
    assert.equal(q.size(), 0);
}

// Network error: rows are kept for the next try; after 3 failures in a row it gives up for the session.
{
    let calls = 0;
    const q = createUsageQueue({ send: async () => { calls++; throw new Error('offline'); } });
    q.push(row(1));
    await q.flush();
    assert.equal(q.size(), 1, 'kept after first failure');
    await q.flush(); await q.flush();
    assert.equal(calls, 3);
    assert.equal(q.disabled(), true);
    assert.equal(q.size(), 0);
}

// Recovery resets the failure count.
{
    let n = 0;
    const q = createUsageQueue({ send: async () => (++n === 1 ? 'error' : 'ok') });
    q.push(row(1));
    await q.flush();
    await q.flush();
    assert.equal(q.size(), 0);
    assert.equal(q.disabled(), false);
}

// Cap: a long offline stretch keeps only the newest events.
{
    const q = createUsageQueue({ send: async () => 'ok', maxQueue: 5 });
    for (let i = 0; i < 9; i++) q.push(row(i));
    assert.equal(q.size(), 5);
    assert.equal(q.drain()[0].name, 'b4');
    assert.equal(q.size(), 0);
}

// Routes: record ids and tokens never stored, only the screen.
assert.equal(normalizeRoute('/'), '/');
assert.equal(normalizeRoute('/jobs'), '/jobs');
assert.equal(normalizeRoute('/Jobs/5416b1a7-1111-2222-3333-444455556666'), '/jobs/:id');
assert.equal(normalizeRoute('/status/abcdEFGH12345678xyz'), '/status/:id');
assert.equal(normalizeRoute('/invoices/42?x=1'), '/invoices/:id');
assert.equal(cleanName('  nav:jobs  '), 'nav:jobs');
assert.equal(cleanName('x'.repeat(200)).length, 80);

console.log('usageQueue tests passed');
