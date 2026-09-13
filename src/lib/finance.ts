/**
 * Pure financial computation. No Supabase, no React — so the money maths can be
 * tested without a browser, which is the part that must not be wrong.
 *
 * The central correction over the previous model: labour and part margin were
 * stored as "expense" rows carrying amount_lkr = 0 with the real figure smuggled
 * through a display_amount field. That is why labour showed up in the expense
 * log, why the CSV exported zeros, and why the totals needed special cases. Here
 * every entry is a signed ledger line with a real amount and an explicit kind.
 */

export type EntryKind = 'income' | 'expense';

/** Where a line came from, which decides whether it can be edited or deleted. */
export type EntrySource = 'labour' | 'parts_sale' | 'parts_cost' | 'manual' | 'discount';

export interface LedgerEntry {
    id: string;
    date: string;
    description: string;
    /** Display grouping — "Labour", "Parts", "Rent", or a tenant's own category. */
    category: string;
    kind: EntryKind;
    /** Always positive. `kind` carries the direction. */
    amount: number;
    source: EntrySource;
    jobRef?: string;
    loggedBy?: string;
    /** Derived lines are computed from job data and cannot be edited directly. */
    editable: boolean;
}

export interface ProfitAndLoss {
    revenueLabour: number;
    revenueParts: number;
    revenueOther: number;
    discounts: number;
    /** What was actually invoiced — the authoritative top line. */
    revenueTotal: number;
    costOfParts: number;
    grossProfit: number;
    grossMarginPct: number;
    operatingExpenses: number;
    expensesByCategory: Record<string, number>;
    depreciation: number;
    netProfit: number;
}

export interface Asset {
    id: string;
    name: string;
    category: string;
    purchase_date: string;
    cost_lkr: number;
    useful_life_years: number;
    residual_lkr?: number | null;
    disposal_date?: string | null;
}

export interface AssetSchedule {
    asset: Asset;
    annualCharge: number;
    /** Depreciation falling inside the period being reported. */
    chargeForPeriod: number;
    accumulated: number;
    netBookValue: number;
}

const n = (v: unknown): number => Number(v) || 0;
const inRange = (iso: string, start: Date, end: Date) => {
    const d = new Date(iso);
    return d >= start && d <= end;
};

/** Money is rounded to cents at the boundary so repeated sums cannot drift. */
export const round2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * Straight-line: (cost − residual) / life, charged from the purchase date and
 * stopping once the asset is fully written down or disposed of. An asset is
 * never depreciated below its residual value, which is the mistake that makes
 * naive schedules go negative on old equipment.
 */
export function depreciate(asset: Asset, periodStart: Date, periodEnd: Date): AssetSchedule {
    const cost = n(asset.cost_lkr);
    const residual = n(asset.residual_lkr);
    const life = n(asset.useful_life_years) || 1;
    const depreciableAmount = Math.max(0, cost - residual);
    const annualCharge = depreciableAmount / life;

    const purchased = new Date(asset.purchase_date);
    const disposed = asset.disposal_date ? new Date(asset.disposal_date) : null;
    const stopAt = disposed && disposed < periodEnd ? disposed : periodEnd;

    const yearsHeld = Math.max(0, (stopAt.getTime() - purchased.getTime()) / (365.25 * 24 * 3600 * 1000));
    const accumulated = Math.min(depreciableAmount, annualCharge * yearsHeld);

    // Only the slice of the charge that falls inside the reported period.
    const chargeStart = purchased > periodStart ? purchased : periodStart;
    const yearsInPeriod = Math.max(0, (stopAt.getTime() - chargeStart.getTime()) / (365.25 * 24 * 3600 * 1000));
    const uncharged = Math.max(0, depreciableAmount - Math.max(0, annualCharge *
        Math.max(0, (chargeStart.getTime() - purchased.getTime()) / (365.25 * 24 * 3600 * 1000))));
    const chargeForPeriod = Math.min(uncharged, annualCharge * yearsInPeriod);

    return {
        asset,
        annualCharge: round2(annualCharge),
        chargeForPeriod: round2(chargeForPeriod),
        accumulated: round2(accumulated),
        netBookValue: round2(cost - accumulated),
    };
}

export interface LedgerSources {
    invoices: { total_amount_lkr: unknown; discount_lkr?: unknown; created_at: string }[];
    jobLabour: { id: string; created_at: string; description?: string | null; hours: unknown;
        hourly_rate_lkr: unknown; is_fixed?: boolean; jobRef?: string; mechanic_name?: string | null }[];
    jobParts: { id: string; created_at: string; quantity: unknown; price_at_time_lkr: unknown;
        cost_at_time_lkr?: unknown; is_custom?: boolean; custom_name?: string | null;
        partName?: string | null; jobRef?: string }[];
    manual: { id: string; date: string; description?: string | null; category?: string | null;
        amount_lkr: unknown; is_income?: boolean; loggedBy?: string | null }[];
}

