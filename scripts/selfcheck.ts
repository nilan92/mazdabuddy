// Run: npm run selfcheck
// Plain asserts, no framework. Covers the money math and the PDF logo box.
import assert from 'node:assert/strict';
import { calcInvoiceTotal, DEFAULT_LABOR_RATE_LKR } from '../src/lib/totals.ts';
import { fitLogoBox } from '../src/utils/pdfHelpers.ts';

// --- calcInvoiceTotal ---
assert.equal(calcInvoiceTotal([], []), 0, 'empty job invoices at zero');

assert.equal(
    calcInvoiceTotal([{ quantity: 3, price_at_time_lkr: 2000 }], []),
    6000, 'parts multiply by quantity');

assert.equal(
    calcInvoiceTotal([], [{ hours: 2, hourly_rate_lkr: 2500 }]),
    5000, 'labor multiplies by rate');

assert.equal(
    calcInvoiceTotal([{ quantity: 3, price_at_time_lkr: 2000 }], [{ hours: 2, hourly_rate_lkr: 2500 }]),
    11000, 'parts and labor sum');

// hours arrives as a string from numeric columns via PostgREST
assert.equal(
    calcInvoiceTotal([], [{ hours: '1.5', hourly_rate_lkr: 2000 }]),
    3000, 'string hours are coerced');

assert.equal(
    calcInvoiceTotal([], [{ hours: 2, hourly_rate_lkr: null }]),
    2 * DEFAULT_LABOR_RATE_LKR, 'null rate falls back to the default');

assert.equal(
    calcInvoiceTotal([{ quantity: null, price_at_time_lkr: null }], []),
    0, 'null part fields do not produce NaN');

// --- fitLogoBox ---
// The bug: a square logo sized by width alone was 30mm tall and ran into the
// divider rule at y=40. Bounded, it must not exceed the height cap.
assert.deepEqual(fitLogoBox(512, 512, 30, 22), { width: 22, height: 22 }, 'square logo is capped by height');
assert.deepEqual(fitLogoBox(600, 200, 30, 22), { width: 30, height: 10 }, 'wide logo is capped by width');
assert.equal(fitLogoBox(200, 600, 30, 22).height, 22, 'portrait logo never exceeds max height');
assert.ok(fitLogoBox(200, 600, 30, 22).width <= 30, 'portrait logo never exceeds max width');
assert.deepEqual(fitLogoBox(0, 0, 30, 22), { width: 30, height: 22 }, 'degenerate image falls back to the box');

console.log('selfcheck: all assertions passed');
