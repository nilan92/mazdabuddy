import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    DollarSign, TrendingUp, TrendingDown, Search, Plus, Trash2, FileText, Download,
    Wallet, Package, Wrench, Building2, Scale, AlertTriangle, Check, Layers,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Modal } from './Modal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { downloadCSV } from '../lib/csv';
import { fyStart, fyEnd, fyLabel, toISODate, describePeriod } from '../lib/fiscal';
import {
    buildLedger, profitAndLoss, depreciate, balanceSheet, round2,
    type LedgerEntry, type Asset,
} from '../lib/finance';
import { buildAuditPack } from '../lib/financePdf';

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

/* The balance-sheet figures no transaction in this system can produce. */
const POSITION_FIELDS = [
    { key: 'bank', label: 'Bank balance', hint: 'Closing balance per the bank statement at period end' },
    { key: 'cash', label: 'Cash in hand', hint: 'Physical cash held at period end' },
    { key: 'payables', label: 'Trade payables', hint: 'Owed to parts suppliers and others' },
    { key: 'loans', label: 'Loans and borrowings', hint: 'Outstanding loan balances' },
    { key: 'share_capital', label: 'Stated capital', hint: 'Capital introduced by the shareholders' },
    { key: 'retained_earnings_bf', label: 'Retained earnings b/f', hint: "Accumulated profit at the start of this year" },
];

const lkr = (v: number) => `LKR ${Math.round(v).toLocaleString()}`;
const short = (v: number) =>
    Math.abs(v) >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
    : Math.abs(v) >= 1_000 ? `${Math.round(v / 1_000)}k` : String(Math.round(v));

type PeriodKind = 'month' | 'fy' | 'all' | 'custom';
type Tab = 'all' | 'income' | 'expenses' | 'assets';

