import { supabase } from './supabase';
import { calcInvoiceSummary } from './totals';

/**
 * Creates the invoice for a completed job, unless one already exists.
 *
 * Totals are read from the database rather than component state so this behaves
 * identically whether it is called from the job card or from a kanban drag —
 * the drag handler has no parts/labor loaded.
 */
export async function ensureInvoiceForJob(
    jobId: string,
    tenantId: string,
): Promise<{ created: boolean; error?: string }> {
    const { data: existing, error: lookupError } = await supabase
        .from('invoices')
        .select('id')
        .eq('job_id', jobId)
        .limit(1)
        .maybeSingle();

    if (lookupError) return { created: false, error: lookupError.message };
    if (existing) return { created: false };

    const [partsRes, laborRes, jobRes] = await Promise.all([
        supabase.from('job_parts').select('quantity, price_at_time_lkr, discount_type, discount_value').eq('job_id', jobId),
        supabase.from('job_labor').select('hours, hourly_rate_lkr, discount_type, discount_value').eq('job_id', jobId),
        supabase.from('job_cards').select('discount_type, discount_value').eq('id', jobId).single(),
    ]);

    const readError = partsRes.error ?? laborRes.error;
    if (readError) return { created: false, error: readError.message };

    const summary = calcInvoiceSummary(
        partsRes.data ?? [],
        laborRes.data ?? [],
        jobRes.data ? { type: jobRes.data.discount_type, value: jobRes.data.discount_value } : null
    );

    const { error } = await supabase.from('invoices').insert({
        job_id: jobId,
        tenant_id: tenantId,
        subtotal_lkr: summary.grossSubtotal,
        tax_lkr: 0,
        discount_lkr: summary.totalDiscount,
        total_amount_lkr: summary.totalAmount,
        created_at: new Date().toISOString(),
        status: 'Unpaid',
    });

    if (error) return { created: false, error: error.message };
    return { created: true };
}
