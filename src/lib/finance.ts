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

/**
 * Money is rounded to cents at the boundary so repeated sums cannot drift.
 * Negative zero is normalised: -0 would otherwise survive a subtraction and
 * print as "(0.00)" in a statement, and it fails a strict equality against 0.
 */
export const round2 = (v: number): number => {
    const r = Math.round(v * 100) / 100;
    return r === 0 ? 0 : r;
};

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

/* ------------------------------------------------------------------ ageing */

export interface AgedItem {
    id: string;
    /** Invoice number, or supplier/description for a bill. */
    reference: string;
    counterparty: string;
    date: string;
    amount: number;
    daysOld: number;
    bucket: AgeBucket;
    phone?: string | null;
}

export type AgeBucket = 'current' | '1-30' | '31-60' | '61-90' | '90+';

export const AGE_BUCKETS: AgeBucket[] = ['current', '1-30', '31-60', '61-90', '90+'];

/** Days outstanding, counted from the document date. */
export function ageOf(dateISO: string, asOf: Date = new Date()): number {
    const d = new Date(dateISO);
    if (isNaN(d.getTime())) return 0;
    return Math.max(0, Math.floor((asOf.getTime() - d.getTime()) / 86400000));
}

export function bucketFor(days: number): AgeBucket {
    if (days <= 0) return 'current';
    if (days <= 30) return '1-30';
    if (days <= 60) return '31-60';
    if (days <= 90) return '61-90';
    return '90+';
}

/**
 * Ages a set of open documents. Used for both sides of the ledger: unpaid
 * invoices owed to the workshop, and unpaid bills the workshop owes.
 */
export function ageItems(
    items: { id: string; reference: string; counterparty: string; date: string; amount: number; phone?: string | null }[],
    asOf: Date = new Date(),
): { items: AgedItem[]; byBucket: Record<AgeBucket, number>; total: number; overdue: number } {
    const byBucket = Object.fromEntries(AGE_BUCKETS.map(b => [b, 0])) as Record<AgeBucket, number>;
    const aged = items.map(i => {
        const daysOld = ageOf(i.date, asOf);
        const bucket = bucketFor(daysOld);
        byBucket[bucket] = round2(byBucket[bucket] + i.amount);
        return { ...i, daysOld, bucket };
    }).sort((a, b) => b.daysOld - a.daysOld);

    return {
        items: aged,
        byBucket,
        total: round2(aged.reduce((t, i) => t + i.amount, 0)),
        // Anything past 30 days is the money actually worth chasing.
        overdue: round2(byBucket['31-60'] + byBucket['61-90'] + byBucket['90+']),
    };
}

/* ------------------------------------------------------- double-entry books */

/**
 * Every transaction is posted as equal debits and credits against named
 * accounts, on the accrual basis: revenue is recognised when the work is
 * invoiced and a cost when it is incurred, not when the money moves. The cash
 * side is a second, separate entry made on the settlement date.
 *
 * Debits are positive, credits negative, so a correct set of books sums to
 * exactly zero. That property is the point — it is what makes an error
 * detectable rather than invisible.
 */

/** Net movement on one account across the period, debits positive. */
function movementOn(journal: JournalEntry[], code: string, start: Date, end: Date): number {
    let net = 0;
    for (const e of journal) {
        const d = new Date(e.date);
        if (d < start || d > end) continue;
        for (const l of e.lines) if (l.account.code === code) net += l.amount;
    }
    return round2(net);
}


export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

export interface Account {
    code: string;
    name: string;
    type: AccountType;
}

export const ACCOUNTS: Record<string, Account> = {
    FIXED_ASSETS: { code: '1000', name: 'Fixed assets at cost', type: 'asset' },
    ACC_DEP: { code: '1010', name: 'Accumulated depreciation', type: 'asset' },
    STOCK: { code: '1100', name: 'Stock of parts', type: 'asset' },
    RECEIVABLES: { code: '1200', name: 'Trade receivables', type: 'asset' },
    BANK: { code: '1300', name: 'Bank', type: 'asset' },
    CASH: { code: '1310', name: 'Cash in hand', type: 'asset' },
    PAYABLES: { code: '2000', name: 'Trade payables', type: 'liability' },
    LOANS: { code: '2100', name: 'Loans and borrowings', type: 'liability' },
    CAPITAL: { code: '3000', name: 'Stated capital', type: 'equity' },
    RETAINED: { code: '3100', name: 'Retained earnings brought forward', type: 'equity' },
    REV_LABOUR: { code: '4000', name: 'Revenue — labour', type: 'income' },
    REV_PARTS: { code: '4010', name: 'Revenue — parts', type: 'income' },
    REV_OTHER: { code: '4020', name: 'Other income', type: 'income' },
    DISCOUNTS: { code: '4030', name: 'Discounts allowed', type: 'income' },
    COGS: { code: '5000', name: 'Cost of parts sold', type: 'expense' },
    OPEX: { code: '6000', name: 'Operating expenses', type: 'expense' },
    DEPRECIATION: { code: '6900', name: 'Depreciation', type: 'expense' },
    UNRECORDED_PURCHASES: { code: '2900', name: 'Unrecorded parts purchases', type: 'liability' },
    SUSPENSE: { code: '9999', name: 'Suspense — unreconciled', type: 'equity' },
};

