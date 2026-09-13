// node src/lib/finance.test.mjs
import assert from 'node:assert/strict';
import { buildLedger, profitAndLoss, depreciate, balanceSheet, round2, ageItems, bucketFor, ageOf } from './finance.ts';

const FY_START = new Date(2026, 3, 1);   // 1 Apr 2026
const FY_END = new Date(2027, 2, 31, 23, 59, 59);

const sources = {
  invoices: [
    { total_amount_lkr: 18000, discount_lkr: 2000, created_at: '2026-06-10T00:00:00Z' },
    { total_amount_lkr: 5000, discount_lkr: 0, created_at: '2026-07-01T00:00:00Z' },
    { total_amount_lkr: 99999, discount_lkr: 0, created_at: '2025-01-01T00:00:00Z' }, // prior FY
  ],
  jobLabour: [
    { id: 'l1', created_at: '2026-06-10T00:00:00Z', description: 'Brake job', hours: 4, hourly_rate_lkr: 2500 },
    { id: 'l2', created_at: '2026-07-01T00:00:00Z', description: 'Service', hours: 1, hourly_rate_lkr: 3000, is_fixed: true },
  ],
  jobParts: [
    { id: 'p1', created_at: '2026-06-10T00:00:00Z', quantity: 2, price_at_time_lkr: 5000, cost_at_time_lkr: 3000, partName: 'Pads' },
    { id: 'p2', created_at: '2026-07-01T00:00:00Z', quantity: 1, price_at_time_lkr: 2000, cost_at_time_lkr: 900, partName: 'Filter' },
  ],
  manual: [
    { id: 'm1', date: '2026-05-02', description: 'Electricity', category: 'Utilities', amount_lkr: 12000 },
    { id: 'm2', date: '2026-05-20', description: 'Rent', category: 'Rent', amount_lkr: 40000 },
    { id: 'm3', date: '2026-06-15', description: 'Scrap metal', category: 'Scrap', amount_lkr: 7000, is_income: true },
    { id: 'm4', date: '2025-01-05', description: 'Old year rent', category: 'Rent', amount_lkr: 999999 }, // prior FY
  ],
};

// ---- ledger ----------------------------------------------------------------
const ledger = buildLedger(sources);
assert.equal(ledger.length, 2 + 4 + 4, 'labour + (sale+cost per part) + manual');
assert.ok(ledger.every(e => e.amount >= 0), 'amounts are unsigned; kind carries direction');

// The bug this model replaces: labour used to be an expense row of amount 0.
const labour = ledger.filter(e => e.source === 'labour');
assert.equal(labour.length, 2);
assert.ok(labour.every(e => e.kind === 'income'), 'labour is income for a workshop');
assert.equal(labour.reduce((t, e) => t + e.amount, 0), 13000, '4x2500 + 1x3000');
assert.ok(labour.every(e => e.amount > 0), 'labour carries a real amount, not 0 + display_amount');
assert.ok(labour.every(e => !e.editable), 'derived from the job card, not hand-entered');

// ---- P&L -------------------------------------------------------------------
const pl = profitAndLoss(ledger, sources.invoices, FY_START, FY_END);
assert.equal(pl.revenueTotal, 23000, 'invoices in the FY only; the 2025 one is excluded');
assert.equal(pl.discounts, 2000);
assert.equal(pl.revenueLabour, 13000);
assert.equal(pl.revenueParts, 12000, '2x5000 + 1x2000');
assert.equal(pl.revenueOther, 7000, 'scrap');
assert.equal(pl.costOfParts, 6900, '2x3000 + 1x900');
assert.equal(pl.grossProfit, 23000 - 6900);
assert.equal(pl.operatingExpenses, 52000, 'rent + electricity, prior-year rent excluded');
assert.deepEqual(pl.expensesByCategory, { Utilities: 12000, Rent: 40000 });
assert.equal(pl.netProfit, 16100 + 7000 - 52000);

// Revenue must come from invoices, not from summing labour+parts, or the
// discount would be double-counted.
assert.notEqual(pl.revenueTotal, pl.revenueLabour + pl.revenueParts,
  'labour+parts is gross of discount; the invoice total is net');
assert.equal(pl.revenueLabour + pl.revenueParts - pl.discounts, pl.revenueTotal, 'and they reconcile');

