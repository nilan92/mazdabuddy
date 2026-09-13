// node src/lib/fiscal.test.mjs — Sri Lankan 1 Apr – 31 Mar financial year
import assert from 'node:assert/strict';
import { fyStart, fyEnd, fyLabel, toISODate, describePeriod } from './fiscal.ts';

// A date inside the FY that opened this calendar year.
assert.equal(toISODate(fyStart(new Date(2026, 8, 13))), '2026-04-01', 'Sept 2026 sits in FY starting Apr 2026');
assert.equal(toISODate(fyEnd(new Date(2026, 8, 13))), '2027-03-31');
assert.equal(fyLabel(new Date(2026, 8, 13)), 'FY 2026/27');

// A date before April belongs to the FY that opened the *previous* calendar year.
assert.equal(toISODate(fyStart(new Date(2026, 1, 15))), '2025-04-01', 'Feb 2026 sits in FY starting Apr 2025');
assert.equal(toISODate(fyEnd(new Date(2026, 1, 15))), '2026-03-31');
assert.equal(fyLabel(new Date(2026, 1, 15)), 'FY 2025/26');

// Boundaries either side of 1 April.
assert.equal(fyLabel(new Date(2026, 2, 31)), 'FY 2025/26', '31 March is the last day of the old year');
assert.equal(fyLabel(new Date(2026, 3, 1)), 'FY 2026/27', '1 April opens the new one');

// toISODate must read the local calendar. At UTC+5:30 toISOString() would
// return the previous day here, which is what put the FY in the wrong year.
assert.equal(toISODate(new Date(2026, 3, 1)), '2026-04-01');
assert.equal(toISODate(new Date(2027, 2, 31)), '2027-03-31');

// Period naming
assert.equal(describePeriod('2026-04-01', '2027-03-31'), 'FY 2026/27 · 1 Apr 2026 – 31 Mar 2027');
assert.equal(describePeriod('2026-09-01', '2026-09-30'), 'September 2026 · 1 Sep 2026 – 30 Sep 2026');
assert.equal(describePeriod('2026-09-03', '2026-09-19'), '3 Sep 2026 – 19 Sep 2026', 'partial ranges just show dates');
assert.equal(describePeriod('2026-04-01', '2026-12-31'), '1 Apr 2026 – 31 Dec 2026', 'part-year is not a full FY');

console.log('ok');
