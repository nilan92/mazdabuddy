// node src/lib/totals.test.mjs — mirrors recalc_invoice_total() in update_job_discount.sql
import assert from 'node:assert/strict';
import { calcDiscount, calcInvoiceTotal } from './totals.ts';

assert.equal(calcInvoiceTotal([{ quantity: 2, price_at_time_lkr: 1000 }], [{ hours: 2, hourly_rate_lkr: 1500 }]), 5000);

assert.equal(calcDiscount(5000, 'percent', 10), 500);
assert.equal(calcDiscount(5000, 'amount', 750), 750);
assert.equal(calcDiscount(5000, 'amount', 9999), 5000, 'never exceeds the bill');
assert.equal(calcDiscount(5000, 'percent', 200), 5000, 'never exceeds the bill');
assert.equal(calcDiscount(5000, 'amount', -5), 0);
assert.equal(calcDiscount(333, 'percent', 33), 109.89, 'percent keeps 2dp');
 
// Test calcInvoiceSummary with Alto 800 scenario (30% on labor lines, 0 on parts)
import { calcInvoiceSummary } from './totals.ts';

const summary = calcInvoiceSummary(
    [
        { quantity: 1, price_at_time_lkr: 10800 },
        { quantity: 3, price_at_time_lkr: 1200 },
        { quantity: 1, price_at_time_lkr: 1500 },
        { quantity: 1, price_at_time_lkr: 1200 },
        { quantity: 1, price_at_time_lkr: 1650 },
    ],
    [
        { hours: 5, hourly_rate_lkr: 1850, discount_type: 'percent', discount_value: 30 },
        { hours: 1, hourly_rate_lkr: 1850, discount_type: 'percent', discount_value: 30 },
    ],
    { type: 'amount', value: 0 }
);

assert.equal(summary.grossParts, 18750);
assert.equal(summary.partsDiscount, 0);
assert.equal(summary.grossLabor, 11100);
assert.equal(summary.laborDiscount, 3330);
assert.equal(summary.grossSubtotal, 29850);
assert.equal(summary.linesDiscount, 3330);
assert.equal(summary.jobDiscountAmount, 0);
assert.equal(summary.totalDiscount, 3330);
assert.equal(summary.totalAmount, 26520);

// Test both line discount and job discount
const combo = calcInvoiceSummary(
    [{ quantity: 1, price_at_time_lkr: 10000, discount_type: 'amount', discount_value: 1000 }],
    [{ hours: 2, hourly_rate_lkr: 5000, discount_type: 'percent', discount_value: 20 }], // gross 10000, off 2000 => net 8000
    { type: 'percent', value: 10 } // 10% on remainder (9000 + 8000 = 17000) => 1700
);
assert.equal(combo.grossSubtotal, 20000);
assert.equal(combo.linesDiscount, 3000);
assert.equal(combo.jobDiscountAmount, 1700);
assert.equal(combo.totalDiscount, 4700);
assert.equal(combo.totalAmount, 15300);

console.log('ok');
