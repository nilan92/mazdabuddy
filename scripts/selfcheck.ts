// Run: npm run selfcheck
// Plain asserts, no framework. Covers the money math and the PDF logo box.
import assert from 'node:assert/strict';
import { calcInvoiceTotal, DEFAULT_LABOR_RATE_LKR } from '../src/lib/totals.ts';
import { fitLogoBox } from '../src/utils/pdfHelpers.ts';
import { toSriLankanMsisdn, waMeUrl, invoiceMessage } from '../src/lib/whatsapp.ts';
import { smartTitleCase, tidyName } from '../src/lib/textCase.ts';

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

// --- WhatsApp: Sri Lankan number normalisation ---
assert.equal(toSriLankanMsisdn('0771234567'), '94771234567', 'local 0-prefixed');
assert.equal(toSriLankanMsisdn('+94 77 123 4567'), '94771234567', 'international with spaces');
assert.equal(toSriLankanMsisdn('771234567'), '94771234567', 'bare 9-digit');
assert.equal(toSriLankanMsisdn('94771234567'), '94771234567', 'already normalised');
assert.equal(toSriLankanMsisdn('(077) 123-4567'), '94771234567', 'punctuation stripped');
assert.equal(toSriLankanMsisdn(''), null, 'empty is rejected');
assert.equal(toSriLankanMsisdn('123'), null, 'too short is rejected');
assert.equal(toSriLankanMsisdn('07712345678'), null, 'too long is rejected');

// A bad number must still open WhatsApp, just without a recipient — never a
// wa.me/<garbage> link that 404s.
assert.ok(waMeUrl('0771234567', 'hi').startsWith('https://wa.me/94771234567?text='), 'valid number targets the chat');
assert.ok(waMeUrl('nonsense', 'hi').startsWith('https://wa.me/?text='), 'invalid number falls back to picker');
assert.ok(waMeUrl(null, 'a b&c').includes(encodeURIComponent('a b&c')), 'text is url-encoded');

// --- WhatsApp: message body ---
const msg = invoiceMessage({
    invoiceNumber: 'INV-ABC12345', vehicle: 'Mazda Axela (CAB-1234)',
    total: 21700, shopName: 'Performance Automotive', paymentLink: 'https://pay.lk/x',
});
assert.ok(msg.includes('INV-ABC12345'), 'message carries the invoice number');
assert.ok(msg.includes('21,700'), 'total is thousands-separated');
assert.ok(msg.includes('https://pay.lk/x'), 'payment link included when set');
assert.ok(!invoiceMessage({ invoiceNumber: 'X', vehicle: 'V', total: 1 }).includes('Pay here'),
    'no payment line when no link configured');


// --- smartTitleCase: fix lowercase typing without wrecking real makes ---
assert.equal(smartTitleCase('toyota corolla'), 'Toyota Corolla', 'lowercase words are capitalised');
assert.equal(smartTitleCase('BMW'), 'BMW', 'all-caps acronym untouched');
assert.equal(smartTitleCase('KIA Sportage'), 'KIA Sportage', 'mixed case left alone');
assert.equal(smartTitleCase('FORD Ranger'), 'FORD Ranger', 'existing capitals preserved');
assert.equal(smartTitleCase('DFSK'), 'DFSK', 'SL-common acronym untouched');
assert.equal(smartTitleCase("o'brien"), "O'Brien", 'apostrophe is a word boundary');
assert.equal(smartTitleCase('de silva'), 'De Silva', 'each lowercase word capitalised');
assert.equal(smartTitleCase('jean-pierre'), 'Jean-Pierre', 'hyphen is a word boundary');
assert.equal(smartTitleCase(''), '', 'empty string survives');
assert.equal(tidyName('  nimal  perera  '), 'Nimal Perera', 'tidyName trims');
assert.equal(tidyName(null), '', 'tidyName tolerates null');
assert.equal(tidyName(undefined), '', 'tidyName tolerates undefined');

console.log('selfcheck: all assertions passed');