export interface JournalLine {
    account: Account;
    /** Positive debit, negative credit. */
    amount: number;
}

export interface JournalEntry {
    id: string;
    date: string;
    narrative: string;
    lines: JournalLine[];
}

const dr = (account: Account, amount: number): JournalLine => ({ account, amount: round2(amount) });
const cr = (account: Account, amount: number): JournalLine => ({ account, amount: round2(-amount) });

/** An operating-expense account per category, so the P&L can be read by category. */
const opexAccount = (category: string): Account =>
    ({ code: '6000', name: category, type: 'expense' });

/**
 * Buying parts is not a cost — it is swapping cash for stock. The cost lands
 * later, when the part is fitted to a job and moves from Stock to cost of
 * sales. Perpetual inventory, which is what the parts table already maintains.
 *
 * Expenses filed under this category therefore debit Stock rather than an
 * expense account. Without it the Stock account only ever received credits as
 * parts were consumed, and ran negative.
 */
export const STOCK_PURCHASE_CATEGORY = 'Parts purchases';

export interface JournalSources extends LedgerSources {
    invoicesFull: {
        id: string; created_at: string; total_amount_lkr: unknown;
        discount_lkr?: unknown; status?: string | null; paid_on?: string | null;
    }[];
    manualFull: {
        id: string; date: string; description?: string | null; category?: string | null;
        amount_lkr: unknown; is_income?: boolean; paid?: boolean; paid_on?: string | null;
    }[];
    assets: Asset[];
    depreciationByAsset: { assetId: string; charge: number }[];
    periodEndISO: string;
}

/**
 * Builds the journal. Sales are posted from the labour and parts lines with the
 * discount as a contra-revenue debit, so the three net to the invoice total and
 * receivables carry exactly what the customer owes.
 */
