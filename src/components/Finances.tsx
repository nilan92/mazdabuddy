import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
    DollarSign, TrendingUp, TrendingDown, Search, Plus, Trash2, FileText, Download,
    Wallet, Package, Wrench, Building2, Scale, AlertTriangle, Check, Layers,
    MessageCircle, Smartphone, Banknote, HandCoins, ArrowRight, ChevronRight, Truck,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Modal } from './Modal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { downloadCSV } from '../lib/csv';
import { fyStart, fyEnd, fyLabel, toISODate, describePeriod, FY_START_MONTH } from '../lib/fiscal';
import {
    buildLedger, profitAndLoss, depreciate, balanceSheet, round2, ageItems, AGE_BUCKETS,
    buildJournal, trialBalance, ACCOUNTS, deriveOpeningStock, cashFlow, reconcileStock, STOCK_PURCHASE_CATEGORY,
    type LedgerEntry, type Asset, type AgedItem, type ProfitAndLoss,
} from '../lib/finance';
import { waMeUrl } from '../lib/whatsapp';
import { sendSMS } from '../lib/sms';
import { withTitle } from '../lib/textCase';
import { buildAuditPack, STATEMENTS, STATEMENT_COLOURS, type StatementKey } from '../lib/financePdf';

/* Built-in categories. Tenants add their own alongside these, stored in
   finance_categories; the two lists are merged wherever a picker appears. */
const BUILTIN = {
    expense: ['Rent', 'Utilities', 'Salaries & wages', 'Parts purchases', 'Tools & equipment',
        'Vehicle & fuel', 'Insurance', 'Marketing', 'Professional fees', 'Bank charges',
        'Repairs & maintenance', 'Other'],
    income: ['Scrap sales', 'Waste oil', 'Storage fees', 'Towing', 'Commission', 'Other'],
    asset: ['Equipment', 'Tools', 'Vehicles', 'Furniture & fittings', 'Computers & IT',
        'Building & premises', 'Other'],
};

/* Opening balances — the position at the START of the financial year.
   They must be opening rather than closing figures: the journal already posts
   every receipt and payment, so feeding in a closing balance and then adding
   the year's movements on top would count the same money twice. The closing
   position is computed from these plus the transactions. */
const POSITION_FIELDS = [
    { key: 'bank', label: 'Bank — opening balance', hint: 'What was in the bank on the first day of this financial year' },
    { key: 'cash', label: 'Cash in hand — opening', hint: 'Physical cash held on the first day of the year' },
    { key: 'stock_opening', label: 'Stock — opening value', hint: 'Value of parts on the shelf at the start of the year, at cost' },
    { key: 'loans', label: 'Loans — opening balance', hint: 'Outstanding on the first day of the year' },
    { key: 'share_capital', label: 'Stated capital', hint: 'Capital introduced by the shareholders' },
    { key: 'retained_earnings_bf', label: 'Retained earnings b/f', hint: 'Accumulated profit at the start of this year' },
];

const lkr = (v: number) => `LKR ${Math.round(v).toLocaleString()}`;
const short = (v: number) =>
    Math.abs(v) >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
    : Math.abs(v) >= 1_000 ? `${Math.round(v / 1_000)}k` : String(Math.round(v));

type PeriodKind = 'month' | 'fy' | 'all' | 'custom';
type Tab = 'all' | 'income' | 'expenses' | 'owed' | 'suppliers' | 'assets';

/*
 * Charts live at module scope, not inside Finances.
 *
 * Declared inside the component they were a new function on every render, so
 * React saw a different component type each time and tore the whole subtree
 * down and rebuilt it — on every keystroke in the search box. Unstable
 * component identity also makes reconciliation errors far harder to read,
 * which matters for a page that has already thrown one in production.
 */