/** Flattens every source into one signed ledger, newest first. */
export function buildLedger(src: LedgerSources): LedgerEntry[] {
    const entries: LedgerEntry[] = [];

    for (const l of src.jobLabour) {
        entries.push({
            id: `labour-${l.id}`,
            date: l.created_at,
            description: l.description || 'Labour',
            category: 'Labour',
            kind: 'income',
            amount: round2(n(l.hours) * n(l.hourly_rate_lkr)),
            source: 'labour',
            jobRef: l.jobRef,
            loggedBy: l.mechanic_name || undefined,
            editable: false,
        });
    }

    for (const p of src.jobParts) {
        const qty = n(p.quantity);
        const name = p.partName || p.custom_name || 'Part';
        entries.push({
            id: `partsale-${p.id}`, date: p.created_at,
            description: name, category: 'Parts',
            kind: 'income', amount: round2(qty * n(p.price_at_time_lkr)),
            source: 'parts_sale', jobRef: p.jobRef, editable: false,
        });
        const cost = qty * n(p.cost_at_time_lkr);
        if (cost > 0) {
            entries.push({
                id: `partcost-${p.id}`, date: p.created_at,
                description: `Cost of ${name}`, category: 'Cost of parts',
                kind: 'expense', amount: round2(cost),
                source: 'parts_cost', jobRef: p.jobRef, editable: false,
            });
        }
    }

    for (const m of src.manual) {
        entries.push({
            id: m.id, date: m.date,
            description: m.description || '(no description)',
            category: m.category || 'Other',
            kind: m.is_income ? 'income' : 'expense',
            amount: round2(Math.abs(n(m.amount_lkr))),
            source: 'manual',
            loggedBy: m.loggedBy || undefined,
            editable: true,
        });
    }

    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Revenue is taken from invoices, never by summing the labour and parts lines:
 * the invoice is the authoritative figure and already carries the discount. The
 * labour/parts split is presented as the *composition* of that total, which is
 * why discounts appear as a reconciling line rather than being netted silently.
 */
export function profitAndLoss(
    entries: LedgerEntry[],
    invoices: { total_amount_lkr: unknown; discount_lkr?: unknown; created_at: string }[],
    start: Date, end: Date,
    depreciationForPeriod = 0,
): ProfitAndLoss {
    const inPeriod = entries.filter(e => inRange(e.date, start, end));
    const sum = (pred: (e: LedgerEntry) => boolean) =>
        round2(inPeriod.filter(pred).reduce((t, e) => t + e.amount, 0));

    const periodInvoices = invoices.filter(i => inRange(i.created_at, start, end));
    const revenueTotal = round2(periodInvoices.reduce((t, i) => t + n(i.total_amount_lkr), 0));
    const discounts = round2(periodInvoices.reduce((t, i) => t + n(i.discount_lkr), 0));

    const revenueLabour = sum(e => e.source === 'labour');
    const revenueParts = sum(e => e.source === 'parts_sale');
    const revenueOther = sum(e => e.kind === 'income' && e.source === 'manual');
    const costOfParts = sum(e => e.source === 'parts_cost');

    const operatingEntries = inPeriod.filter(e => e.kind === 'expense' && e.source === 'manual');
    const operatingExpenses = round2(operatingEntries.reduce((t, e) => t + e.amount, 0));
    const expensesByCategory: Record<string, number> = {};
    for (const e of operatingEntries) {
        expensesByCategory[e.category] = round2((expensesByCategory[e.category] || 0) + e.amount);
    }

    const grossProfit = round2(revenueTotal - costOfParts);
    const netProfit = round2(grossProfit + revenueOther - operatingExpenses - depreciationForPeriod);

    return {
        revenueLabour, revenueParts, revenueOther, discounts, revenueTotal,
        costOfParts, grossProfit,
        grossMarginPct: revenueTotal > 0 ? round2((grossProfit / revenueTotal) * 100) : 0,
        operatingExpenses, expensesByCategory,
        depreciation: round2(depreciationForPeriod),
        netProfit,
    };
}

export interface BalanceSheet {
    fixedAssetsNbv: number;
    stock: number;
    debtors: number;
    bank: number;
    cash: number;
    totalAssets: number;
    payables: number;
    loans: number;
    totalLiabilities: number;
    shareCapital: number;
    retainedEarningsBf: number;
    profitForYear: number;
    retainedEarningsCf: number;
    totalEquity: number;
    /** Assets − (liabilities + equity). Non-zero means an input is missing. */
    difference: number;
    balances: boolean;
}

/**
 * Assembles the statement of financial position. What the system knows
 * (asset NBV, stock at cost, unpaid invoices) is computed; what it cannot know
 * (bank, cash, payables, loans, capital, opening reserves) comes from the
 * tenant's own inputs. The difference is surfaced rather than hidden — a
 * balance sheet that silently plugs its own gap is worse than one that admits
 * it does not balance.
 */
export function balanceSheet(input: {
    fixedAssetsNbv: number; stock: number; debtors: number;
    bank: number; cash: number; payables: number; loans: number;
    shareCapital: number; retainedEarningsBf: number; profitForYear: number;
}): BalanceSheet {
    const totalAssets = round2(input.fixedAssetsNbv + input.stock + input.debtors + input.bank + input.cash);
    const totalLiabilities = round2(input.payables + input.loans);
    const retainedEarningsCf = round2(input.retainedEarningsBf + input.profitForYear);
    const totalEquity = round2(input.shareCapital + retainedEarningsCf);
    const difference = round2(totalAssets - (totalLiabilities + totalEquity));

    return {
        ...input,
        totalAssets, totalLiabilities, retainedEarningsCf, totalEquity,
        difference,
        balances: Math.abs(difference) < 1,
    };
}