export function buildJournal(src: JournalSources): JournalEntry[] {
    const entries: JournalEntry[] = [];

    for (const l of src.jobLabour) {
        const amt = round2(n(l.hours) * n(l.hourly_rate_lkr));
        if (amt === 0) continue;
        entries.push({
            id: `j-lab-${l.id}`, date: l.created_at,
            narrative: `Labour — ${l.description || 'service'}`,
            lines: [dr(ACCOUNTS.RECEIVABLES, amt), cr(ACCOUNTS.REV_LABOUR, amt)],
        });
    }

    for (const p of src.jobParts) {
        const qty = n(p.quantity);
        const sale = round2(qty * n(p.price_at_time_lkr));
        const name = p.partName || p.custom_name || 'part';
        if (sale !== 0) {
            entries.push({
                id: `j-psale-${p.id}`, date: p.created_at,
                narrative: `Parts sold — ${name}`,
                lines: [dr(ACCOUNTS.RECEIVABLES, sale), cr(ACCOUNTS.REV_PARTS, sale)],
            });
        }
        const cost = round2(qty * n(p.cost_at_time_lkr));
        if (cost !== 0) {
            entries.push({
                id: `j-pcost-${p.id}`, date: p.created_at,
                narrative: `Parts consumed — ${name}`,
                lines: [dr(ACCOUNTS.COGS, cost), cr(ACCOUNTS.STOCK, cost)],
            });
        }
    }

    for (const inv of src.invoicesFull) {
        const discount = round2(n(inv.discount_lkr));
        if (discount > 0) {
            entries.push({
                id: `j-disc-${inv.id}`, date: inv.created_at,
                narrative: 'Discount allowed',
                lines: [dr(ACCOUNTS.DISCOUNTS, discount), cr(ACCOUNTS.RECEIVABLES, discount)],
            });
        }
        // Settlement is its own entry on its own date — that separation is what
        // makes the books accrual rather than cash.
        if (inv.status === 'Paid') {
            const amt = round2(n(inv.total_amount_lkr));
            if (amt !== 0) {
                entries.push({
                    id: `j-rcpt-${inv.id}`,
                    date: inv.paid_on || inv.created_at,
                    narrative: 'Invoice settled',
                    lines: [dr(ACCOUNTS.BANK, amt), cr(ACCOUNTS.RECEIVABLES, amt)],
                });
            }
        }
    }

    for (const m of src.manualFull) {
        const amt = round2(Math.abs(n(m.amount_lkr)));
        if (amt === 0) continue;
        const label = m.description || m.category || 'entry';
        if (m.is_income) {
            entries.push({
                id: `j-oi-${m.id}`, date: m.date, narrative: `Other income — ${label}`,
                lines: [dr(ACCOUNTS.BANK, amt), cr(ACCOUNTS.REV_OTHER, amt)],
            });
            continue;
        }
        const buysStock = (m.category || '') === STOCK_PURCHASE_CATEGORY;
        const debitAccount = buysStock ? ACCOUNTS.STOCK : opexAccount(m.category || 'Other');
        const settled = m.paid !== false;
        entries.push({
            id: `j-exp-${m.id}`, date: m.date,
            narrative: buysStock ? `Parts purchased into stock — ${label}` : `Expense — ${label}`,
            lines: [dr(debitAccount, amt), settled ? cr(ACCOUNTS.BANK, amt) : cr(ACCOUNTS.PAYABLES, amt)],
        });
        // A bill entered unpaid and settled later needs the second entry too.
        if (!settled && m.paid_on) {
            entries.push({
                id: `j-billpay-${m.id}`, date: m.paid_on, narrative: `Paid supplier — ${label}`,
                lines: [dr(ACCOUNTS.PAYABLES, amt), cr(ACCOUNTS.BANK, amt)],
            });
        }
    }

    for (const a of src.assets) {
        const cost = round2(n(a.cost_lkr));
        if (cost === 0) continue;
        entries.push({
            id: `j-asset-${a.id}`, date: a.purchase_date, narrative: `Asset purchased — ${a.name}`,
            lines: [dr(ACCOUNTS.FIXED_ASSETS, cost), cr(ACCOUNTS.BANK, cost)],
        });
    }

    for (const d of src.depreciationByAsset) {
        if (d.charge === 0) continue;
        entries.push({
            id: `j-dep-${d.assetId}`, date: src.periodEndISO, narrative: 'Depreciation for the period',
            lines: [dr(ACCOUNTS.DEPRECIATION, d.charge), cr(ACCOUNTS.ACC_DEP, d.charge)],
        });
    }

    return entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export interface TrialBalanceRow {
    account: Account;
    debit: number;
    credit: number;
}

export interface TrialBalance {
    rows: TrialBalanceRow[];
    totalDebits: number;
    totalCredits: number;
    /** Zero when the books are internally consistent. */
    outOfBalance: number;
    balanced: boolean;
}

/**
 * Aggregates the journal into account balances up to `asOf`. Income and expense
 * accounts are restricted to the period; balance-sheet accounts accumulate from
 * the beginning, because a balance is a position rather than a flow.
 */
export function trialBalance(
    journal: JournalEntry[],
    periodStart: Date,
    periodEnd: Date,
    opening: { account: Account; amount: number }[] = [],
): TrialBalance {
    const totals = new Map<string, { account: Account; net: number }>();
    const add = (account: Account, amount: number) => {
        const key = `${account.code}:${account.name}`;
        const cur = totals.get(key) || { account, net: 0 };
        cur.net = round2(cur.net + amount);
        totals.set(key, cur);
    };

    for (const o of opening) add(o.account, o.amount);

    for (const entry of journal) {
        const d = new Date(entry.date);
        if (d > periodEnd) continue;
        for (const line of entry.lines) {
            const isFlow = line.account.type === 'income' || line.account.type === 'expense';
            if (isFlow && d < periodStart) continue;
            add(line.account, line.amount);
        }
    }

    const rows: TrialBalanceRow[] = [...totals.values()]
        .filter(t => Math.abs(t.net) >= 0.005)
        .map(t => ({
            account: t.account,
            debit: t.net > 0 ? round2(t.net) : 0,
            credit: t.net < 0 ? round2(-t.net) : 0,
        }))
        .sort((a, b) => a.account.code.localeCompare(b.account.code) || a.account.name.localeCompare(b.account.name));

    const totalDebits = round2(rows.reduce((t, r) => t + r.debit, 0));
    const totalCredits = round2(rows.reduce((t, r) => t + r.credit, 0));
    const outOfBalance = round2(totalDebits - totalCredits);

    return { rows, totalDebits, totalCredits, outOfBalance, balanced: Math.abs(outOfBalance) < 1 };
}

/* ------------------------------------------------- stock and cash movement */

/**
 * Works out what stock must have been on the shelf at the start of the period.
 *
 * Consuming a part credits Stock. If the workshop never recorded buying the
 * parts — no opening figure, nothing filed under "Parts purchases" — the account
 * only ever receives credits and the balance sheet reports negative inventory,
 * which cannot exist. The parts list knows the real closing valuation, so the
 * opening figure is the one that reconciles it:
 *
 *     opening = physical closing − net movement during the period
 *
 * Derived, not invented: it is the only value consistent with a stock count the
 * system already maintains. The statements label it as derived and ask for the
 * real figure, because a wrong opening balance misstates opening equity.
 */
export function deriveOpeningStock(
    physicalClosingStock: number,
    journal: JournalEntry[],
    start: Date,
    end: Date,
): number {
    return Math.max(0, round2(physicalClosingStock - movementOn(journal, ACCOUNTS.STOCK.code, start, end)));
}

/**
 * Brings the Stock account onto the physical count.
 *
 * A workshop restocks the shelf in the Inventory tab without recording it as a
 * purchase, so Stock receives credits as parts are fitted and no debits at all.
 * The account then runs negative — inventory that cannot exist — and the
 * opening figure the owner types in is far too small to absorb a year of
 * consumption.
 *
 * The parts list knows the real valuation, so the difference is posted to a
 * named liability rather than being hidden or clamped: the parts were bought
 * and paid for somehow, and until that is recorded the books owe an
 * explanation. It is a liability and not an expense because the stock is still
 * on the shelf — treating it as a cost would understate profit.
 *
 * Returns null when the books already agree with the count.
 */
export function reconcileStock(
    physicalStock: number,
    journal: JournalEntry[],
    openingStock: number,
    periodEnd: Date,
    periodEndISO: string,
): JournalEntry | null {
    const movement = movementOn(journal, ACCOUNTS.STOCK.code, new Date(0), periodEnd);
    const perBooks = round2(openingStock + movement);
    const difference = round2(physicalStock - perBooks);
    if (Math.abs(difference) < 1) return null;

    return {
        id: 'j-stockrecon',
        date: periodEndISO,
        narrative: difference > 0
            ? 'Stock on hand exceeds the recorded purchases — parts bought but not entered'
            : 'Stock on hand is below the books — parts recorded but not on the shelf',
        lines: difference > 0
            ? [dr(ACCOUNTS.STOCK, difference), cr(ACCOUNTS.UNRECORDED_PURCHASES, difference)]
            : [dr(ACCOUNTS.UNRECORDED_PURCHASES, -difference), cr(ACCOUNTS.STOCK, -difference)],
    };
}

export interface CashFlow {
    opening: number;
    receiptsFromCustomers: number;
    otherReceipts: number;
    paymentsForExpenses: number;
    paymentsToSuppliers: number;
    assetPurchases: number;
    netMovement: number;
    closing: number;
    /** True when no opening bank or cash figure was supplied. */
    openingAssumed: boolean;
}

/**
 * Direct-method cash flow, built from the actual bank and cash postings rather
 * than reconstructed from profit. Every line traces to a transaction, which is
 * what makes it checkable — and easier to follow than the indirect method for
 * someone learning to read their own accounts.
 */
export function cashFlow(
    journal: JournalEntry[],
    start: Date, end: Date,
    openingBank = 0, openingCash = 0,
    openingAssumed = false,
): CashFlow {
    const opening = round2(openingBank + openingCash);
    const bucket = { rcpt: 0, oi: 0, exp: 0, billpay: 0, asset: 0 };

    for (const e of journal) {
        const d = new Date(e.date);
        if (d < start || d > end) continue;
        const cashMoved = e.lines
            .filter(l => l.account.code === ACCOUNTS.BANK.code || l.account.code === ACCOUNTS.CASH.code)
            .reduce((t, l) => t + l.amount, 0);
        if (cashMoved === 0) continue;

        if (e.id.startsWith('j-rcpt-')) bucket.rcpt += cashMoved;
        else if (e.id.startsWith('j-oi-')) bucket.oi += cashMoved;
        else if (e.id.startsWith('j-billpay-')) bucket.billpay += cashMoved;
        else if (e.id.startsWith('j-asset-')) bucket.asset += cashMoved;
        else bucket.exp += cashMoved;
    }

    const netMovement = round2(bucket.rcpt + bucket.oi + bucket.exp + bucket.billpay + bucket.asset);
    return {
        opening,
        receiptsFromCustomers: round2(bucket.rcpt),
        otherReceipts: round2(bucket.oi),
        paymentsForExpenses: round2(-bucket.exp),
        paymentsToSuppliers: round2(-bucket.billpay),
        assetPurchases: round2(-bucket.asset),
        netMovement,
        closing: round2(opening + netMovement),
        openingAssumed,
    };
}