export const Finances = () => {
    const { profile } = useAuth();
    const { toast } = useToast();
    const confirm = useConfirm();

    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<Tab>('all');
    const [periodKind, setPeriodKind] = useState<PeriodKind>('fy');
    const [customRange, setCustomRange] = useState({
        start: toISODate(fyStart()), end: toISODate(fyEnd()),
    });
    const [search, setSearch] = useState('');
    const [catFilter, setCatFilter] = useState('all');

    const [raw, setRaw] = useState<{
        invoices: any[]; labour: any[]; parts: any[]; manual: any[];
        assets: Asset[]; categories: any[]; positions: any[]; stock: number; debtors: any[];
    }>({ invoices: [], labour: [], parts: [], manual: [], assets: [], categories: [], positions: [], stock: 0, debtors: [] });

    const [tenant, setTenant] = useState<any>(null);
    const [entryModal, setEntryModal] = useState<null | 'income' | 'expense'>(null);
    const [assetModal, setAssetModal] = useState(false);
    const [positionsModal, setPositionsModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [generating, setGenerating] = useState(false);

    const [entryForm, setEntryForm] = useState({ amount: '', description: '', category: '', date: toISODate(new Date()) });
    const [assetForm, setAssetForm] = useState({
        name: '', category: 'Equipment', purchase_date: toISODate(new Date()),
        cost_lkr: '', useful_life_years: '5', residual_lkr: '0', notes: '',
    });
    const [newCategory, setNewCategory] = useState('');
    const [positionsForm, setPositionsForm] = useState<Record<string, string>>({});

    /* ---------------------------------------------------------------- period */
    const period = useMemo(() => {
        const now = new Date();
        if (periodKind === 'month') {
            return { start: new Date(now.getFullYear(), now.getMonth(), 1),
                     end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) };
        }
        if (periodKind === 'fy') return { start: fyStart(now), end: new Date(fyEnd(now).setHours(23, 59, 59, 999)) };
        if (periodKind === 'all') return { start: new Date(2000, 0, 1), end: new Date(2999, 11, 31) };
        return { start: new Date(`${customRange.start}T00:00:00`), end: new Date(`${customRange.end}T23:59:59`) };
    }, [periodKind, customRange]);

    const periodLabel = periodKind === 'all'
        ? 'All time'
        : describePeriod(toISODate(period.start), toISODate(period.end));

    /* ------------------------------------------------------------------ data */
    const fetchAll = useCallback(async () => {
        if (!profile?.tenant_id) return;
        setLoading(true);
        try {
            const [inv, lab, prt, man, ast, cat, pos, stk, ten] = await Promise.all([
                supabase.from('invoices').select('id, total_amount_lkr, discount_lkr, created_at, status, job_id'),
                supabase.from('job_labor').select('id, created_at, description, hours, hourly_rate_lkr, is_fixed, mechanic_name, job_cards!inner(id, status)').eq('job_cards.status', 'completed'),
                supabase.from('job_parts').select('id, created_at, quantity, price_at_time_lkr, cost_at_time_lkr, is_custom, custom_name, parts(name, cost_lkr), job_cards!inner(id, status)').eq('job_cards.status', 'completed'),
                supabase.from('user_expenses').select('*, profiles!user_id(full_name)').order('date', { ascending: false }),
                supabase.from('assets').select('*').order('purchase_date', { ascending: false }),
                supabase.from('finance_categories').select('*'),
                supabase.from('finance_positions').select('*').eq('fy_start', toISODate(fyStart(period.start))),
                supabase.from('parts').select('stock_quantity, cost_lkr'),
                supabase.from('tenants').select('name, address, phone').eq('id', profile.tenant_id).single(),
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
            });
        } catch (e: any) {
            console.error('[Finances]', e);
            toast('Could not load finances: ' + e.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [profile?.tenant_id, period.start, toast]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

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

    const positionsMap = useMemo(() => {
        const m: Record<string, number> = {};
        for (const p of raw.positions) m[p.key] = Number(p.amount_lkr) || 0;
        return m;
    }, [raw.positions]);

    const balance = useMemo(() => balanceSheet({
        fixedAssetsNbv: round2(schedules.reduce((t, s) => t + s.netBookValue, 0)),
        stock: raw.stock,
        debtors: round2(raw.debtors.reduce((t: number, d: any) => t + (Number(d.total_amount_lkr) || 0), 0)),
        bank: positionsMap.bank || 0,
        cash: positionsMap.cash || 0,
        payables: positionsMap.payables || 0,
        loans: positionsMap.loans || 0,
        shareCapital: positionsMap.share_capital || 0,
        retainedEarningsBf: positionsMap.retained_earnings_bf || 0,
        profitForYear: pl.netProfit,
    }), [schedules, raw.stock, raw.debtors, positionsMap, pl.netProfit]);

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
        const { error } = await supabase.from('user_expenses').insert({
            user_id: profile?.id, tenant_id: profile?.tenant_id,
            amount_lkr: amount, description: entryForm.description || entryForm.category,
            category: entryForm.category, date: entryForm.date,
            is_income: entryModal === 'income',
        });
        setSubmitting(false);
        if (error) return toast(error.message, 'error');
        setEntryModal(null);
        setEntryForm({ amount: '', description: '', category: '', date: toISODate(new Date()) });
        fetchAll();
        toast(entryModal === 'income' ? 'Income recorded.' : 'Expense recorded.', 'success');
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
        const fy = toISODate(fyStart(period.start));
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

    const positionsIncomplete = raw.positions.length === 0;

    const generateStatements = async () => {
        setGenerating(true);
        try {
            const doc = buildAuditPack({
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
            doc.save(`Financial-Statements-${toISODate(period.start)}-to-${toISODate(period.end)}.pdf`);
            toast('Statements downloaded.', 'success');
        } catch (err: any) {
            console.error('[Finances] statement generation failed', err);
            toast('Could not generate statements: ' + err.message, 'error');
        } finally {
            setGenerating(false);
        }
    };

    /* ----------------------------------------------------------------- chart */
    const IncomeMix = () => {
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
                            <span className="text-slate-300 flex-1">{s.label}</span>
                            <span className="text-slate-500 text-xs">{((s.value / total) * 100).toFixed(0)}%</span>
                            <span className="font-mono text-white w-28 text-right">{lkr(s.value)}</span>
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

    const TrendChart = () => {
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
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    {monthly.map((m, i) => <span key={i}>{m.label}</span>)}
                </div>
                <div className="flex gap-4 mt-3 text-xs">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> <span className="text-slate-400">Money in</span></span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-rose-500" /> <span className="text-slate-400">Money out</span></span>
                    <span className="ml-auto text-slate-500">peak {short(max)}</span>
                </div>
            </div>
        );
    };

    const ExpenseBars = () => {
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
                    <h1 className="text-3xl font-bold text-white mb-1">Finances</h1>
                    <p className="text-slate-400 text-sm">{periodLabel}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button onClick={() => { setEntryModal('income'); setEntryForm(f => ({ ...f, category: '' })); }}
                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-3 py-2.5 rounded-xl font-bold text-sm transition-colors">
                        <Plus size={15} /> Other Income
                    </button>
                    <button onClick={() => { setEntryModal('expense'); setEntryForm(f => ({ ...f, category: '' })); }}
                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-3 py-2.5 rounded-xl font-bold text-sm transition-colors">
                        <Plus size={15} /> Expense
                    </button>
                    <button onClick={() => {
                        setPositionsForm(Object.fromEntries(POSITION_FIELDS.map(f =>
                            [f.key, String(positionsMap[f.key] ?? '')])));
                        setPositionsModal(true);
                    }}
                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-3 py-2.5 rounded-xl font-bold text-sm transition-colors">
                        <Scale size={15} /> Balance Sheet
                    </button>
                    <button onClick={generateStatements} disabled={generating}
                        className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95">
                        <FileText size={15} /> {generating ? 'Preparing…' : 'Statements'}
                    </button>
                </div>
            </div>

            {/* Period selector */}
            <div className="flex flex-wrap items-center gap-2">
                {([['month', 'This month'], ['fy', fyLabel()], ['all', 'All time'], ['custom', 'Custom']] as [PeriodKind, string][])
                    .map(([k, label]) => (
                        <button key={k} onClick={() => setPeriodKind(k)}
                            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors ${
                                periodKind === k ? 'bg-cyan-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}`}>
                            {label}
                        </button>
                    ))}
                {periodKind === 'custom' && (
                    <div className="flex items-center gap-2 ml-1">
                        <input type="date" value={customRange.start} onChange={e => setCustomRange(r => ({ ...r, start: e.target.value }))}
                            className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white" />
                        <span className="text-slate-600 text-xs">to</span>
                        <input type="date" value={customRange.end} onChange={e => setCustomRange(r => ({ ...r, end: e.target.value }))}
                            className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white" />
                    </div>
                )}
            </div>

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
                        <div className={`text-xl lg:text-2xl font-black font-mono ${s.tone}`}>{lkr(s.value)}</div>
                        <div className="text-[10px] text-slate-500 mt-1.5 leading-snug">{s.note}</div>
                    </div>
                ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className={`${card} p-5`}>
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Layers size={14} className="text-cyan-400" /> Where income comes from
                    </h3>
                    <IncomeMix />
                </div>
                <div className={`${card} p-5`}>
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <TrendingUp size={14} className="text-emerald-400" /> In vs out by month
                    </h3>
                    <TrendChart />
                </div>
                <div className={`${card} p-5`}>
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <TrendingDown size={14} className="text-rose-400" /> Biggest costs
                    </h3>
                    <ExpenseBars />
                </div>
            </div>

            {positionsIncomplete && (
                <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3">
                    <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-200/90">
                        <span className="font-bold">Balance sheet incomplete.</span>{' '}
                        Your bank, cash, payables, loan and capital figures haven't been entered for {fyLabel(period.start)},
                        so the statements can show a profit and loss account but not a balanced position.{' '}
                        <button onClick={() => { setPositionsForm({}); setPositionsModal(true); }} className="underline font-bold hover:text-amber-100">Enter them now</button>.
                    </div>
                </div>
            )}

            {/* Ledger */}
            <div className={card}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 border-b border-slate-800">
                    <div className="flex gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
                        {([['all', 'All activity'], ['income', 'Income'], ['expenses', 'Expenses'], ['assets', 'Assets']] as [Tab, string][])
                            .map(([k, label]) => (
                                <button key={k} onClick={() => { setTab(k); setCatFilter('all'); }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                        tab === k ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                                    {label}
                                </button>
                            ))}
                    </div>
                    {tab !== 'assets' ? (
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 text-slate-500" size={15} />
                                <input value={search} onChange={e => setSearch(e.target.value)}
                                    placeholder="Search description, job, category…"
                                    className="bg-slate-800 border border-slate-700 rounded-lg py-2 pl-9 pr-3 text-xs text-white focus:outline-none focus:border-cyan-500 w-full md:w-60" />
                            </div>
                            <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
                                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-cyan-500">
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
                                className="p-2 bg-slate-800 text-slate-400 rounded-lg hover:text-white border border-slate-700 transition-colors">
                                <Download size={15} />
                            </button>
                        </div>
                    ) : (
                        <button onClick={() => setAssetModal(true)}
                            className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors">
                            <Plus size={14} /> Add asset
                        </button>
                    )}
                </div>

                {tab === 'assets' ? (
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
                                    <div key={s.asset.id} className="flex flex-wrap items-center gap-3 bg-slate-800/40 border border-slate-800 rounded-xl p-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="font-bold text-white text-sm truncate">{s.asset.name}</div>
                                            <div className="text-[11px] text-slate-500">
                                                {s.asset.category} · bought {new Date(s.asset.purchase_date).toLocaleDateString('en-GB')} · {s.asset.useful_life_years}yr life
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] text-slate-500 uppercase">Cost</div>
                                            <div className="font-mono text-sm text-slate-300">{lkr(Number(s.asset.cost_lkr))}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] text-slate-500 uppercase">This period</div>
                                            <div className="font-mono text-sm text-rose-400">−{lkr(s.chargeForPeriod)}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] text-slate-500 uppercase">Book value</div>
                                            <div className="font-mono text-sm text-white font-bold">{lkr(s.netBookValue)}</div>
                                        </div>
                                        <button onClick={() => deleteAsset(s.asset)} className="text-slate-600 hover:text-red-400 p-1.5">
                                            <Trash2 size={15} />
                                        </button>
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
                        ) : grouped.map(([cat, { total, rows }]) => (
                            <div key={cat} className="mb-5 last:mb-0">
                                <div className="flex items-center justify-between mb-2 px-1">
                                    <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                                        {cat === 'Labour' ? <Wrench size={12} className="text-cyan-400" />
                                            : cat.startsWith('Parts') || cat.startsWith('Cost of') ? <Package size={12} className="text-violet-400" />
                                            : <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />}
                                        {cat}
                                        <span className="text-slate-600 font-normal normal-case">· {rows.length}</span>
                                    </h4>
                                    <span className={`font-mono text-sm font-bold ${rows[0].kind === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {rows[0].kind === 'income' ? '+' : '−'}{lkr(total)}
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    {rows.map(e => (
                                        <div key={e.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800/40 group">
                                            <span className="text-[11px] text-slate-500 w-16 shrink-0">
                                                {new Date(e.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                            </span>
                                            <span className="text-sm text-slate-200 flex-1 min-w-0 truncate">{e.description}</span>
                                            {e.jobRef && <span className="text-[10px] font-mono text-slate-600 hidden sm:inline">#{e.jobRef}</span>}
                                            <span className={`font-mono text-sm shrink-0 ${e.kind === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {e.kind === 'income' ? '+' : '−'}{lkr(e.amount)}
                                            </span>
                                            <button onClick={() => deleteEntry(e)}
                                                title={e.editable ? 'Delete' : 'Comes from a job card'}
                                                className={`p-1 transition-opacity ${e.editable
                                                    ? 'text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100'
                                                    : 'text-slate-800 cursor-default'}`}>
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
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
                        <input type="number" required min="0" step="0.01" value={entryForm.amount}
                            onChange={e => setEntryForm(f => ({ ...f, amount: e.target.value }))}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-mono" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Category</label>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                            {categoriesFor(entryModal === 'income' ? 'income' : 'expense').map(c => (
                                <button key={c} type="button" onClick={() => setEntryForm(f => ({ ...f, category: c }))}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                                        entryForm.category === c ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                                    {c}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input value={newCategory} onChange={e => setNewCategory(e.target.value)}
                                placeholder="Add your own category…"
                                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white" />
                            <button type="button" onClick={() => addCategory(entryModal === 'income' ? 'income' : 'expense', newCategory)}
                                className="px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold">
                                <Check size={14} />
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Description</label>
                        <input value={entryForm.description} onChange={e => setEntryForm(f => ({ ...f, description: e.target.value }))}
                            placeholder={entryModal === 'income' ? 'Scrap metal sold to collector' : 'Electricity bill — August'}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date</label>
                        <input type="date" required value={entryForm.date}
                            onChange={e => setEntryForm(f => ({ ...f, date: e.target.value }))}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm" />
                    </div>
                    <button type="submit" disabled={submitting}
                        className="w-full btn-brand py-3 rounded-xl font-bold disabled:opacity-60">
                        {submitting ? 'Saving…' : entryModal === 'income' ? 'Record income' : 'Record expense'}
                    </button>
                </form>
            </Modal>

            <Modal isOpen={assetModal} onClose={() => setAssetModal(false)} title="Add an asset">
                <form onSubmit={saveAsset} className="space-y-3">
                    <p className="text-xs text-slate-500 -mt-1">
                        Something the workshop owns and will use for more than a year. Its cost is spread
                        across its useful life rather than charged all at once.
                    </p>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">What is it</label>
                        <input required value={assetForm.name} onChange={e => setAssetForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="Two-post ramp hoist"
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Category</label>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                            {categoriesFor('asset').map(c => (
                                <button key={c} type="button" onClick={() => setAssetForm(f => ({ ...f, category: c }))}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                                        assetForm.category === c ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                                    {c}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input value={newCategory} onChange={e => setNewCategory(e.target.value)}
                                placeholder="Add your own category…"
                                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white" />
                            <button type="button" onClick={() => addCategory('asset', newCategory)}
                                className="px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold">
                                <Check size={14} />
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Purchase date</label>
                            <input type="date" required value={assetForm.purchase_date}
                                onChange={e => setAssetForm(f => ({ ...f, purchase_date: e.target.value }))}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cost (LKR)</label>
                            <input type="number" required min="0" step="0.01" value={assetForm.cost_lkr}
                                onChange={e => setAssetForm(f => ({ ...f, cost_lkr: e.target.value }))}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-mono text-sm" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Useful life (years)</label>
                            <input type="number" required min="1" step="0.5" value={assetForm.useful_life_years}
                                onChange={e => setAssetForm(f => ({ ...f, useful_life_years: e.target.value }))}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-mono text-sm" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Scrap value (LKR)</label>
                            <input type="number" min="0" step="0.01" value={assetForm.residual_lkr}
                                onChange={e => setAssetForm(f => ({ ...f, residual_lkr: e.target.value }))}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-mono text-sm" />
                        </div>
                    </div>
                    {parseFloat(assetForm.cost_lkr) > 0 && parseFloat(assetForm.useful_life_years) > 0 && (
                        <div className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-400">
                            Writes down about{' '}
                            <span className="font-mono text-cyan-400">
                                {lkr((parseFloat(assetForm.cost_lkr) - (parseFloat(assetForm.residual_lkr) || 0)) / parseFloat(assetForm.useful_life_years))}
                            </span>{' '}
                            a year.
                        </div>
                    )}
                    <button type="submit" disabled={submitting}
                        className="w-full btn-brand py-3 rounded-xl font-bold disabled:opacity-60">
                        {submitting ? 'Saving…' : 'Add to register'}
                    </button>
                </form>
            </Modal>

            <Modal isOpen={positionsModal} onClose={() => setPositionsModal(false)}
                title={`Balance sheet figures — ${fyLabel(period.start)}`}>
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
                    </div>
                    <button onClick={savePositions} disabled={submitting}
                        className="w-full btn-brand py-3 rounded-xl font-bold disabled:opacity-60">
                        {submitting ? 'Saving…' : 'Save figures'}
                    </button>
                </div>
            </Modal>
        </div>
    );
};
