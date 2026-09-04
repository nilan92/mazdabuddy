// node src/lib/totals.test.mjs — mirrors recalc_invoice_total() in update_job_discount.sql
import assert from 'node:assert/strict';
import { calcDiscount, calcInvoiceTotal } from './totals.ts';

assert.equal(calcInvoiceTotal([{ quantity: 2, price_at_time_lkr: 1000 }], [{ hours: 2, hourly_rate_lkr: 1500 }]), 5000);

assert.equal(calcDiscount(5000, 'percent', 10), 500);
assert.equal(calcDiscount(5000, 'amount', 750), 750);
assert.equal(calcDiscount(5000, 'amount', 9999), 5000, 'never exceeds the bill');
assert.equal(calcDiscount(5000, 'percent', 200), 5000, 'never exceeds the bill');
assert.equal(calcDiscount(5000, 'amount', -5), 0);
assert.equal(calcDiscount(5000, null, null), 0);
assert.equal(calcDiscount(333, 'percent', 33), 109.89, 'percent keeps 2dp');

console.log('ok');