// Depreciation reduces net profit but not gross.
const plDep = profitAndLoss(ledger, sources.invoices, FY_START, FY_END, 45000);
assert.equal(plDep.grossProfit, pl.grossProfit);
assert.equal(plDep.netProfit, pl.netProfit - 45000);

// ---- depreciation ----------------------------------------------------------
const hoist = { id: 'a1', name: 'Hoist', category: 'equipment',
  purchase_date: '2025-04-01', cost_lkr: 450000, useful_life_years: 10, residual_lkr: 0 };
const s = depreciate(hoist, FY_START, FY_END);
assert.equal(s.annualCharge, 45000, '450000 / 10');
assert.ok(Math.abs(s.chargeForPeriod - 45000) < 200, 'one full year falls in this FY');
assert.ok(Math.abs(s.accumulated - 90000) < 300, 'two years held by 31 Mar 2027');
assert.ok(Math.abs(s.netBookValue - 360000) < 300);

// Never depreciates past residual, however old.
const ancient = { ...hoist, purchase_date: '2000-01-01', residual_lkr: 50000 };
const old = depreciate(ancient, FY_START, FY_END);
assert.equal(old.accumulated, 400000, 'stops at cost - residual');
assert.equal(old.netBookValue, 50000, 'never below residual');
assert.equal(old.chargeForPeriod, 0, 'fully written down, nothing left to charge');

// An asset bought mid-period is charged only from its purchase date.
const midYear = { ...hoist, purchase_date: '2026-10-01' };
const mid = depreciate(midYear, FY_START, FY_END);
assert.ok(mid.chargeForPeriod > 20000 && mid.chargeForPeriod < 23000,
  `about half a year: got ${mid.chargeForPeriod}`);

// ---- balance sheet ---------------------------------------------------------
const bs = balanceSheet({
  fixedAssetsNbv: 360000, stock: 120000, debtors: 80000, bank: 200000, cash: 15000,
  payables: 95000, loans: 150000, shareCapital: 100000,
  retainedEarningsBf: 200000, profitForYear: 230000,
});
assert.equal(bs.totalAssets, 775000);
assert.equal(bs.totalLiabilities, 245000);
assert.equal(bs.retainedEarningsCf, 430000);
assert.equal(bs.totalEquity, 530000);
assert.equal(bs.difference, 0);
assert.equal(bs.balances, true);

// A missing input must be reported, not silently plugged.
const off = balanceSheet({ ...{
  fixedAssetsNbv: 360000, stock: 120000, debtors: 80000, bank: 200000, cash: 15000,
  payables: 95000, loans: 150000, shareCapital: 100000,
  retainedEarningsBf: 200000, profitForYear: 230000,
}, bank: 150000 });
assert.equal(off.difference, -50000);
assert.equal(off.balances, false, 'does not pretend to balance');

assert.equal(round2(0.1 + 0.2), 0.3, 'cents are rounded at the boundary');

// ---- ageing ----------------------------------------------------------------
const asOf = new Date('2026-09-13T00:00:00Z');
assert.equal(ageOf('2026-09-13T00:00:00Z', asOf), 0);
assert.equal(ageOf('2026-08-14T00:00:00Z', asOf), 30);
assert.equal(ageOf('2099-01-01T00:00:00Z', asOf), 0, 'future dates are not negative');
assert.equal(ageOf('not a date', asOf), 0, 'garbage does not produce NaN');

assert.equal(bucketFor(0), 'current');
assert.equal(bucketFor(30), '1-30');
assert.equal(bucketFor(31), '31-60');
assert.equal(bucketFor(91), '90+');

const aged = ageItems([
  { id: 'i1', reference: 'INV-1', counterparty: 'Mr Perera', date: '2026-09-13T00:00:00Z', amount: 1000 },
  { id: 'i2', reference: 'INV-2', counterparty: 'Mrs Silva', date: '2026-08-20T00:00:00Z', amount: 2000 },
  { id: 'i3', reference: 'INV-3', counterparty: 'Fleet Ltd', date: '2026-05-01T00:00:00Z', amount: 5000 },
], asOf);
assert.equal(aged.total, 8000);
assert.equal(aged.byBucket['current'], 1000);
assert.equal(aged.byBucket['1-30'], 2000);
assert.equal(aged.byBucket['90+'], 5000);
assert.equal(aged.overdue, 5000, 'only past 30 days counts as worth chasing');
assert.equal(aged.items[0].reference, 'INV-3', 'oldest first — that is what gets chased');

console.log('ok');
