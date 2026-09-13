/**
 * Sri Lankan companies run a 1 April – 31 March financial year, so a calendar
 * year is the wrong unit everywhere money is reported.
 *
 * Dates are formatted from the local calendar, never via toISOString(). At
 * UTC+5:30, `new Date(2026, 3, 1).toISOString()` is "2026-03-31T18:30:00Z" —
 * split on 'T' and the financial year starts a day early, in the wrong year.
 */

/** April, zero-based, as the Date constructor wants it. */
export const FY_START_MONTH = 3;

export const toISODate = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** 1 April of the financial year containing `d`. */
export function fyStart(d: Date = new Date()): Date {
    const year = d.getMonth() >= FY_START_MONTH ? d.getFullYear() : d.getFullYear() - 1;
    return new Date(year, FY_START_MONTH, 1);
}

/** 31 March closing the financial year containing `d`. Day 0 of April is 31 March. */
export function fyEnd(d: Date = new Date()): Date {
    return new Date(fyStart(d).getFullYear() + 1, FY_START_MONTH, 0);
}

/** "FY 2026/27" — both years, because "2026" alone is ambiguous for an Apr–Mar year. */
export function fyLabel(d: Date = new Date()): string {
    const start = fyStart(d).getFullYear();
    return `FY ${start}/${String(start + 1).slice(-2)}`;
}

// Spelled out rather than taken from toLocaleDateString: ICU renders September
// as "Sept" in some environments and "Sep" in others, so the same report would
// read differently depending on the device that produced it.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

const dmy = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

/** "1 Apr 2026 – 31 Mar 2027", for a report header a human has to read. */
export function formatRange(start: Date, end: Date): string {
    return `${dmy(start)} – ${dmy(end)}`;
}

/** Names the period the way an accountant would, given the two bounding dates. */
export function describePeriod(startISO: string, endISO: string): string {
    const start = new Date(`${startISO}T00:00:00`);
    const end = new Date(`${endISO}T00:00:00`);
    const range = formatRange(start, end);

    const isFullFy =
        start.getDate() === 1 && start.getMonth() === FY_START_MONTH &&
        toISODate(fyEnd(start)) === endISO;
    if (isFullFy) return `${fyLabel(start)} · ${range}`;

    const sameMonth = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
    const isFullMonth =
        sameMonth && start.getDate() === 1 &&
        end.getDate() === new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
    if (isFullMonth) {
        return `${MONTHS_FULL[start.getMonth()]} ${start.getFullYear()} · ${range}`;
    }

    return range;
}
