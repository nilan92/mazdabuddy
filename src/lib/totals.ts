export const DEFAULT_LABOR_RATE_LKR = 1500;

/** Pure: no Supabase import, so it stays runnable outside the browser. */
export function calcInvoiceTotal(
    parts: { quantity: number | null; price_at_time_lkr: number | null }[],
    labor: { hours: number | string | null; hourly_rate_lkr: number | null }[],
): number {
    const partsTotal = parts.reduce(
        (sum, p) => sum + (Number(p.quantity) || 0) * (Number(p.price_at_time_lkr) || 0), 0);
    const laborTotal = labor.reduce(
        (sum, l) => sum + (Number(l.hours) || 0) * (Number(l.hourly_rate_lkr) || DEFAULT_LABOR_RATE_LKR), 0);
    return partsTotal + laborTotal;
}

export type DiscountType = 'amount' | 'percent';

/** Mirrors recalc_invoice_total() in update_job_discount.sql — keep the two in step. */
export function calcDiscount(
    subtotal: number,
    type: DiscountType | null | undefined,
    value: number | string | null | undefined,
): number {
    const v = Number(value) || 0;
    if (v <= 0) return 0;
    const raw = type === 'percent' ? Math.round(subtotal * v) / 100 : v;
    return Math.min(Math.max(0, raw), subtotal);
}
