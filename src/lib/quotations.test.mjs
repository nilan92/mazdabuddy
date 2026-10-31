// node src/lib/quotations.test.mjs — quote numbering, expiry and pricing (same maths as invoices)
import assert from 'node:assert/strict';
import {
    quotationNumber, effectiveQuotationStatus, canConvertQuotation, calcQuotationSummary, addDaysISO, quotationMessage,
} from './quotations.ts';
import { calcInvoiceSummary } from './totals.ts';

assert.equal(quotationNumber('5416b1a7-1111-2222-3333-444455556666'), 'QUO-5416B1A7');

// Open quotes past their date read as expired; decided ones keep their status.
assert.equal(effectiveQuotationStatus('sent', '2026-10-30', '2026-10-31'), 'expired');
assert.equal(effectiveQuotationStatus('draft', '2026-10-31', '2026-10-31'), 'draft', 'valid through the last day');
assert.equal(effectiveQuotationStatus('accepted', '2026-10-01', '2026-10-31'), 'accepted');
assert.equal(effectiveQuotationStatus('converted', '2026-10-01', '2026-10-31'), 'converted');
assert.equal(effectiveQuotationStatus(null, null, '2026-10-31'), 'draft');
assert.equal(effectiveQuotationStatus('bogus', null, '2026-10-31'), 'draft');

assert.equal(canConvertQuotation('accepted'), true);
assert.equal(canConvertQuotation('sent'), true);
assert.equal(canConvertQuotation('declined'), false);
assert.equal(canConvertQuotation('expired'), false);
assert.equal(canConvertQuotation('accepted', 'job-1'), false, 'never converted twice');

assert.equal(addDaysISO('2026-10-31', 14), '2026-11-14');
assert.equal(addDaysISO('2026-12-25', 7), '2027-01-01');

// Chamath's general service: the quote total must equal what the invoice will bill.
const parts = [
    { quantity: 1, price_at_time_lkr: 18500 },
    { quantity: 1, price_at_time_lkr: 2000 },
    { quantity: 1, price_at_time_lkr: 850 },
];
const labor = [{ quantity: 1, hours: 1, hourly_rate_lkr: 6500, is_fixed: true }];
const q = calcQuotationSummary(parts, labor, { type: 'amount', value: 0 });
assert.equal(q.totalAmount, 27850);
assert.deepEqual(q, calcInvoiceSummary(parts, labor, { type: 'amount', value: 0 }));

const qd = calcQuotationSummary(parts, labor, { type: 'percent', value: 10 });
assert.equal(qd.totalAmount, 27850 - 2785);

assert.match(quotationMessage({ quoteNumber: 'QUO-1', vehicle: 'Mazda 3 (CAQ0462)', total: 27850, validUntil: '14 Nov 2026', shopName: 'Shop' }), /LKR 27,850/);

console.log('quotations ok');
