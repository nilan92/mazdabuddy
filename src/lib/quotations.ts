import { calcInvoiceSummary, type InvoiceLineItem, type InvoiceSummary, type DiscountType } from './totals.ts';

/** Pure: no Supabase import, so it stays runnable outside the browser. */

export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'expired' | 'converted';

export const QUOTATION_STATUSES: QuotationStatus[] = ['draft', 'sent', 'accepted', 'declined', 'expired', 'converted'];

export const QUOTATION_STATUS_LABEL: Record<QuotationStatus, string> = {
    draft: 'Draft',
    sent: 'Sent',
    accepted: 'Accepted',
    declined: 'Declined',
    expired: 'Expired',
    converted: 'Converted to job',
};

export const QUOTATION_STATUS_STYLE: Record<QuotationStatus, string> = {
    draft: 'bg-slate-700/40 text-slate-300 border-slate-600',
    sent: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
    accepted: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    declined: 'bg-red-500/10 text-red-300 border-red-500/30',
    expired: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    converted: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
};

export interface QuotationPartRow {
    id?: string;
    part_id?: string | null;
    is_custom?: boolean | null;
    custom_name?: string | null;
    quantity: number | string | null;
    price_at_time_lkr: number | string | null;
    cost_at_time_lkr?: number | string | null;
    discount_type?: DiscountType | null;
    discount_value?: number | string | null;
    sort_order?: number | null;
    parts?: { name?: string | null } | null;
}

export interface QuotationLaborRow {
    id?: string;
    description?: string | null;
    quantity?: number | string | null;
    hours: number | string | null;
    hourly_rate_lkr: number | string | null;
    is_fixed?: boolean | null;
    discount_type?: DiscountType | null;
    discount_value?: number | string | null;
    sort_order?: number | null;
}

export const bySortOrder = <T extends { sort_order?: number | null }>(rows: T[] = []): T[] =>
    [...rows].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

/** Same shape as invoices: INV-5416B1A7 ↔ QUO-5416B1A7. */
export function quotationNumber(id: string): string {
    return `QUO-${(id || '').slice(0, 8).toUpperCase()}`;
}

/** A quote still open (draft/sent) past its validity date reads as Expired,
 *  without anyone having to go back and mark it. `today` is a YYYY-MM-DD local date. */
export function effectiveQuotationStatus(
    status: string | null | undefined,
    validUntil: string | null | undefined,
    today: string,
): QuotationStatus {
    const s = (QUOTATION_STATUSES as string[]).includes(status || '') ? (status as QuotationStatus) : 'draft';
    if ((s === 'draft' || s === 'sent') && validUntil && validUntil < today) return 'expired';
    return s;
}

/** A quote can become a job unless it already did, or the customer said no. */
export function canConvertQuotation(status: QuotationStatus, jobId?: string | null): boolean {
    if (jobId) return false;
    return status === 'draft' || status === 'sent' || status === 'accepted';
}

/** Priced exactly the way the job will be invoiced. */
export function calcQuotationSummary(
    parts: InvoiceLineItem[],
    labor: InvoiceLineItem[],
    discount?: { type?: DiscountType | null; value?: number | string | null } | null,
): InvoiceSummary {
    return calcInvoiceSummary(parts, labor, discount ?? null);
}

export function addDaysISO(isoDate: string, days: number): string {
    const [y, m, d] = isoDate.split('-').map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    dt.setDate(dt.getDate() + days);
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${dt.getFullYear()}-${mm}-${dd}`;
}

export function quotationMessage(q: {
    quoteNumber: string;
    vehicle: string;
    total: number;
    validUntil?: string | null;
    shopName?: string | null;
}): string {
    const lines = [
        `Quotation ${q.quoteNumber}${q.shopName ? ` from ${q.shopName}` : ''}`,
        `Vehicle: ${q.vehicle}`,
        `Estimated total: LKR ${Number(q.total || 0).toLocaleString()}`,
    ];
    if (q.validUntil) lines.push(`Valid until: ${q.validUntil}`);
    lines.push('Reply to confirm and we will book the work in.');
    return lines.join('\n');
}
