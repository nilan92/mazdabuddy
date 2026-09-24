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

/** Mirrors recalc_invoice_total() in update_job_discount.sql / update_line_discounts.sql — keep in step. */
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

export interface InvoiceLineItem {
    quantity?: number | string | null;
    price_at_time_lkr?: number | string | null;
    hours?: number | string | null;
    hourly_rate_lkr?: number | string | null;
    discount_type?: DiscountType | null;
    discount_value?: number | string | null;
}

export interface InvoiceSummary {
    grossParts: number;
    partsDiscount: number;
    grossLabor: number;
    laborDiscount: number;
    grossSubtotal: number;
    linesDiscount: number;
    netLines: number;
    jobDiscountAmount: number;
    totalDiscount: number;
    totalAmount: number;
}

/** Pure invoice calculation: gross subtotal, line discounts, job discount, and net total. */
export function calcInvoiceSummary(
    parts: InvoiceLineItem[],
    labor: InvoiceLineItem[],
    jobDiscount?: { type?: DiscountType | null; value?: number | string | null } | null,
    tax: number = 0,
): InvoiceSummary {
    let grossParts = 0;
    let partsDiscount = 0;
    for (const p of parts) {
        const gross = (Number(p.quantity) || 0) * (Number(p.price_at_time_lkr) || 0);
        const off = calcDiscount(gross, p.discount_type, p.discount_value);
        grossParts += gross;
        partsDiscount += off;
    }

    let grossLabor = 0;
    let laborDiscount = 0;
    for (const l of labor) {
        const gross = (Number(l.hours) || 0) * (Number(l.hourly_rate_lkr) || DEFAULT_LABOR_RATE_LKR);
        const off = calcDiscount(gross, l.discount_type, l.discount_value);
        grossLabor += gross;
        laborDiscount += off;
    }

    const grossSubtotal = grossParts + grossLabor;
    const linesDiscount = partsDiscount + laborDiscount;
    const netLines = Math.max(0, grossSubtotal - linesDiscount);

    const jobDiscountAmount = jobDiscount
        ? calcDiscount(netLines, jobDiscount.type, jobDiscount.value)
        : 0;

    const totalDiscount = linesDiscount + jobDiscountAmount;
    const totalAmount = Math.max(0, grossSubtotal - totalDiscount + (Number(tax) || 0));

    return {
        grossParts,
        partsDiscount,
        grossLabor,
        laborDiscount,
        grossSubtotal,
        linesDiscount,
        netLines,
        jobDiscountAmount,
        totalDiscount,
        totalAmount,
    };
}