const IncomeMix = ({ pl }: { pl: ProfitAndLoss }) => {
    const total = pl.revenueLabour + pl.revenueParts + pl.revenueOther;
    if (total <= 0) return <p className="text-slate-600 text-sm italic py-6 text-center">No income in this period.</p>;
    const segs = [
        { label: 'Labour', value: pl.revenueLabour, color: '#06b6d4' },
        { label: 'Parts', value: pl.revenueParts, color: '#8b5cf6' },
        { label: 'Other', value: pl.revenueOther, color: '#f59e0b' },
    ].filter(s => s.value > 0);
    let x = 0;
    return (
        <div>
            <svg viewBox="0 0 100 10" className="w-full h-6 rounded overflow-hidden" preserveAspectRatio="none">
                {segs.map(s => {
                    const w = (s.value / total) * 100;
                    const el = <rect key={s.label} x={x} y={0} width={w} height={10} fill={s.color} />;
                    x += w;
                    return el;
                })}
            </svg>
            <div className="mt-4 space-y-2">
                {segs.map(s => (
                    <div key={s.label} className="flex items-center gap-2 text-sm">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
                        <span className="text-slate-300 flex-1 min-w-0 truncate">{s.label}</span>
                        <span className="text-slate-500 text-xs shrink-0">{((s.value / total) * 100).toFixed(0)}%</span>
                        <span className="font-mono text-white text-xs sm:text-sm shrink-0 tabular-nums">{lkr(s.value)}</span>
                    </div>
                ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
                Labour is time you sold; parts is goods you resold. Labour usually carries the
                better margin — parts cost you {pl.revenueParts > 0 ? `${((pl.costOfParts / pl.revenueParts) * 100).toFixed(0)}%` : '—'} of
                what you charged for them.
            </p>
        </div>
    );
};

const TrendChart = ({ monthly }: { monthly: { label: string; income: number; expense: number }[] }) => {
    if (monthly.length === 0) return <p className="text-slate-600 text-sm italic py-6 text-center">Nothing to chart yet.</p>;
    const max = Math.max(...monthly.flatMap(m => [m.income, m.expense]), 1);
    const bw = 100 / monthly.length;
    return (
        <div>
            <svg viewBox="0 0 100 46" className="w-full h-36" preserveAspectRatio="none">
                <line x1="0" y1="40" x2="100" y2="40" stroke="#334155" strokeWidth="0.3" />
                {monthly.map((m, i) => {
                    const ih = (m.income / max) * 36, eh = (m.expense / max) * 36;
                    const cx = i * bw;
                    return (
                        <g key={i}>
                            <rect x={cx + bw * 0.18} y={40 - ih} width={bw * 0.28} height={ih} fill="#10b981" />
                            <rect x={cx + bw * 0.52} y={40 - eh} width={bw * 0.28} height={eh} fill="#f43f5e" />
                        </g>
                    );
                })}
            </svg>
            <div className="flex justify-between text-[9px] sm:text-[10px] text-slate-500 mt-1">
                {/* Past eight months the labels collide on a phone, so show
                    every other one — the bars still carry the shape. */}
                {monthly.map((m, i) => (
                    <span key={i} className={monthly.length > 8 && i % 2 === 1 ? 'hidden sm:inline' : ''}>
                        {m.label}
                    </span>
                ))}
            </div>
            <div className="flex gap-4 mt-3 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> <span className="text-slate-400">Income</span></span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-rose-500" /> <span className="text-slate-400">Expenses</span></span>
                <span className="ml-auto text-slate-500">peak {short(max)}</span>
            </div>
        </div>
    );
};

const ExpenseBars = ({ pl }: { pl: ProfitAndLoss }) => {
    const cats = Object.entries(pl.expensesByCategory).sort((a, b) => b[1] - a[1]).slice(0, 7);
    if (cats.length === 0) return <p className="text-slate-600 text-sm italic py-6 text-center">No operating expenses recorded.</p>;
    const max = Math.max(...cats.map(c => c[1]));
    return (
        <div className="space-y-2.5">
            {cats.map(([cat, amt]) => (
                <div key={cat}>
                    <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-300">{cat}</span>
                        <span className="font-mono text-slate-400">{lkr(amt)}</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-rose-500/70 rounded-full" style={{ width: `${(amt / max) * 100}%` }} />
                    </div>
                </div>
            ))}
        </div>
    );
};

export const Finances = () => {
    const { profile } = useAuth();
    const { toast } = useToast();
    const confirm = useConfirm();
    const queryClient = useQueryClient();

    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<Tab>('all');
    const [periodKind, setPeriodKind] = useState<PeriodKind>('fy');
    const [customRange, setCustomRange] = useState({
        start: toISODate(fyStart()), end: toISODate(fyEnd()),
    });
    // Which month / financial year is being looked at. Default to the current
    // one, so the tab opens on "now" as it always did.
    const [monthAnchor, setMonthAnchor] = useState(() => new Date());
    const [fyAnchorYear, setFyAnchorYear] = useState(() => fyStart().getFullYear());
    const [search, setSearch] = useState('');
    const [catFilter, setCatFilter] = useState('all');

    const [raw, setRaw] = useState<{
        invoices: any[]; labour: any[]; parts: any[]; manual: any[];
        assets: Asset[]; categories: any[]; positions: any[]; stock: number; debtors: any[];
        suppliersList: string[];
    }>({ invoices: [], labour: [], parts: [], manual: [], assets: [], categories: [], positions: [], stock: 0, debtors: [], suppliersList: [] });

    const [tenant, setTenant] = useState<any>(null);
    const [entryModal, setEntryModal] = useState<null | 'income' | 'expense'>(null);
    const [assetModal, setAssetModal] = useState(false);
    const [positionsModal, setPositionsModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [generating, setGenerating] = useState(false);

    const [entryForm, setEntryForm] = useState({
        amount: '', description: '', category: '', date: toISODate(new Date()),
        paid: true, supplier: '', due_date: '',
    });
    const [assetForm, setAssetForm] = useState({
        name: '', category: 'Equipment', purchase_date: toISODate(new Date()),
        cost_lkr: '', useful_life_years: '5', residual_lkr: '0', notes: '',
    });
    const [newCategory, setNewCategory] = useState('');
    const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());
    const [statementModal, setStatementModal] = useState(false);
    const [chosen, setChosen] = useState<Set<StatementKey>>(new Set(STATEMENTS.map(s => s.key)));
    const [positionsForm, setPositionsForm] = useState<Record<string, string>>({});

    /* ---------------------------------------------------------------- period */
    const period = useMemo(() => {
        if (periodKind === 'month') {
            const y = monthAnchor.getFullYear(), m = monthAnchor.getMonth();
            return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0, 23, 59, 59) };
        }
        if (periodKind === 'fy') {
            const anchor = new Date(fyAnchorYear, FY_START_MONTH, 1);
            return { start: fyStart(anchor), end: new Date(fyEnd(anchor).setHours(23, 59, 59, 999)) };
        }
        // Ends today, not in the year 2999. An open-ended end date put "as at
        // 31 Dec 2999" on the statements and let depreciation run for a
        // millennium, writing every asset down to nothing.
        if (periodKind === 'all') return { start: new Date(2000, 0, 1), end: new Date() };
        return { start: new Date(`${customRange.start}T00:00:00`), end: new Date(`${customRange.end}T23:59:59`) };
    }, [periodKind, customRange, monthAnchor, fyAnchorYear]);

    const periodLabel = periodKind === 'all'
        ? 'All time'
        : describePeriod(toISODate(period.start), toISODate(period.end));

    /* Opening balances are stored per financial year. "All time" starts in 2000,
       so fyStart() resolved it to FY 1999/00 — a year with no figures — and the
       balance sheet lost every entered value. The anchor is the year the period
       ends in, which for "All time" is the current one. */
    /* Must be a stable reference. `new Date()` here produced a fresh object on
       every render, which rebuilt fetchAll, which refired its effect, which set
       state and rendered again — All time span the loading spinner forever.
       period.end comes from the memo above, so it only changes when the period
       does, and for All time it is already "now". */
    const fyAnchor = periodKind === 'all' ? period.end : period.start;

    /* ------------------------------------------------------------------ data */
    const fetchAll = useCallback(async () => {
        if (!profile?.tenant_id) return;
        setLoading(true);
        try {
            const [inv, lab, prt, man, ast, cat, pos, stk, ten, sup] = await Promise.all([
                supabase.from('invoices').select('id, total_amount_lkr, discount_lkr, created_at, status, job_id, job_cards(vehicles(license_plate, customers(title, name, phone)))'),
                supabase.from('job_labor').select('id, created_at, description, hours, hourly_rate_lkr, is_fixed, mechanic_name, job_cards!inner(id, status)').eq('job_cards.status', 'completed'),
                supabase.from('job_parts').select('id, created_at, quantity, price_at_time_lkr, cost_at_time_lkr, is_custom, custom_name, parts(name, cost_lkr), job_cards!inner(id, status)').eq('job_cards.status', 'completed'),
                supabase.from('user_expenses').select('*, profiles!user_id(full_name)').order('date', { ascending: false }),
                supabase.from('assets').select('*').order('purchase_date', { ascending: false }),
                supabase.from('finance_categories').select('*'),
                supabase.from('finance_positions').select('*').eq('fy_start', toISODate(fyStart(fyAnchor))),
                supabase.from('parts').select('stock_quantity, cost_lkr'),
                supabase.from('tenants').select('name, address, phone').eq('id', profile.tenant_id).single(),
                supabase.from('suppliers').select('name').order('name'),
            ]);

            const firstError = [inv, lab, prt, man, ast, cat, pos, stk].find(r => r.error)?.error;
            if (firstError) throw firstError;

            const unpaid = (inv.data || []).filter((i: any) => i.status === 'Unpaid');
            setTenant(ten.data);
            setRaw({
                invoices: inv.data || [],
                labour: lab.data || [],
                parts: prt.data || [],
                manual: man.data || [],
                assets: (ast.data || []) as Asset[],
                categories: cat.data || [],
                positions: pos.data || [],
                stock: round2((stk.data || []).reduce((t: number, p: any) =>
                    t + (Number(p.stock_quantity) || 0) * (Number(p.cost_lkr) || 0), 0)),
                debtors: unpaid,
                suppliersList: (sup.data || []).map((s: any) => s.name).filter(Boolean),
            });
        } catch (e: any) {
            console.error('[Finances]', e);
            toast('Could not load finances: ' + e.message, 'error');
        } finally {
            setLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile?.tenant_id, period.start, fyAnchor, toast]);

    useEffect(() => { 
        fetchAll(); 
        const handleAppRefresh = () => { fetchAll(); };
        window.addEventListener('app:refresh', handleAppRefresh);
        return () => window.removeEventListener('app:refresh', handleAppRefresh);
    }, [fetchAll]);

    /* --------------------------------------------------------------- derived */
    const ledger = useMemo(() => buildLedger({
        invoices: raw.invoices,
        jobLabour: raw.labour.map((l: any) => ({ ...l, jobRef: l.job_cards?.id?.slice(0, 8).toUpperCase() })),
        // cost_at_time_lkr is written by the add-part RPC; older rows predate it,
        // so fall back to the catalogue cost rather than treating them as free.
        jobParts: raw.parts.map((p: any) => ({
            ...p,
            cost_at_time_lkr: p.cost_at_time_lkr ?? p.parts?.cost_lkr ?? 0,
            partName: p.parts?.name || p.custom_name,
            jobRef: p.job_cards?.id?.slice(0, 8).toUpperCase(),
        })),
        manual: raw.manual.map((m: any) => ({ ...m, loggedBy: m.profiles?.full_name })),
    }), [raw]);

    const schedules = useMemo(
        () => raw.assets.map(a => depreciate(a, period.start, period.end)),
        [raw.assets, period]);
    const depreciationForPeriod = round2(schedules.reduce((t, s) => t + s.chargeForPeriod, 0));

    const pl = useMemo(
        () => profitAndLoss(ledger, raw.invoices, period.start, period.end, depreciationForPeriod),
        [ledger, raw.invoices, period, depreciationForPeriod]);

    /* Trade receivables come straight off the invoices — unpaid means owed.
       Nothing to key in, and it cannot drift from what the Invoices tab shows. */
    const receivables = useMemo(() => ageItems(
        raw.debtors
            // A zero-value unpaid invoice is not money owed; it would only pad
            // the chase list and the balance sheet with nothing.
            .filter((d: any) => (Number(d.total_amount_lkr) || 0) > 0)
            .map((d: any) => {
            const c = d.job_cards?.vehicles?.customers;
            return {
                id: d.id,
                reference: `INV-${String(d.id).slice(0, 8).toUpperCase()}`,
                counterparty: withTitle(c?.title, c?.name) || 'Unknown customer',
                date: d.created_at,
                amount: Number(d.total_amount_lkr) || 0,
                phone: c?.phone ?? null,
            };
        })), [raw.debtors]);

    /* Trade payables are simply the expenses not yet settled — no separate
       supplier ledger to keep, and the balance sheet figure maintains itself. */
    const payables = useMemo(() => ageItems(
        raw.manual.filter((m: any) => !m.is_income && m.paid === false).map((m: any) => ({
            id: m.id,
            reference: m.supplier || m.category || 'Bill',
            counterparty: m.description || m.category || '—',
            date: m.due_date || m.date,
            amount: Number(m.amount_lkr) || 0,
        }))), [raw.manual]);

    const positionsMap = useMemo(() => {
        const m: Record<string, number> = {};
        for (const p of raw.positions) m[p.key] = Number(p.amount_lkr) || 0;
        return m;
    }, [raw.positions]);

    /* The books proper. Every transaction posted as equal debits and credits on
       the accrual basis, with settlement as a separate entry on its own date. */
    const journal = useMemo(() => buildJournal({
        invoices: raw.invoices,
        jobLabour: raw.labour.map((l: any) => ({ ...l, jobRef: l.job_cards?.id?.slice(0, 8).toUpperCase() })),
        jobParts: raw.parts.map((p: any) => ({
            ...p,
            cost_at_time_lkr: p.cost_at_time_lkr ?? p.parts?.cost_lkr ?? 0,
            partName: p.parts?.name || p.custom_name,
        })),
        manual: raw.manual,
        invoicesFull: raw.invoices,
        manualFull: raw.manual,
        assets: raw.assets,
        depreciationByAsset: schedules.map(s => ({ assetId: s.asset.id, charge: s.chargeForPeriod })),
        periodEndISO: toISODate(period.end),
    }), [raw, schedules, period.end]);

    /* Consuming a part credits Stock. With no opening figure and no recorded
       purchases the account only receives credits and the balance sheet reports
       negative inventory, which cannot exist. The parts list knows the real
       closing valuation, so the opening figure is derived from it. */
    const stockOpeningEntered = raw.positions.some(p => p.key === 'stock_opening');
    const openingStock = stockOpeningEntered
        ? (positionsMap.stock_opening || 0)
        : deriveOpeningStock(raw.stock, journal, period.start, period.end);

    /* The shelf is the authority on stock. Without this the account only ever
       receives credits — parts are fitted but never recorded as bought — and the
       balance sheet reports inventory that cannot exist. */
    const stockRecon = useMemo(
        () => reconcileStock(raw.stock, journal, openingStock, period.end, toISODate(period.end)),
        [raw.stock, journal, openingStock, period.end]);

    const postedJournal = useMemo(
        () => (stockRecon ? [...journal, stockRecon] : journal),
        [journal, stockRecon]);

    const trial = useMemo(() => trialBalance(postedJournal, period.start, period.end, [
        { account: ACCOUNTS.BANK, amount: positionsMap.bank || 0 },
        { account: ACCOUNTS.CASH, amount: positionsMap.cash || 0 },
        { account: ACCOUNTS.STOCK, amount: openingStock },
        { account: ACCOUNTS.LOANS, amount: -(positionsMap.loans || 0) },
        { account: ACCOUNTS.CAPITAL, amount: -(positionsMap.share_capital || 0) },
        // Opening stock the tenant did not supply is derived, and its contra has
        // to go somewhere or the books open out of balance by that amount.
        // Stock held at the start was funded by past profits, so it belongs in
        // opening reserves — the same place a bookkeeper would put it.
        { account: ACCOUNTS.RETAINED,
          amount: -((positionsMap.retained_earnings_bf || 0) + (stockOpeningEntered ? 0 : openingStock)) },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ]), [postedJournal, period, positionsMap, openingStock]);

    const cash = useMemo(() => cashFlow(
        postedJournal, period.start, period.end,
        positionsMap.bank || 0, positionsMap.cash || 0,
        !raw.positions.some(p => ['bank', 'cash'].includes(p.key)),
    ), [postedJournal, period, positionsMap, raw.positions]);

    /* Closing bank and cash are computed — opening balance plus every receipt
       and payment the journal posted — rather than typed in. */
    const accountBalance = (code: string) => {
        const row = trial.rows.find(r => r.account.code === code);
        return row ? round2(row.debit - row.credit) : 0;
    };

    /* Every figure comes off the trial balance, so the statement articulates with
       the books by construction. Reading stock from the parts table and debtors
       from the invoice list instead would let a balanced set of books still
       produce an unbalanced balance sheet, which is the confusing outcome. */
    const balance = useMemo(() => balanceSheet({
        fixedAssetsNbv: round2(accountBalance('1000') + accountBalance('1010')),
        stock: accountBalance('1100'),
        debtors: accountBalance('1200'),
        bank: accountBalance('1300'),
        cash: accountBalance('1310'),
        payables: -accountBalance('2000'),
        loans: -accountBalance('2100'),
        shareCapital: -accountBalance('3000'),
        retainedEarningsBf: -accountBalance('3100'),
        profitForYear: pl.netProfit,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [trial, pl.netProfit]);

    /* The books say one thing about stock; the shelf says another. A gap is worth
       knowing about — it is shrinkage, mis-costed parts or unrecorded purchases —
       but it belongs here as a note, not as a broken balance sheet. */
    const stockVariance = round2(raw.stock - balance.stock);

    /* Suppliers are not a separate thing to maintain — they are whoever has
       been named on a bill. Every expense carrying a supplier contributes, so
       the list builds itself as bills are recorded and always reflects who is
       actually being bought from. */
    const suppliers = useMemo(() => {
        const byName = new Map<string, {
            name: string; billCount: number; total: number; outstanding: number;
            lastDate: string; categories: Set<string>;
        }>();
        for (const m of raw.manual as any[]) {
            const name = (m.supplier || '').trim();
            if (!name || m.is_income) continue;
            const amount = Number(m.amount_lkr) || 0;
            const cur = byName.get(name.toLowerCase()) ?? {
                name, billCount: 0, total: 0, outstanding: 0, lastDate: m.date, categories: new Set<string>(),
            };
            cur.billCount += 1;
            cur.total = round2(cur.total + amount);
            if (m.paid === false) cur.outstanding = round2(cur.outstanding + amount);
            if (new Date(m.date) > new Date(cur.lastDate)) cur.lastDate = m.date;
            if (m.category) cur.categories.add(m.category);
            byName.set(name.toLowerCase(), cur);
        }
        return [...byName.values()].sort((a, b) => b.outstanding - a.outstanding || b.total - a.total);
    }, [raw.manual]);

    const cashEntered = raw.positions.some(p => ['bank', 'cash'].includes(p.key));
    const availableCash = round2(balance.bank + balance.cash);

    const inPeriod = useMemo(
        () => ledger.filter(e => { const d = new Date(e.date); return d >= period.start && d <= period.end; }),
        [ledger, period]);

    const categoriesFor = (kind: 'expense' | 'income' | 'asset') => [
        ...BUILTIN[kind],
        ...raw.categories.filter((c: any) => c.kind === kind).map((c: any) => c.name),
    ].filter((v, i, a) => a.indexOf(v) === i);

    /* Tab contents. Search and the category filter apply to all of them —
       previously both controls were rendered but wired to nothing. */
    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        let rows = inPeriod;
        if (tab === 'income') rows = rows.filter(e => e.kind === 'income');
        if (tab === 'expenses') rows = rows.filter(e => e.kind === 'expense');
        if (catFilter !== 'all') rows = rows.filter(e => e.category === catFilter);
        if (q) rows = rows.filter(e =>
            e.description.toLowerCase().includes(q) ||
            e.category.toLowerCase().includes(q) ||
            (e.jobRef || '').toLowerCase().includes(q) ||
            (e.loggedBy || '').toLowerCase().includes(q));
        return rows;
    }, [inPeriod, tab, catFilter, search]);

    /** Rows grouped under their category, biggest group first. */
    const grouped = useMemo(() => {
        const g = new Map<string, { total: number; rows: LedgerEntry[] }>();
        for (const e of visible) {
            const cur = g.get(e.category) || { total: 0, rows: [] };
            cur.total = round2(cur.total + e.amount);
            cur.rows.push(e);
            g.set(e.category, cur);
        }
        return [...g.entries()].sort((a, b) => b[1].total - a[1].total);
    }, [visible]);

    const visibleCategories = useMemo(
        () => [...new Set(inPeriod
            .filter(e => tab === 'all' || (tab === 'income' ? e.kind === 'income' : tab === 'expenses' ? e.kind === 'expense' : true))
            .map(e => e.category))].sort(),
        [inPeriod, tab]);

    /* Monthly revenue vs expenses, for the trend chart. */
    const monthly = useMemo(() => {
        const buckets = new Map<string, { label: string; income: number; expense: number }>();
        for (const e of inPeriod) {
            // Purchases of parts into stock are an asset purchase, not an operating expense;
            // parts consumption on jobs (parts_cost) is already counted as the cost of sales.
            if (e.category === STOCK_PURCHASE_CATEGORY) continue;
            const d = new Date(e.date);
            const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
            const b = buckets.get(key) || {
                label: d.toLocaleDateString('en-GB', { month: 'short' }), income: 0, expense: 0,
            };
            if (e.kind === 'income') b.income += e.amount; else b.expense += e.amount;
            buckets.set(key, b);
        }
        return [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v).slice(-12);
    }, [inPeriod]);

    /* --------------------------------------------------------------- actions */
    const addCategory = async (kind: 'expense' | 'income' | 'asset', name: string) => {
        const clean = name.trim();
        if (!clean) return;
        if (categoriesFor(kind).some(c => c.toLowerCase() === clean.toLowerCase())) {
            toast('That category already exists.', 'warning'); return;
        }
        const { error } = await supabase.from('finance_categories')
            .insert({ tenant_id: profile?.tenant_id, name: clean, kind });
        if (error) return toast(error.message, 'error');
        setNewCategory('');
        await fetchAll();
        toast(`Category "${clean}" added.`, 'success');
    };

    const saveEntry = async (e: React.FormEvent) => {
        e.preventDefault();
        const amount = parseFloat(entryForm.amount);
        if (!(amount > 0)) return toast('Enter an amount greater than zero.', 'warning');
        if (!entryForm.category) return toast('Pick a category.', 'warning');
        setSubmitting(true);
        const unpaidBill = entryModal === 'expense' && !entryForm.paid;
        const supName = entryForm.supplier ? entryForm.supplier.trim() : null;
        const { error } = await supabase.from('user_expenses').insert({
            user_id: profile?.id, tenant_id: profile?.tenant_id,
            amount_lkr: amount, description: entryForm.description || entryForm.category,
            category: entryForm.category, date: entryForm.date,
            is_income: entryModal === 'income',
            // Income is never a payable, so it is always recorded as settled.
            paid: entryModal === 'income' ? true : entryForm.paid,
            paid_on: entryModal === 'income' || entryForm.paid ? entryForm.date : null,
            supplier: supName,
            due_date: unpaidBill ? (entryForm.due_date || null) : null,
        });

        // Ensure supplier profile exists in suppliers table
        if (supName && profile?.tenant_id) {
            await supabase.from('suppliers').insert({
                tenant_id: profile.tenant_id,
                name: supName
            }).select('id').maybeSingle();
        }

        setSubmitting(false);
        if (error) return toast(error.message, 'error');
        setEntryModal(null);
        setEntryForm({ amount: '', description: '', category: '', date: toISODate(new Date()),
            paid: true, supplier: '', due_date: '' });
        fetchAll();
        queryClient.invalidateQueries({ queryKey: ['suppliers'] });
        queryClient.invalidateQueries({ queryKey: ['supplier_bills'] });
        toast(unpaidBill ? 'Bill recorded — it now shows under what you owe.'
            : entryModal === 'income' ? 'Income recorded.' : 'Expense recorded.', 'success');
    };

    const saveAsset = async (e: React.FormEvent) => {
        e.preventDefault();
        const cost = parseFloat(assetForm.cost_lkr);
        const life = parseFloat(assetForm.useful_life_years);
        if (!(cost > 0)) return toast('Enter the purchase cost.', 'warning');
        if (!(life > 0)) return toast('Useful life must be at least one year.', 'warning');
        setSubmitting(true);
        const { error } = await supabase.from('assets').insert({
            tenant_id: profile?.tenant_id, name: assetForm.name, category: assetForm.category,
            purchase_date: assetForm.purchase_date, cost_lkr: cost,
            useful_life_years: life, residual_lkr: parseFloat(assetForm.residual_lkr) || 0,
            notes: assetForm.notes || null,
        });
        setSubmitting(false);
        if (error) return toast(error.message, 'error');
        setAssetModal(false);
        setAssetForm({ name: '', category: 'Equipment', purchase_date: toISODate(new Date()),
            cost_lkr: '', useful_life_years: '5', residual_lkr: '0', notes: '' });
        fetchAll();
        toast('Asset added to the register.', 'success');
    };

    const savePositions = async () => {
        setSubmitting(true);
        const fy = toISODate(fyStart(fyAnchor));
        const rows = POSITION_FIELDS.map(f => ({
            tenant_id: profile?.tenant_id, fy_start: fy, key: f.key, label: f.label,
            amount_lkr: parseFloat(positionsForm[f.key] ?? '') || 0, updated_at: new Date().toISOString(),
        }));
        const { error } = await supabase.from('finance_positions')
            .upsert(rows, { onConflict: 'tenant_id,fy_start,key' });
        setSubmitting(false);
        if (error) return toast(error.message, 'error');
        setPositionsModal(false);
        fetchAll();
        toast('Balance sheet figures saved.', 'success');
    };

    const deleteEntry = async (entry: LedgerEntry) => {
        if (!entry.editable) {
            return toast('This line comes from a job card. Change it on the job itself.', 'info');
        }
        if (!await confirm({ message: 'Delete this entry?', confirmLabel: 'Delete' })) return;
        const { error } = await supabase.from('user_expenses').delete().eq('id', entry.id);
        if (error) return toast(error.message, 'error');
        fetchAll();
        toast('Entry deleted.', 'info');
    };

    const deleteAsset = async (a: Asset) => {
        if (!await confirm({
            title: 'Remove asset',
            message: `Remove "${a.name}" from the register? This changes the depreciation charge and the balance sheet.`,
            confirmLabel: 'Remove',
        })) return;
        const { error } = await supabase.from('assets').delete().eq('id', a.id);
        if (error) return toast(error.message, 'error');
        fetchAll();
        toast('Asset removed.', 'info');
    };

    /* Reminders. WhatsApp first — it opens a draft the user reviews and sends
       themselves, so nothing leaves without a human deciding. SMS is the
       fallback for a customer without WhatsApp, and it does send immediately,
       so it asks first. */
    const reminderText = (item: AgedItem) =>
        `Hello ${item.counterparty},\n\n`
        + `This is a friendly reminder from ${tenant?.name || 'our workshop'} about invoice `
        + `${item.reference} for LKR ${Math.round(item.amount).toLocaleString()}, `
        + `raised on ${new Date(item.date).toLocaleDateString('en-GB')}`
        + `${item.daysOld > 0 ? ` (${item.daysOld} days ago)` : ''}.\n\n`
        + `Please let us know if you have already settled it. Thank you.`;

    const remindWhatsApp = (item: AgedItem) => {
        window.open(waMeUrl(item.phone, reminderText(item)), '_blank', 'noopener');
    };

    const remindSMS = async (item: AgedItem) => {
        if (!item.phone) return toast('No phone number on this customer.', 'warning');
        if (!await confirm({
            title: 'Send SMS reminder',
            message: `Send a payment reminder to ${item.counterparty} at ${item.phone}? This sends straight away.`,
            confirmLabel: 'Send',
        })) return;
        try {
            await sendSMS(item.phone, reminderText(item), profile!.tenant_id!);
            toast('Reminder sent.', 'success');
        } catch (e: any) {
            toast('SMS failed: ' + e.message, 'error');
        }
    };

    const markBillPaid = async (item: AgedItem) => {
        const { error } = await supabase.from('user_expenses')
            .update({ paid: true, paid_on: toISODate(new Date()) }).eq('id', item.id);
        if (error) return toast(error.message, 'error');
        fetchAll();
        toast('Marked as paid.', 'success');
    };

    const positionsIncomplete = raw.positions.length === 0;

    // Takes the sections explicitly rather than reading `chosen` from the
    // closure: "Download all" sets the state and generates in the same tick, so
    // a closure would still hold the previous selection.
    const generateStatements = async (sections: StatementKey[]) => {
        if (sections.length === 0) return toast('Pick at least one statement.', 'warning');
        setStatementModal(false);
        setGenerating(true);
        try {
            const doc = buildAuditPack({
                sections,
                trial,
                journal,
                cash,
                company: { name: tenant?.name || 'Workshop', address: tenant?.address, phone: tenant?.phone },
                startISO: toISODate(period.start), endISO: toISODate(period.end),
                pl, schedules, balance,
                debtors: raw.debtors.map((d: any) => ({
                    invoiceNumber: `INV-${String(d.id).slice(0, 8).toUpperCase()}`,
                    customer: '—',
                    date: d.created_at,
                    amount: Number(d.total_amount_lkr) || 0,
                    daysOld: Math.max(0, Math.round((Date.now() - new Date(d.created_at).getTime()) / 86400000)),
                })),
                ledger: inPeriod,
                positionsIncomplete,
            });
            // No non-null assertion on the lookup: an unknown key would throw
            // inside the download handler and the user would see nothing happen.
            const only = sections.length === 1 ? STATEMENTS.find(x => x.key === sections[0]) : undefined;
            const name = sections.length === STATEMENTS.length ? 'Financial-Statements'
                : only ? only.title.replace(/[^a-z0-9]+/gi, '-')
                : 'Financial-Extracts';
            doc.save(`${name}-${toISODate(period.start)}-to-${toISODate(period.end)}.pdf`);
            toast('Statements downloaded.', 'success');
        } catch (err: any) {
            console.error('[Finances] statement generation failed', err);
            toast('Could not generate statements: ' + err.message, 'error');
        } finally {
            setGenerating(false);
        }
    };

    /* ----------------------------------------------------------------- chart */
    /* ---------------------------------------------------------------- render */
    const card = 'bg-slate-900/50 border border-slate-800 rounded-2xl';

    return (
        <div className="p-2 space-y-6 overflow-x-hidden">
            {loading && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-900/90 border border-cyan-500/20 px-4 py-2 rounded-full backdrop-blur shadow-xl">
                    <div className="animate-spin shrink-0 rounded-full h-4 w-4 border-2 border-cyan-500 border-t-transparent" />
                    <span className="text-cyan-400 text-xs font-bold uppercase tracking-widest">Loading finances…</span>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-1">Finance</h1>
                    <p className="text-slate-400 text-sm">{periodLabel}</p>
                </div>
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                    <button onClick={() => { setEntryModal('income'); setEntryForm(f => ({ ...f, category: '' })); }}
                        title="Income that did not come from a job"
                        className="flex items-center justify-center gap-2 bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-300 border border-emerald-600/30 px-3 py-2.5 rounded-xl font-bold text-sm transition-colors">
                        <Plus size={15} className="shrink-0" /> Other Income
                    </button>
                    <button onClick={() => { setEntryModal('expense'); setEntryForm(f => ({ ...f, category: '' })); }}
                        title="Money the workshop spent, paid or on credit"
                        className="flex items-center justify-center gap-2 bg-rose-600/15 hover:bg-rose-600/25 text-rose-300 border border-rose-600/30 px-3 py-2.5 rounded-xl font-bold text-sm transition-colors">
                        <Plus size={15} className="shrink-0" /> Expenses
                    </button>
                    <button onClick={() => {
                        setPositionsForm(Object.fromEntries(POSITION_FIELDS.map(f =>
                            [f.key, String(positionsMap[f.key] ?? '')])));
                        setPositionsModal(true);
                    }}
                        title="Bank, cash, loans and capital — the figures only you know"
                        className="flex items-center justify-center gap-2 bg-violet-600/15 hover:bg-violet-600/25 text-violet-300 border border-violet-600/30 px-3 py-2.5 rounded-xl font-bold text-sm transition-colors">
                        <Scale size={15} className="shrink-0" /> <span className="truncate">Balance Sheet</span>
                    </button>
                    <button onClick={() => setStatementModal(true)} disabled={generating}
                        className="flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 shadow-lg shadow-cyan-500/20">
                        <FileText size={15} className="shrink-0" /> {generating ? 'Preparing…' : 'Statements'}
                    </button>
                </div>
            </div>

            {/* Period selector */}
            <div className="flex items-center gap-2 overflow-x-auto overscroll-x-contain -mx-2 px-2 pb-1 sm:flex-wrap sm:overflow-visible sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {([['month', 'Month'], ['fy', fyLabel(new Date(fyAnchorYear, FY_START_MONTH, 1))],
                   ['all', 'All time'], ['custom', 'Custom']] as [PeriodKind, string][])
                    .map(([k, label]) => (
                        <button key={k} onClick={() => {
                                setPeriodKind(k);
                                // Tapping the chip always returns to now, so there is no
                                // way to be stuck looking at a month chosen minutes ago
                                // and wonder why the figures look wrong.
                                if (k === 'month') setMonthAnchor(new Date());
                                if (k === 'fy') setFyAnchorYear(fyStart().getFullYear());
                            }}
                            className={`px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                                periodKind === k ? 'bg-cyan-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}`}>
                            {label}
                        </button>
                    ))}
                {periodKind === 'custom' && (
                    <div className="flex items-center gap-2 shrink-0">
                        <input type="date" value={customRange.start} onChange={e => setCustomRange(r => ({ ...r, start: e.target.value }))}
                            className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white" />
                        <span className="text-slate-600 text-xs">to</span>
                        <input type="date" value={customRange.end} onChange={e => setCustomRange(r => ({ ...r, end: e.target.value }))}
                            className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white" />
                    </div>
                )}
            </div>

            {/* A second line appears under the chips so a particular month or
                financial year can be picked, rather than only ever showing the
                current one. */}
            {periodKind === 'month' && (
                <div className="flex items-center gap-2 overflow-x-auto overscroll-x-contain -mx-2 px-2 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <button
                        onClick={() => setMonthAnchor(d => new Date(d.getFullYear() - 1, d.getMonth(), 1))}
                        title="Previous year"
                        className="px-2 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-slate-400 hover:text-white border border-slate-800 shrink-0">
                        ‹ {monthAnchor.getFullYear() - 1}
                    </button>
                    {Array.from({ length: 12 }, (_, m) => {
                        const active = monthAnchor.getMonth() === m;
                        const inFuture = new Date(monthAnchor.getFullYear(), m, 1) > new Date();
                        return (
                            <button key={m} disabled={inFuture}
                                onClick={() => setMonthAnchor(d => new Date(d.getFullYear(), m, 1))}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                                    active ? 'bg-cyan-600 text-white'
                                    : inFuture ? 'bg-slate-900/40 text-slate-700 cursor-not-allowed'
                                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}`}>
                                {new Date(2000, m, 1).toLocaleDateString('en-GB', { month: 'short' })}
                            </button>
                        );
                    })}
                    <span className="text-xs font-bold text-slate-500 px-1 shrink-0">{monthAnchor.getFullYear()}</span>
                    <button
                        onClick={() => setMonthAnchor(d => new Date(d.getFullYear() + 1, d.getMonth(), 1))}
                        disabled={monthAnchor.getFullYear() >= new Date().getFullYear()}
                        title="Next year"
                        className="px-2 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-slate-400 hover:text-white border border-slate-800 shrink-0 disabled:opacity-30 disabled:hover:text-slate-400">
                        {monthAnchor.getFullYear() + 1} ›
                    </button>
                </div>
            )}

            {periodKind === 'fy' && (
                <div className="flex items-center gap-2 overflow-x-auto overscroll-x-contain -mx-2 px-2 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {/* Years run back from the one in progress. It follows the
                        clock, so on 1 April the list rolls forward on its own. */}
                    {Array.from({ length: 6 }, (_, i) => fyStart().getFullYear() - i).map(y => {
                        const active = fyAnchorYear === y;
                        return (
                            <button key={y} onClick={() => setFyAnchorYear(y)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                                    active ? 'bg-cyan-600 text-white'
                                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}`}>
                                {fyLabel(new Date(y, FY_START_MONTH, 1))}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { label: 'Revenue', value: pl.revenueTotal, icon: DollarSign, tone: 'text-emerald-400',
                      note: 'Invoiced in this period' },
                    { label: 'Gross profit', value: pl.grossProfit, icon: TrendingUp, tone: 'text-cyan-400',
                      note: `${pl.grossMarginPct.toFixed(1)}% margin after parts cost` },
                    { label: 'Operating costs', value: pl.operatingExpenses + pl.depreciation, icon: TrendingDown, tone: 'text-rose-400',
                      note: pl.depreciation > 0 ? `incl. ${lkr(pl.depreciation)} depreciation` : 'Rent, wages, utilities…' },
                    { label: 'Net profit', value: pl.netProfit, icon: Wallet, tone: pl.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400',
                      note: pl.netProfit >= 0 ? 'After everything' : 'Running at a loss' },
                ].map(s => (
                    <div key={s.label} className={`${card} p-4`}>
                        <div className="flex items-center gap-2 text-slate-400 mb-2">
                            <s.icon size={15} className={s.tone} />
                            <span className="text-[11px] font-bold uppercase tracking-wider">{s.label}</span>
                        </div>
                        <div className={`text-base sm:text-xl lg:text-2xl font-black font-mono tabular-nums break-all ${s.tone}`}>{lkr(s.value)}</div>
                        <div className="text-[10px] text-slate-500 mt-1.5 leading-snug">{s.note}</div>
                    </div>
                ))}
            </div>

            {/* Cash and who owes whom. Separated from the four profit cards above
                because profit and cash are different questions — a workshop can be
                profitable and still unable to pay its bills this week. */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                    onClick={() => {
                        setPositionsForm(Object.fromEntries(POSITION_FIELDS.map(f => [f.key, String(positionsMap[f.key] ?? '')])));
                        setPositionsModal(true);
                    }}
                    className={`${card} p-4 text-left hover:border-slate-700 transition-colors`}>
                    <div className="flex items-center gap-2 text-slate-400 mb-2">
                        <Banknote size={15} className="text-emerald-400" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">Cash available</span>
                    </div>
                    {cashEntered ? (
                        <>
                            <div className={`text-xl sm:text-2xl font-black font-mono tabular-nums break-all ${availableCash < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                {lkr(availableCash)}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1.5">
                                Bank {lkr(balance.bank)} · cash {lkr(balance.cash)} — opening balance plus this period's movements
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="text-lg font-bold text-amber-400 flex items-center gap-2">
                                <AlertTriangle size={16} /> Not entered
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1.5">
                                Add your bank and cash balance so this shows what you can actually spend. Tap to enter.
                            </div>
                        </>
                    )}
                </button>

                <button onClick={() => setTab('owed')}
                    className={`${card} p-4 text-left hover:border-slate-700 transition-colors`}>
                    <div className="flex items-center gap-2 text-slate-400 mb-2">
                        <HandCoins size={15} className="text-cyan-400" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">Owed to you</span>
                        <ArrowRight size={12} className="ml-auto text-slate-600" />
                    </div>
                    <div className="text-xl sm:text-2xl font-black font-mono tabular-nums break-all text-cyan-400">{lkr(receivables.total)}</div>
                    <div className="text-[10px] text-slate-500 mt-1.5">
                        {receivables.items.length} unpaid invoice{receivables.items.length === 1 ? '' : 's'}
                        {receivables.overdue > 0 && (
                            <span className="text-amber-400"> · {lkr(receivables.overdue)} over 30 days</span>
                        )}
                    </div>
                </button>

                <button onClick={() => setTab('owed')}
                    className={`${card} p-4 text-left hover:border-slate-700 transition-colors`}>
                    <div className="flex items-center gap-2 text-slate-400 mb-2">
                        <Scale size={15} className="text-rose-400" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">You owe</span>
                        <ArrowRight size={12} className="ml-auto text-slate-600" />
                    </div>
                    <div className="text-xl sm:text-2xl font-black font-mono tabular-nums break-all text-rose-400">{lkr(payables.total)}</div>
                    <div className="text-[10px] text-slate-500 mt-1.5">
                        {payables.items.length === 0
                            ? 'Mark an expense unpaid to track a bill here'
                            : `${payables.items.length} unpaid bill${payables.items.length === 1 ? '' : 's'}`}
                    </div>
                </button>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className={`${card} p-5`}>
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Layers size={14} className="text-cyan-400" /> Where income comes from
                    </h3>
                    <IncomeMix pl={pl} />
                </div>
                <div className={`${card} p-5`}>
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <TrendingUp size={14} className="text-emerald-400" /> Income vs expenses by month
                    </h3>
                    <TrendChart monthly={monthly} />
                </div>
                <div className={`${card} p-5`}>
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <TrendingDown size={14} className="text-rose-400" /> Biggest costs
                    </h3>
                    <ExpenseBars pl={pl} />
                </div>
            </div>

            {stockRecon && (() => {
                const diff = stockRecon.lines[0].amount;
                const bookStock = round2(raw.stock - diff);
                const isShelfHigher = diff > 0;
                return (
                    <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3.5">
                        <Package size={18} className="text-amber-400 shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-200/90 space-y-1 flex-1">
                            <div className="font-bold text-amber-100">
                                {isShelfHigher
                                    ? `Stock on shelf exceeds recorded purchases by ${lkr(Math.abs(diff))}`
                                    : `Recorded parts purchases exceed shelf stock by ${lkr(Math.abs(diff))}`}
                            </div>
                            <p className="text-xs leading-relaxed text-amber-200/80">
                                {isShelfHigher ? (
                                    <>
                                        Your shelf holds <strong>{lkr(raw.stock)}</strong> of parts, but purchase bills only account for <strong>{lkr(bookStock)}</strong>. If you restocked inventory, enter the supplier bill under <span className="font-semibold text-amber-100">Parts purchases</span> (or check that the purchase date matches this month).
                                    </>
                                ) : (
                                    <>
                                        Your books show <strong>{lkr(bookStock)}</strong> of parts, but your shelf count is <strong>{lkr(raw.stock)}</strong>. Check if parts were used without being added to a job card or if inventory counts need updating.
                                    </>
                                )}
                            </p>
                            {isShelfHigher && (
                                <div className="pt-0.5">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEntryModal('expense');
                                            setEntryForm(f => ({
                                                ...f,
                                                category: 'Parts purchases',
                                                amount_lkr: String(Math.abs(diff)),
                                                description: 'Parts purchase',
                                            }));
                                        }}
                                        className="inline-flex items-center gap-1 text-xs font-bold text-amber-300 hover:text-amber-100 underline"
                                    >
                                        + Record {lkr(Math.abs(diff))} bill now
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })()}

            {positionsIncomplete && (
                <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3">
                    <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-200/90">
                        <span className="font-bold">Balance sheet incomplete.</span>{' '}
                        Your bank, cash, loan and capital figures haven't been entered for {fyLabel(fyAnchor)},
                        so the statements can show a profit and loss account but not a balanced position.{' '}
                        <button onClick={() => { setPositionsForm({}); setPositionsModal(true); }} className="underline font-bold hover:text-amber-100">Enter them now</button>.
                    </div>
                </div>
            )}

            {/* Ledger */}
            <div className={card}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 border-b border-slate-800">
                    {/* A grid on a phone, not a scroll strip. Six chips are wider
                        than a phone, and a horizontally scrolling row gives no hint
                        that more exist — Suppliers and Assets simply looked absent.
                        Two rows of three shows all of them at once. */}
                    <div className="grid grid-cols-3 sm:flex gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800 w-full md:w-auto min-w-0">
                        {([['all', 'Activity'], ['income', 'Income'], ['expenses', 'Expenses'],
                           ['owed', 'Owed'], ['suppliers', 'Suppliers'], ['assets', 'Assets']] as [Tab, string][])
                            .map(([k, label]) => (
                                <button key={k} onClick={() => { setTab(k); setCatFilter('all'); }}
                                    className={`px-2 sm:px-3 py-2 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                                        tab === k ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                                    {label}
                                </button>
                            ))}
                    </div>
                    {tab !== 'assets' && tab !== 'owed' && tab !== 'suppliers' ? (
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <div className="relative flex-1 md:flex-none">
                                <Search className="absolute left-3 top-2.5 text-slate-500" size={15} />
                                <input value={search} onChange={e => setSearch(e.target.value)}
                                    placeholder="Search description, job, category…"
                                    className="bg-slate-800 border border-slate-700 rounded-lg py-2 pl-9 pr-3 text-xs text-white focus:outline-none focus:border-cyan-500 w-full md:w-60" />
                            </div>
                            <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
                                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 max-w-[8rem] md:max-w-none shrink-0">
                                <option value="all">All categories</option>
                                {visibleCategories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <button
                                onClick={() => downloadCSV(`finance-${tab}`, visible.map(e => ({
                                    date: e.date, description: e.description, category: e.category,
                                    direction: e.kind === 'income' ? 'in' : 'out',
                                    amount_lkr: e.amount, job: e.jobRef ?? '', logged_by: e.loggedBy ?? '',
                                })))}
                                title="Export what is shown"
                                className="p-2 shrink-0 bg-slate-800 text-slate-400 rounded-lg hover:text-white border border-slate-700 transition-colors">
                                <Download size={15} />
                            </button>
                        </div>
                    ) : tab === 'assets' ? (
                        <button onClick={() => setAssetModal(true)}
                            className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors">
                            <Plus size={14} /> Add asset
                        </button>
                    ) : null}
                </div>

                {tab === 'suppliers' ? (
                    <div className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
                            <div>
                                <h3 className="text-sm font-bold text-white">Vendor Balances & Purchases</h3>
                                <p className="text-xs text-slate-400">Purchases and trade payables logged in your books.</p>
                            </div>
                            <Link
                                to="/suppliers"
                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 rounded-xl text-xs font-bold transition-colors w-fit"
                            >
                                <Truck size={14} /> Open Supplier Directory
                            </Link>
                        </div>
                        {suppliers.length === 0 ? (
                            <div className="text-center py-10">
                                <Truck size={30} className="mx-auto text-slate-700 mb-3" />
                                <p className="text-slate-400 text-sm mb-1">No suppliers yet.</p>
                                <p className="text-slate-600 text-xs max-w-md mx-auto">
                                    Record an expense and name the supplier — the ones you buy from
                                    appear here on their own, with what you have spent and what is
                                    still owed. Nothing separate to keep up to date.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {suppliers.map(sup => (
                                    <div key={sup.name} className="bg-slate-800/40 border border-slate-800 rounded-xl p-3">
                                        <div className="flex items-start gap-3">
                                            <div className="min-w-0 flex-1">
                                                <div className="font-bold text-white text-sm truncate">{sup.name}</div>
                                                <div className="text-[11px] text-slate-500 truncate">
                                                    {[...sup.categories].slice(0, 3).join(' · ') || 'Uncategorised'}
                                                    {' · last '}{new Date(sup.lastDate).toLocaleDateString('en-GB')}
                                                </div>
                                            </div>
                                            {sup.outstanding > 0 && (
                                                <span className="text-[10px] font-bold px-2 py-1 rounded uppercase bg-rose-500/10 text-rose-400 shrink-0">
                                                    owing
                                                </span>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 mt-2.5 pt-2.5 border-t border-slate-800/70">
                                            <div>
                                                <div className="text-[10px] text-slate-500 uppercase">Bills</div>
                                                <div className="font-mono text-xs sm:text-sm text-slate-300 tabular-nums">{sup.billCount}</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-slate-500 uppercase">Spent</div>
                                                <div className="font-mono text-xs sm:text-sm text-slate-300 tabular-nums">{lkr(sup.total)}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] text-slate-500 uppercase">Still owed</div>
                                                <div className={`font-mono text-xs sm:text-sm font-bold tabular-nums ${
                                                    sup.outstanding > 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                                                    {lkr(sup.outstanding)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div className="flex justify-between items-center pt-3 mt-1 border-t border-slate-800 text-sm">
                                    <span className="text-slate-400 font-bold">Owed across {suppliers.length} supplier{suppliers.length === 1 ? '' : 's'}</span>
                                    <span className="font-mono text-rose-400 font-black">
                                        {lkr(round2(suppliers.reduce((t, x) => t + x.outstanding, 0)))}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                ) : tab === 'owed' ? (
                    <div className="p-4 space-y-8">
                        {/* ---- receivables ------------------------------------ */}
                        <section>
                            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                                <h4 className="text-sm font-black text-white flex items-center gap-2">
                                    <HandCoins size={15} className="text-cyan-400" /> Owed to you
                                </h4>
                                <span className="font-mono text-cyan-400 font-bold">{lkr(receivables.total)}</span>
                            </div>
                            <p className="text-[11px] text-slate-500 mb-3">
                                Every unpaid invoice, oldest first. Marking one paid happens on the invoice itself.
                            </p>

                            {receivables.items.length === 0 ? (
                                <p className="text-slate-600 text-sm italic py-6 text-center">
                                    Nothing outstanding. Every invoice has been settled.
                                </p>
                            ) : (
                                <>
                                    {/* ageing summary */}
                                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 mb-4">
                                        {AGE_BUCKETS.map(b => {
                                            const v = receivables.byBucket[b];
                                            const pct = receivables.total > 0 ? (v / receivables.total) * 100 : 0;
                                            const hot = b === '61-90' || b === '90+';
                                            return (
                                                <div key={b} className="bg-slate-950/60 border border-slate-800 rounded-lg p-2">
                                                    <div className="text-[9px] uppercase tracking-wide text-slate-500 mb-1 truncate">
                                                        {b === 'current' ? 'Current' : `${b}d`}
                                                    </div>
                                                    <div className={`font-mono text-xs font-bold ${hot && v > 0 ? 'text-rose-400' : 'text-slate-200'}`}>
                                                        {short(v)}
                                                    </div>
                                                    <div className="h-1 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                                                        <div className={`h-full rounded-full ${hot ? 'bg-rose-500' : 'bg-cyan-500'}`}
                                                            style={{ width: `${pct}%` }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="space-y-1.5">
                                        {receivables.items.map(item => (
                                            <div key={item.id}
                                                className="bg-slate-800/40 border border-slate-800 rounded-xl px-3 py-2.5">
                                                {/* Two rows on a phone, one on a wider screen. Flex-wrap
                                                    alone left the amount and the buttons on ragged lines. */}
                                                <div className="flex items-start gap-3 sm:items-center">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-sm text-white font-medium truncate">{item.counterparty}</div>
                                                        <div className="text-[11px] text-slate-500 font-mono truncate">
                                                            {item.reference} · {new Date(item.date).toLocaleDateString('en-GB')}
                                                        </div>
                                                    </div>
                                                    <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase shrink-0 ${
                                                        item.bucket === 'current' ? 'bg-slate-700/60 text-slate-300'
                                                        : item.bucket === '1-30' ? 'bg-cyan-500/10 text-cyan-400'
                                                        : item.bucket === '31-60' ? 'bg-amber-500/10 text-amber-400'
                                                        : 'bg-rose-500/10 text-rose-400'}`}>
                                                        {item.daysOld}d
                                                    </span>
                                                    <span className="font-mono text-sm text-white font-bold shrink-0 tabular-nums sm:w-28 sm:text-right">
                                                        {lkr(item.amount)}
                                                    </span>
                                                    <div className="hidden sm:flex items-center gap-1 shrink-0">
                                                        <button onClick={() => remindWhatsApp(item)} title="Remind on WhatsApp — opens a draft you send"
                                                            className="p-2 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors">
                                                            <MessageCircle size={16} />
                                                        </button>
                                                        <button onClick={() => remindSMS(item)} title="Remind by SMS — sends immediately"
                                                            disabled={!item.phone}
                                                            className="p-2 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
                                                            <Smartphone size={16} />
                                                        </button>
                                                        <a href={`#/invoices?invoice=${item.id}`} title="Open the invoice to update its status"
                                                            className="p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors">
                                                            <ArrowRight size={16} />
                                                        </a>
                                                    </div>
                                                </div>
                                                {/* Full-width targets on a phone — these are the actions
                                                    the page exists for, so they get real tap area. */}
                                                <div className="grid grid-cols-3 gap-1.5 mt-2.5 sm:hidden">
                                                    <button onClick={() => remindWhatsApp(item)}
                                                        className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-600/15 text-emerald-300 text-xs font-bold active:scale-95 transition-transform">
                                                        <MessageCircle size={14} /> WhatsApp
                                                    </button>
                                                    <button onClick={() => remindSMS(item)} disabled={!item.phone}
                                                        className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold disabled:opacity-40 active:scale-95 transition-transform">
                                                        <Smartphone size={14} /> SMS
                                                    </button>
                                                    <a href={`#/invoices?invoice=${item.id}`}
                                                        className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold active:scale-95 transition-transform">
                                                        Invoice <ArrowRight size={14} />
                                                    </a>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </section>

                        {/* ---- payables --------------------------------------- */}
                        <section>
                            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                                <h4 className="text-sm font-black text-white flex items-center gap-2">
                                    <Scale size={15} className="text-rose-400" /> You owe
                                </h4>
                                <span className="font-mono text-rose-400 font-bold">{lkr(payables.total)}</span>
                            </div>
                            <p className="text-[11px] text-slate-500 mb-3">
                                Bills you have recorded but not settled. Add one by recording an expense and
                                marking it unpaid — there is no separate supplier ledger to keep.
                            </p>
                            {payables.items.length === 0 ? (
                                <p className="text-slate-600 text-sm italic py-6 text-center">
                                    Nothing outstanding. Every bill you have recorded is paid.
                                </p>
                            ) : (
                                <div className="space-y-1.5">
                                    {payables.items.map(item => (
                                        <div key={item.id}
                                            className="flex items-center gap-2 sm:gap-3 bg-slate-800/40 border border-slate-800 rounded-xl px-3 py-2.5">
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm text-white font-medium truncate">{item.reference}</div>
                                                <div className="text-[11px] text-slate-500 truncate">{item.counterparty}</div>
                                            </div>
                                            <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase shrink-0 hidden sm:inline ${
                                                item.bucket === 'current' ? 'bg-slate-700/60 text-slate-300' : 'bg-amber-500/10 text-amber-400'}`}>
                                                {item.daysOld === 0 ? 'due' : `${item.daysOld}d`}
                                            </span>
                                            <span className="font-mono text-sm text-white font-bold shrink-0 tabular-nums sm:w-28 sm:text-right">{lkr(item.amount)}</span>
                                            <button onClick={() => markBillPaid(item)} title="Mark this bill as paid"
                                                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-lg bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white text-xs font-bold transition-colors shrink-0">
                                                <Check size={13} /> <span className="hidden sm:inline">Paid</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>
                ) : tab === 'assets' ? (
                    <div className="p-4">
                        {schedules.length === 0 ? (
                            <div className="text-center py-10">
                                <Building2 size={30} className="mx-auto text-slate-700 mb-3" />
                                <p className="text-slate-400 text-sm mb-1">Nothing in the asset register yet.</p>
                                <p className="text-slate-600 text-xs max-w-md mx-auto">
                                    Record what the workshop owns — hoists, compressors, diagnostic tools, vehicles.
                                    Their value is written down each year, which lowers your taxable profit and gives
                                    the auditor the fixed-asset note they need.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {schedules.map(s => (
                                    <div key={s.asset.id} className="bg-slate-800/40 border border-slate-800 rounded-xl p-3">
                                        <div className="flex items-start gap-3">
                                            <div className="min-w-0 flex-1">
                                                <div className="font-bold text-white text-sm truncate">{s.asset.name}</div>
                                                <div className="text-[11px] text-slate-500 truncate">
                                                    {s.asset.category} · bought {new Date(s.asset.purchase_date).toLocaleDateString('en-GB')} · {s.asset.useful_life_years}yr life
                                                </div>
                                            </div>
                                            <button onClick={() => deleteAsset(s.asset)}
                                                title="Remove from the register"
                                                className="text-slate-600 hover:text-red-400 p-1.5 shrink-0">
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                        {/* Three figures across on every width. Squeezed onto one line
                                            with the name they were unreadable on a phone. */}
                                        <div className="grid grid-cols-3 gap-2 mt-2.5 pt-2.5 border-t border-slate-800/70">
                                            <div>
                                                <div className="text-[10px] text-slate-500 uppercase">Cost</div>
                                                <div className="font-mono text-xs sm:text-sm text-slate-300 tabular-nums">{lkr(Number(s.asset.cost_lkr))}</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-slate-500 uppercase">This period</div>
                                                <div className="font-mono text-xs sm:text-sm text-rose-400 tabular-nums">−{lkr(s.chargeForPeriod)}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] text-slate-500 uppercase">Book value</div>
                                                <div className="font-mono text-xs sm:text-sm text-white font-bold tabular-nums">{lkr(s.netBookValue)}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div className="flex justify-between items-center pt-3 mt-1 border-t border-slate-800 text-sm">
                                    <span className="text-slate-400 font-bold">Net book value of all assets</span>
                                    <span className="font-mono text-white font-black">
                                        {lkr(schedules.reduce((t, s) => t + s.netBookValue, 0))}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="p-4">
                        {grouped.length === 0 ? (
                            <p className="text-center text-slate-500 py-10 text-sm">
                                {search || catFilter !== 'all' ? 'Nothing matches that filter.' : 'No entries in this period.'}
                            </p>
                        ) : grouped.map(([cat, { total, rows }]) => {
                            // Collapsed by default: the category totals are the
                            // headline, and a long list of line items buries them.
                            // A search or filter opens them, since the point of
                            // filtering is to see the matches.
                            const forced = search.trim() !== '' || catFilter !== 'all';
                            const open = forced || openCategories.has(cat);
                            return (
                            <div key={cat} className="mb-3 last:mb-0 border border-slate-800/70 rounded-xl overflow-hidden">
                                <button
                                    onClick={() => setOpenCategories(prev => {
                                        const next = new Set(prev);
                                        next.has(cat) ? next.delete(cat) : next.add(cat);
                                        return next;
                                    })}
                                    className="w-full flex items-center justify-between gap-3 px-3 py-2.5 bg-slate-800/30 hover:bg-slate-800/60 transition-colors text-left">
                                    <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-2 min-w-0">
                                        <ChevronRight size={13}
                                            className={`text-slate-500 transition-transform shrink-0 ${open ? 'rotate-90' : ''}`} />
                                        {cat === 'Labour' ? <Wrench size={12} className="text-cyan-400 shrink-0" />
                                            : cat.startsWith('Parts') || cat.startsWith('Cost of') ? <Package size={12} className="text-violet-400 shrink-0" />
                                            : <span className="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0" />}
                                        <span className="truncate">{cat}</span>
                                        <span className="text-slate-600 font-normal normal-case shrink-0 hidden sm:inline">
                                            · {rows.length}<span className="hidden sm:inline"> item{rows.length === 1 ? '' : 's'}</span>
                                        </span>
                                    </h4>
                                    <span className="flex items-center gap-3 shrink-0">
                                        <span className={`font-mono text-xs sm:text-sm font-bold tabular-nums ${rows[0].kind === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {rows[0].kind === 'income' ? '+' : '−'}{lkr(total)}
                                        </span>
                                        <span className="text-[10px] text-slate-500 hidden sm:inline">
                                            {open ? 'Hide' : 'View details'}
                                        </span>
                                    </span>
                                </button>
                                <div className={`space-y-1 px-2 pb-2 ${open ? 'pt-2' : 'hidden'}`}>
                                    {rows.map(e => (
                                        <div key={e.id} className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded-lg hover:bg-slate-800/40 group">
                                            <span className="text-[10px] sm:text-[11px] text-slate-500 w-11 sm:w-16 shrink-0 leading-tight">
                                                {new Date(e.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                            </span>
                                            <span className="text-xs sm:text-sm text-slate-200 flex-1 min-w-0 truncate">{e.description}</span>
                                            {e.jobRef && <span className="text-[10px] font-mono text-slate-600 hidden md:inline">#{e.jobRef}</span>}
                                            <span className={`font-mono text-xs sm:text-sm shrink-0 tabular-nums ${e.kind === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {e.kind === 'income' ? '+' : '−'}{lkr(e.amount)}
                                            </span>
                                            {/* Always visible on touch — there is no hover to reveal it. */}
                                            <button onClick={() => deleteEntry(e)}
                                                title={e.editable ? 'Delete' : 'Comes from a job card'}
                                                className={`p-1 shrink-0 transition-opacity ${e.editable
                                                    ? 'text-slate-600 hover:text-red-400 opacity-100 sm:opacity-0 sm:group-hover:opacity-100'
                                                    : 'hidden sm:block text-slate-800 cursor-default'}`}>
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ---------------------------------------------------------- modals */}
            <Modal isOpen={entryModal !== null} onClose={() => setEntryModal(null)}
                title={entryModal === 'income' ? 'Record other income' : 'Record an expense'}>
                <form onSubmit={saveEntry} className="space-y-3">
                    <p className="text-xs text-slate-500 -mt-1">
                        {entryModal === 'income'
                            ? 'Income that did not come from a job — scrap metal, waste oil, storage fees.'
                            : 'Money the workshop spent. Parts used on jobs are counted automatically; do not add them here.'}
                    </p>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Amount (LKR)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold pointer-events-none">LKR</span>
                            {/* inputMode decimal brings up the numeric keypad; the 16px
                                base size stops iOS zooming the page on focus. */}
                            <input type="number" required min="0" step="0.01" inputMode="decimal"
                                value={entryForm.amount} autoFocus
                                onChange={e => setEntryForm(f => ({ ...f, amount: e.target.value }))}
                                placeholder="0.00"
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-12 pr-3 py-3 text-white font-mono text-base tabular-nums" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Category</label>
                        <div className="flex flex-wrap gap-1.5 mb-2 max-h-28 overflow-y-auto sm:max-h-none">
                            {categoriesFor(entryModal === 'income' ? 'income' : 'expense').map(c => (
                                <button key={c} type="button" onClick={() => setEntryForm(f => ({ ...f, category: c }))}
                                    className={`px-3 py-2 sm:py-1 rounded-lg text-xs font-medium transition-colors ${
                                        entryForm.category === c ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                                    {c}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input value={newCategory} onChange={e => setNewCategory(e.target.value)}
                                placeholder="Add your own category…"
                                className="flex-1 min-w-0 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white" />
                            <button type="button" onClick={() => addCategory(entryModal === 'income' ? 'income' : 'expense', newCategory)}
                                title="Add this category"
                                className="px-4 shrink-0 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold">
                                <Check size={15} />
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Description</label>
                        <input value={entryForm.description} onChange={e => setEntryForm(f => ({ ...f, description: e.target.value }))}
                            placeholder={entryModal === 'income' ? 'Scrap metal sold to collector' : 'Electricity bill — August'}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-white text-base" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date</label>
                        <input type="date" required value={entryForm.date}
                            onChange={e => setEntryForm(f => ({ ...f, date: e.target.value }))}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-white text-base" />
                    </div>
                    {entryModal === 'expense' && (
                        <div className="border-t border-slate-800 pt-3">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Have you paid it?</label>
                            <div className="flex gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800 w-fit">
                                {([[true, 'Paid'], [false, 'Not yet']] as [boolean, string][]).map(([v, label]) => (
                                    <button key={label} type="button" onClick={() => setEntryForm(f => ({ ...f, paid: v }))}
                                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                            entryForm.paid === v ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <div className="mt-3 space-y-3 bg-slate-950/40 border border-slate-800 rounded-xl p-3">
                                {!entryForm.paid && (
                                    <p className="text-[11px] text-slate-500">
                                        This becomes a trade payable — it shows under <span className="text-slate-300 font-bold">You owe</span>{' '}
                                        and carries into the balance sheet automatically.
                                    </p>
                                )}
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Supplier / Vendor</label>
                                    <input 
                                        list="finance-supplier-options"
                                        value={entryForm.supplier} 
                                        onChange={e => setEntryForm(f => ({ ...f, supplier: e.target.value }))}
                                        placeholder="e.g. Cworks, Sterling Aftermarket"
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm" 
                                    />
                                    <datalist id="finance-supplier-options">
                                        {(raw.suppliersList || []).map((sName: string) => (
                                            <option key={sName} value={sName} />
                                        ))}
                                    </datalist>
                                </div>
                                {!entryForm.paid && (
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Due date</label>
                                        <input type="date" value={entryForm.due_date}
                                            onChange={e => setEntryForm(f => ({ ...f, due_date: e.target.value }))}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm" />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {/* Sticky so it stays reachable once the on-screen keyboard
                        has pushed the form up. */}
                    <div className="sticky bottom-0 -mx-6 px-6 pt-3 pb-1 bg-slate-900 border-t border-slate-800">
                        <button type="submit" disabled={submitting}
                            className="w-full btn-brand py-3.5 rounded-xl font-bold disabled:opacity-60">
                            {submitting ? 'Saving…'
                                : entryModal === 'income' ? 'Record income'
                                : entryForm.paid ? 'Record expense' : 'Record bill'}
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={statementModal} onClose={() => setStatementModal(false)} title="Download statements">
                <div className="space-y-3">
                    <p className="text-xs text-slate-500 -mt-1">
                        Pick what you need. Everything is prepared on the accrual basis from a
                        double-entry ledger for <span className="text-slate-300 font-bold">{periodLabel}</span>.
                    </p>

                    <div className="flex items-center justify-between bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2">
                        <span className="text-xs text-slate-400">
                            {chosen.size} of {STATEMENTS.length} selected
                        </span>
                        <div className="flex gap-2">
                            <button onClick={() => setChosen(new Set(STATEMENTS.map(x => x.key)))}
                                className="text-xs font-bold text-cyan-400 hover:text-cyan-300">Select all</button>
                            <span className="text-slate-700">·</span>
                            <button onClick={() => setChosen(new Set())}
                                className="text-xs font-bold text-slate-500 hover:text-slate-300">Clear</button>
                        </div>
                    </div>

                    <div className="space-y-1.5 max-h-[45vh] overflow-y-auto pr-1">
                        {STATEMENTS.map((st, i) => {
                            const on = chosen.has(st.key);
                            // Same hue the statement carries in the PDF, so what you
                            // tick here is recognisable in the document you get.
                            const [r, g, b] = STATEMENT_COLOURS[st.key];
                            const hue = `rgb(${r},${g},${b})`;
                            return (
                                <button key={st.key}
                                    onClick={() => setChosen(prev => {
                                        const next = new Set(prev);
                                        next.has(st.key) ? next.delete(st.key) : next.add(st.key);
                                        return next;
                                    })}
                                    style={on ? { borderColor: hue, background: `rgba(${r},${g},${b},0.14)` } : undefined}
                                    className={`w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-xl border transition-colors ${
                                        on ? '' : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'}`}>
                                    <span className="w-6 h-6 rounded-md shrink-0 flex items-center justify-center text-[11px] font-black text-white self-start sm:self-center"
                                        style={{ background: hue, opacity: on ? 1 : 0.4 }}>
                                        {i + 1}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-[13px] sm:text-sm font-bold text-white leading-snug">{st.title}</span>
                                        <span className="block text-[11px] text-slate-500 leading-snug">{st.blurb}</span>
                                    </span>
                                    <span className={`w-4 h-4 rounded shrink-0 border flex items-center justify-center self-start sm:self-center ${
                                        on ? 'border-transparent' : 'border-slate-600'}`}
                                        style={on ? { background: hue } : undefined}>
                                        {on && <Check size={11} className="text-white" strokeWidth={3} />}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex gap-2">
                        <button onClick={() => {
                                const all = STATEMENTS.map(x => x.key);
                                setChosen(new Set(all));
                                generateStatements(all);
                            }}
                            disabled={generating}
                            className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl font-bold text-sm disabled:opacity-60">
                            Download all
                        </button>
                        <button onClick={() => generateStatements([...chosen])} disabled={generating || chosen.size === 0}
                            className="flex-1 btn-brand py-3 rounded-xl font-bold text-sm disabled:opacity-60">
                            {generating ? 'Preparing…' : `Download ${chosen.size || ''}`.trim()}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={assetModal} onClose={() => setAssetModal(false)} title="Add an asset">
                <form onSubmit={saveAsset} className="space-y-4">
                    <p className="text-xs text-slate-400 leading-relaxed -mt-1">
                        Equipment or property the workshop owns for over a year. The cost is spread across its useful life through depreciation.
                    </p>

                    <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">Asset name</label>
                        <input
                            required
                            value={assetForm.name}
                            onChange={e => setAssetForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="e.g. Two-post vehicle hoist"
                            className="w-full bg-slate-800/90 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-white text-base sm:text-sm placeholder:text-slate-500 focus:border-brand focus:outline-none transition-colors"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">Category</label>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                            {categoriesFor('asset').map(c => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setAssetForm(f => ({ ...f, category: c }))}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold touch-manipulation active:scale-95 transition-all ${
                                        assetForm.category === c
                                            ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-600/30'
                                            : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700/50'
                                    }`}
                                >
                                    {c}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input
                                value={newCategory}
                                onChange={e => setNewCategory(e.target.value)}
                                placeholder="Add custom category…"
                                className="flex-1 bg-slate-800/60 border border-slate-700/80 rounded-xl px-3 py-2 text-base sm:text-xs text-white placeholder:text-slate-500 focus:border-brand focus:outline-none"
                            />
                            <button
                                type="button"
                                onClick={() => addCategory('asset', newCategory)}
                                className="px-3.5 h-10 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center justify-center shrink-0 active:scale-95 transition-transform"
                                title="Add category"
                            >
                                <Check size={16} />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Purchase date</label>
                            <input
                                type="date"
                                required
                                value={assetForm.purchase_date}
                                onChange={e => setAssetForm(f => ({ ...f, purchase_date: e.target.value }))}
                                className="w-full bg-slate-800/90 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-white text-base sm:text-sm focus:border-brand focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Cost (LKR)</label>
                            <input
                                type="number"
                                inputMode="decimal"
                                required
                                min="0"
                                step="any"
                                placeholder="0"
                                value={assetForm.cost_lkr}
                                onChange={e => setAssetForm(f => ({ ...f, cost_lkr: e.target.value }))}
                                className="w-full bg-slate-800/90 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-white font-mono text-base sm:text-sm focus:border-brand focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Useful life (years)</label>
                            <input
                                type="number"
                                inputMode="decimal"
                                required
                                min="1"
                                step="0.5"
                                placeholder="5"
                                value={assetForm.useful_life_years}
                                onChange={e => setAssetForm(f => ({ ...f, useful_life_years: e.target.value }))}
                                className="w-full bg-slate-800/90 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-white font-mono text-base sm:text-sm focus:border-brand focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Scrap / residual value (LKR)</label>
                            <input
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="any"
                                placeholder="0"
                                value={assetForm.residual_lkr}
                                onChange={e => setAssetForm(f => ({ ...f, residual_lkr: e.target.value }))}
                                className="w-full bg-slate-800/90 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-white font-mono text-base sm:text-sm focus:border-brand focus:outline-none"
                            />
                        </div>
                    </div>

                    {parseFloat(assetForm.cost_lkr) > 0 && parseFloat(assetForm.useful_life_years) > 0 && (
                        <div className="flex items-center justify-between bg-cyan-500/10 border border-cyan-500/25 rounded-xl px-3.5 py-2.5 text-xs text-slate-300">
                            <span className="text-slate-400">Annual depreciation:</span>
                            <span className="font-mono text-cyan-300 font-bold text-sm">
                                {lkr((parseFloat(assetForm.cost_lkr) - (parseFloat(assetForm.residual_lkr) || 0)) / parseFloat(assetForm.useful_life_years))} / yr
                            </span>
                        </div>
                    )}

                    <div className="pt-1">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full btn-brand py-3.5 sm:py-3 rounded-xl font-bold text-sm shadow-md shadow-brand/20 active:scale-[0.98] transition-all disabled:opacity-60"
                        >
                            {submitting ? 'Saving…' : 'Add to register'}
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={positionsModal} onClose={() => setPositionsModal(false)}
                title={`Opening balances — ${fyLabel(fyAnchor)}`}>
                <div className="space-y-3">
                    <p className="text-xs text-slate-500 -mt-1">
                        AutoPulse works out your assets, stock and debtors from the jobs and invoices it holds.
                        These last few figures it cannot know — they come off your bank statement and your books.
                        Enter them and the statements will produce a balance sheet that actually balances.
                    </p>
                    {POSITION_FIELDS.map(f => (
                        <div key={f.key}>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{f.label}</label>
                            <input type="number" step="0.01" value={positionsForm[f.key] ?? ''}
                                onChange={e => setPositionsForm(p => ({ ...p, [f.key]: e.target.value }))}
                                placeholder="0"
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-mono text-sm" />
                            <p className="text-[10px] text-slate-600 mt-1">{f.hint}</p>
                        </div>
                    ))}
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-xs space-y-1">
                        <div className="flex justify-between"><span className="text-slate-500">Computed for you — fixed assets</span>
                            <span className="font-mono text-slate-300">{lkr(balance.fixedAssetsNbv)}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Stock of parts at cost</span>
                            <span className="font-mono text-slate-300">{lkr(balance.stock)}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Trade debtors (unpaid invoices)</span>
                            <span className="font-mono text-slate-300">{lkr(balance.debtors)}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Trade payables (unpaid bills)</span>
                            <span className="font-mono text-slate-300">{lkr(balance.payables)}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Stock per the books</span>
                            <span className="font-mono text-slate-300">{lkr(balance.stock)}</span></div>
                        {Math.abs(stockVariance) >= 1 && (
                            <div className="flex justify-between pt-1 border-t border-slate-800/70">
                                <span className="text-amber-400/80">Stock on the shelf differs by</span>
                                <span className="font-mono text-amber-400">{lkr(stockVariance)}</span>
                            </div>
                        )}
                    </div>
                    {Math.abs(stockVariance) >= 1 && (
                        <p className="text-[10px] text-slate-600 leading-relaxed">
                            The parts list values stock at {lkr(raw.stock)}, the books at {lkr(balance.stock)}.
                            A gap usually means parts bought without being recorded under
                            "{'Parts purchases'}", or an opening stock figure that needs setting above.
                        </p>
                    )}
                    <button onClick={savePositions} disabled={submitting}
                        className="w-full btn-brand py-3 rounded-xl font-bold disabled:opacity-60">
                        {submitting ? 'Saving…' : 'Save figures'}
                    </button>
                </div>
            </Modal>
        </div>
    );
};
