import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Plus, Search, RefreshCcw, Download, Printer, MessageCircle, Trash2, ClipboardList,
    ArrowRightCircle, CheckCircle, XCircle, Send, Package, Wrench, Car, ExternalLink, Save, CalendarClock,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { Modal } from './Modal';
import { AutoSuggestInput, type SuggestionItem } from './AutoSuggestInput';
import {
    loadPartsMemory, loadLaborMemory, savePartToMemory, saveLaborToMemory, syncItemMemoryFromDb,
    getPartSuggestions, getLaborSuggestions, type PartMemoryItem, type LaborMemoryItem,
} from '../lib/itemMemory';
import {
    quotationNumber, effectiveQuotationStatus, canConvertQuotation, calcQuotationSummary, addDaysISO,
    quotationMessage, QUOTATION_STATUS_LABEL, QUOTATION_STATUS_STYLE, bySortOrder,
    type QuotationStatus, type QuotationPartRow, type QuotationLaborRow,
} from '../lib/quotations';
import { calcDiscount, type DiscountType } from '../lib/totals';
import { toISODate } from '../lib/fiscal';
import { withTitle, tidyName, CUSTOMER_TITLES } from '../lib/textCase';
import { toSriLankanMsisdn, shareInvoice } from '../lib/whatsapp';
import { downloadCSV } from '../lib/csv';
import { logAudit } from '../lib/audit';
import type { Vehicle, Part } from '../types';
import type jsPDF from 'jspdf';
import type { QuotationPdfTenant } from '../lib/quotationPdf';

interface PartLine {
    key: string;
    id?: string;
    part_id: string | null;
    is_custom: boolean;
    custom_name: string;
    quantity: number;
    price_at_time_lkr: number;
    cost_at_time_lkr: number;
    discount_type: DiscountType;
    discount_value: number;
}

interface LaborLine {
    key: string;
    id?: string;
    description: string;
    is_fixed: boolean;
    quantity: number;
    hours: number;
    hourly_rate_lkr: number;
    discount_type: DiscountType;
    discount_value: number;
}

interface QuoteRow {
    id: string;
    tenant_id: string;
    vehicle_id: string;
    description: string | null;
    notes: string | null;
    valid_until: string | null;
    status: string;
    discount_type: DiscountType;
    discount_value: number;
    total_amount_lkr: number;
    job_id: string | null;
    created_at: string;
    vehicles?: QuoteVehicle | null;
    quotation_parts?: QuotationPartRow[];
    quotation_labor?: QuotationLaborRow[];
}

interface QuoteVehicle {
    id: string;
    make: string;
    model: string;
    year?: string | null;
    license_plate: string;
    color?: string | null;
    vin?: string | null;
    customers?: { title?: string | null; name?: string | null; phone?: string | null; address?: string | null; email?: string | null } | null;
}

const errMsg = (e: unknown, fallback = 'Something went wrong.') =>
    (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string')
        ? (e as { message: string }).message : fallback;

const newKey = () => Math.random().toString(36).slice(2);
const fmtDate = (iso?: string | null) => {
    if (!iso) return '';
    const d = iso.length <= 10 ? new Date(`${iso}T00:00:00`) : new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};
const lkr = (n: number) => `LKR ${(Number(n) || 0).toLocaleString()}`;

const inputCls = 'w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-white text-base md:text-sm focus:border-brand focus:outline-none';
const labelCls = 'block text-[10px] font-bold text-slate-500 uppercase mb-1';

type Filter = 'all' | 'open' | 'accepted' | 'converted' | 'closed';

export const Quotations = () => {
    const { profile } = useAuth();
    const { toast } = useToast();
    const confirm = useConfirm();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const location = useLocation();
    const today = toISODate(new Date());

    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<Filter>('all');
    const [editorOpen, setEditorOpen] = useState(false);
    const [editing, setEditing] = useState<QuoteRow | null>(null);

    const { data: quotes = [], isLoading, error: quotesError } = useQuery({
        queryKey: ['quotations'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('quotations')
                .select(`*,
                    vehicles (id, make, model, year, license_plate, color, vin, customers (title, name, phone, address, email)),
                    quotation_parts (*, parts (name)),
                    quotation_labor (*)`)
                .order('created_at', { ascending: false })
                .limit(200);
            if (error) throw error;
            return (data || []) as QuoteRow[];
        },
        retry: 1,
    });

    // Same key and shape as Invoices, so the two share one cached copy.
    const { data: tenant } = useQuery({
        queryKey: ['tenant'],
        queryFn: async () => {
            if (!profile?.tenant_id) return null;
            const { data } = await supabase
                .from('tenants')
                .select('name, address, phone, email, brand_color, logo_url, terms_and_conditions, payment_qr_url, payment_link, bank_details')
                .eq('id', profile.tenant_id)
                .single();
            return data;
        },
        enabled: !!profile?.tenant_id,
    });

    const refresh = () => queryClient.invalidateQueries({ queryKey: ['quotations'] });

    const openNew = () => { setDeepLinkId(null); setEditing(null); setEditorOpen(true); };
    const openQuote = (q: QuoteRow) => { setDeepLinkId(null); setEditing(q); setEditorOpen(true); };
    const closeEditor = () => { setDeepLinkId(null); setEditorOpen(false); };

    // #/quotations?quote=<id> opens that quote (the job card links back this way).
    const [deepLinkId, setDeepLinkId] = useState<string | null>(() => new URLSearchParams(location.search).get('quote'));
    const deepLinked = deepLinkId ? quotes.find(q => q.id === deepLinkId) : undefined;
    useEffect(() => {
        if (new URLSearchParams(location.search).get('quote')) navigate('/quotations', { replace: true });
    }, [location.search, navigate]);

    const rows = useMemo(() => quotes.map(q => {
        const status = effectiveQuotationStatus(q.status, q.valid_until, today);
        const cust = q.vehicles?.customers;
        return {
            q,
            status,
            number: quotationNumber(q.id),
            customer: withTitle(cust?.title, cust?.name) || 'Unknown',
            phone: cust?.phone || '',
            vehicle: q.vehicles ? `${q.vehicles.make} ${q.vehicles.model}` : '',
            plate: q.vehicles?.license_plate || '',
        };
    }), [quotes, today]);

    const visible = rows.filter(r => {
        const s = search.toLowerCase().trim();
        const matches = !s || [r.number, r.customer, r.vehicle, r.plate, r.q.description || '']
            .some(v => v.toLowerCase().includes(s))
            || (!!s.replace(/\D/g, '') && r.phone.replace(/\D/g, '').includes(s.replace(/\D/g, '')));
        const f = filter === 'all'
            || (filter === 'open' && (r.status === 'draft' || r.status === 'sent'))
            || (filter === 'accepted' && r.status === 'accepted')
            || (filter === 'converted' && r.status === 'converted')
            || (filter === 'closed' && (r.status === 'declined' || r.status === 'expired'));
        return matches && f;
    });

    const openValue = rows
        .filter(r => r.status === 'draft' || r.status === 'sent' || r.status === 'accepted')
        .reduce((s, r) => s + (Number(r.q.total_amount_lkr) || 0), 0);

    const notInstalled = !!quotesError && /quotations|relation|schema cache/i.test(errMsg(quotesError, ''));

    return (
        <div className="h-full flex flex-col">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Quotations</h1>
                    <p className="text-slate-400">Quote the work, then turn an accepted quote into a job.</p>
                </div>
                <div className="flex flex-wrap gap-3 items-center">
                    <button
                        onClick={() => downloadCSV('quotations', visible.map(r => ({
                            number: r.number,
                            customer: r.customer,
                            vehicle: `${r.vehicle} (${r.plate})`,
                            status: QUOTATION_STATUS_LABEL[r.status],
                            total: r.q.total_amount_lkr,
                            created: fmtDate(r.q.created_at),
                            valid_until: fmtDate(r.q.valid_until),
                        })))}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                        title="Export CSV"
                    >
                        <Download size={20} />
                    </button>
                    <button onClick={refresh} className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors" title="Refresh">
                        <RefreshCcw size={20} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={openNew}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-cyan-400 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-cyan-500/25 border border-cyan-300 transition-all active:scale-95"
                    >
                        <Plus size={18} strokeWidth={3} /> New Quote
                    </button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 text-slate-500" size={18} />
                    <input
                        type="text"
                        placeholder="Search quote no., customer, phone, plate..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 pl-10 text-white text-base md:text-sm focus:border-brand focus:outline-none"
                    />
                </div>
                <div className="flex gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 overflow-x-auto">
                    {([
                        ['all', 'All'], ['open', 'Open'], ['accepted', 'Accepted'], ['converted', 'Converted'], ['closed', 'Declined / Expired'],
                    ] as [Filter, string][]).map(([id, label]) => (
                        <button
                            key={id}
                            onClick={() => setFilter(id)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${filter === id ? 'bg-brand text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {rows.length > 0 && (
                <div className="text-xs text-slate-500 mb-3">
                    Open quotes worth <span className="text-cyan-400 font-bold">{lkr(openValue)}</span>
                </div>
            )}

            <div className="flex-1 overflow-y-auto pb-24 md:pb-4">
                {notInstalled ? (
                    <div className="p-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 text-amber-200 text-sm">
                        Quotations are not switched on for this workshop's database yet. An admin needs to run the quotations update first.
                    </div>
                ) : quotesError ? (
                    <div className="p-6 text-red-300 text-sm">Could not load quotations: {errMsg(quotesError)}</div>
                ) : isLoading ? (
                    <div className="p-6 text-slate-500 text-sm">Loading quotations…</div>
                ) : visible.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center p-10 text-slate-500 border border-dashed border-slate-800 rounded-2xl">
                        <ClipboardList size={36} className="mb-3 text-slate-600" />
                        <div className="font-bold text-slate-300 mb-1">{rows.length ? 'No quotes match' : 'No quotations yet'}</div>
                        <div className="text-sm mb-4">Price up parts and labour, send it as a PDF, convert to a job when the customer says yes.</div>
                        {!rows.length && (
                            <button onClick={openNew} className="btn-brand px-4 py-2 rounded-xl text-sm font-bold inline-flex items-center gap-2">
                                <Plus size={16} /> New Quote
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {visible.map(r => (
                            <button
                                key={r.q.id}
                                onClick={() => openQuote(r.q)}
                                className="text-left bg-slate-900 border border-slate-800 hover:border-cyan-500/40 rounded-2xl p-4 transition-all active:scale-[0.99]"
                            >
                                <div className="flex justify-between items-start gap-2 mb-2">
                                    <div>
                                        <div className="font-mono text-xs text-slate-500">{r.number}</div>
                                        <div className="font-bold text-white">{r.customer}</div>
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-lg border whitespace-nowrap ${QUOTATION_STATUS_STYLE[r.status]}`}>
                                        {QUOTATION_STATUS_LABEL[r.status]}
                                    </span>
                                </div>
                                <div className="text-sm text-slate-400 flex items-center gap-1.5">
                                    <Car size={14} /> <span className="font-bold text-slate-300">{r.plate}</span> {r.vehicle}
                                </div>
                                {r.q.description && <div className="text-xs text-slate-500 mt-1 line-clamp-1">{r.q.description}</div>}
                                <div className="flex justify-between items-end mt-3">
                                    <div className="text-[11px] text-slate-500">
                                        {fmtDate(r.q.created_at)}
                                        {r.q.valid_until && <> · valid to {fmtDate(r.q.valid_until)}</>}
                                    </div>
                                    <div className="font-mono font-bold text-cyan-400">{lkr(r.q.total_amount_lkr)}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {(editorOpen || deepLinked) && (
                <QuotationEditor
                    key={(deepLinked ?? editing)?.id || 'new'}
                    quote={deepLinked ?? editing}
                    tenant={tenant}
                    today={today}
                    onClose={closeEditor}
                    onSaved={(q) => { setEditing(q); refresh(); }}
                    onDeleted={() => { closeEditor(); refresh(); }}
                    onConverted={(jobId) => {
                        closeEditor();
                        refresh();
                        queryClient.invalidateQueries({ queryKey: ['jobs'] });
                        navigate('/jobs', { state: { openJobId: jobId } });
                    }}
                    toast={toast}
                    confirm={confirm}
                />
            )}
        </div>
    );
};

interface EditorProps {
    quote: QuoteRow | null;
    tenant: QuotationPdfTenant | null | undefined;
    today: string;
    onClose: () => void;
    onSaved: (q: QuoteRow) => void;
    onDeleted: () => void;
    onConverted: (jobId: string) => void;
    toast: ReturnType<typeof useToast>['toast'];
    confirm: ReturnType<typeof useConfirm>;
}

const toPartLines = (rows: QuotationPartRow[] = []): PartLine[] => bySortOrder(rows)
    .map(p => ({
        key: newKey(),
        id: p.id,
        part_id: p.part_id ?? null,
        is_custom: !!p.is_custom || !p.part_id,
        custom_name: p.custom_name || p.parts?.name || '',
        quantity: Number(p.quantity) || 1,
        price_at_time_lkr: Number(p.price_at_time_lkr) || 0,
        cost_at_time_lkr: Number(p.cost_at_time_lkr) || 0,
        discount_type: p.discount_type === 'percent' ? 'percent' : 'amount',
        discount_value: Number(p.discount_value) || 0,
    }));

const toLaborLines = (rows: QuotationLaborRow[] = []): LaborLine[] => bySortOrder(rows)
    .map(l => ({
        key: newKey(),
        id: l.id,
        description: l.description || '',
        is_fixed: !!l.is_fixed,
        quantity: Number(l.quantity) || 1,
        hours: Number(l.hours) || 1,
        hourly_rate_lkr: Number(l.hourly_rate_lkr) || 0,
        discount_type: l.discount_type === 'percent' ? 'percent' : 'amount',
        discount_value: Number(l.discount_value) || 0,
    }));

const QuotationEditor = ({ quote, tenant, today, onClose, onSaved, onDeleted, onConverted, toast, confirm }: EditorProps) => {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const tenantId = profile?.tenant_id;

    const [current, setCurrent] = useState<QuoteRow | null>(quote);
    const status: QuotationStatus = current ? effectiveQuotationStatus(current.status, current.valid_until, today) : 'draft';
    const locked = status === 'converted';

    const [vehicleId, setVehicleId] = useState(quote?.vehicle_id || '');
    const [vehicleLabel, setVehicleLabel] = useState(() => {
        const v = quote?.vehicles;
        return v ? `${v.license_plate} - ${v.make} ${v.model} (${v.customers?.name || ''})` : '';
    });
    const [vehicleSearch, setVehicleSearch] = useState('');
    const [showVehicleResults, setShowVehicleResults] = useState(false);
    const [intakeMode, setIntakeMode] = useState<'SELECT' | 'EXPRESS'>('SELECT');
    const [walkIn, setWalkIn] = useState({ title: 'Mr.', name: '', phone: '', make: '', model: '', plate: '' });

    const [description, setDescription] = useState(quote?.description || '');
    const [notes, setNotes] = useState(quote?.notes || '');
    const [validUntil, setValidUntil] = useState(quote?.valid_until || addDaysISO(today, 14));
    const [discountType, setDiscountType] = useState<DiscountType>(quote?.discount_type || 'amount');
    const [discountValue, setDiscountValue] = useState(String(quote?.discount_value || ''));
    const [partLines, setPartLines] = useState<PartLine[]>(() => toPartLines(quote?.quotation_parts));
    const [laborLines, setLaborLines] = useState<LaborLine[]>(() => toLaborLines(quote?.quotation_labor));
    const [busy, setBusy] = useState<string | null>(null);
    const [dirty, setDirty] = useState(!quote);

    // New-line forms (same fields as the job card's add part / add labour)
    const [partMode, setPartMode] = useState<'inventory' | 'custom'>('custom');
    const [partForm, setPartForm] = useState({ part_id: '', custom_name: '', quantity: '1', price: '', cost: '' });
    const [laborMode, setLaborMode] = useState<'hourly' | 'fixed'>('fixed');
    const [laborForm, setLaborForm] = useState({ description: '', quantity: '1', hours: '1', rate: '5000', amount: '' });

    const { data: vehicles = [] } = useQuery({
        queryKey: ['vehicles'],
        queryFn: async () => {
            const { data } = await supabase.from('vehicles').select('*, customers(title, name)');
            return (data as Vehicle[]) || [];
        },
    });

    const { data: inventory = [] } = useQuery({
        queryKey: ['quote-inventory'],
        queryFn: async () => {
            const { data } = await supabase.from('parts').select('id, name, part_number, price_lkr, cost_lkr, stock_quantity').order('name');
            return (data as Part[]) || [];
        },
    });

    const [partsMemory, setPartsMemory] = useState<PartMemoryItem[]>(() => loadPartsMemory(tenantId));
    const [laborMemory, setLaborMemory] = useState<LaborMemoryItem[]>(() => loadLaborMemory(tenantId));
    useEffect(() => {
        let alive = true;
        syncItemMemoryFromDb(tenantId, inventory).then(({ parts, labor }) => {
            if (alive) { setPartsMemory(parts); setLaborMemory(labor); }
        });
        return () => { alive = false; };
    }, [tenantId, inventory]);

    const partSuggestions: SuggestionItem[] = useMemo(() => getPartSuggestions(partForm.custom_name, partsMemory, 7).map(item => ({
        title: item.name,
        subtitle: item.cost > 0 ? `Cost: LKR ${item.cost.toLocaleString()}` : undefined,
        badge: item.price > 0 ? `LKR ${item.price.toLocaleString()}` : undefined,
        badgeColor: 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/50',
        count: item.count,
        raw: item,
    })), [partForm.custom_name, partsMemory]);

    const laborSuggestions: SuggestionItem[] = useMemo(() => getLaborSuggestions(laborForm.description, laborMemory, 7).map(item => ({
        title: item.description,
        subtitle: item.isFixed ? 'Fixed price service' : `${item.hours}h @ LKR ${item.hourlyRate.toLocaleString()}/hr`,
        badge: item.isFixed ? `Fixed LKR ${(item.fixedAmount || item.hourlyRate).toLocaleString()}` : `${item.hours}h @ LKR ${item.hourlyRate.toLocaleString()}`,
        badgeColor: item.isFixed ? 'bg-amber-950/70 text-amber-300 border border-amber-800/50' : 'bg-cyan-950/70 text-cyan-300 border border-cyan-800/50',
        count: item.count,
        raw: item,
    })), [laborForm.description, laborMemory]);

    const summary = calcQuotationSummary(partLines, laborLines, { type: discountType, value: discountValue });

    const touch = () => setDirty(true);

    const addPart = () => {
        if (partMode === 'inventory') {
            const p = inventory.find(i => i.id === partForm.part_id);
            if (!p) return toast('Pick a part from inventory.', 'warning');
            const qty = Math.max(1, parseInt(partForm.quantity, 10) || 1);
            if (qty > (p.stock_quantity ?? 0)) toast(`Only ${p.stock_quantity} in stock — fine for a quote; it becomes a custom line if still short when converted.`, 'info');
            setPartLines(prev => [...prev, {
                key: newKey(), part_id: p.id, is_custom: false, custom_name: p.name, quantity: qty,
                price_at_time_lkr: partForm.price !== '' ? Number(partForm.price) || 0 : Number(p.price_lkr) || 0,
                cost_at_time_lkr: Number(p.cost_lkr) || 0, discount_type: 'amount', discount_value: 0,
            }]);
        } else {
            if (!partForm.custom_name.trim()) return toast('Enter the part name.', 'warning');
            const qty = Math.max(0, Number(partForm.quantity) || 1);
            setPartLines(prev => [...prev, {
                key: newKey(), part_id: null, is_custom: true, custom_name: partForm.custom_name.trim(), quantity: qty,
                price_at_time_lkr: Number(partForm.price) || 0, cost_at_time_lkr: Number(partForm.cost) || 0,
                discount_type: 'amount', discount_value: 0,
            }]);
        }
        setPartForm({ part_id: '', custom_name: '', quantity: '1', price: '', cost: '' });
        touch();
    };

    const addLabor = () => {
        if (!laborForm.description.trim()) return toast('Enter the labour description.', 'warning');
        const isFixed = laborMode === 'fixed';
        const amount = Number(laborForm.amount);
        if (isFixed && !(amount > 0)) return toast('Enter a valid fixed amount.', 'warning');
        const hours = isFixed ? 1 : Number(laborForm.hours);
        const rate = isFixed ? amount : Number(laborForm.rate);
        if (!isFixed && (!(hours > 0) || !(rate >= 0))) return toast('Enter valid hours and rate.', 'warning');
        setLaborLines(prev => [...prev, {
            key: newKey(), description: laborForm.description.trim(), is_fixed: isFixed,
            quantity: Math.max(1, parseInt(laborForm.quantity, 10) || 1), hours, hourly_rate_lkr: rate,
            discount_type: 'amount', discount_value: 0,
        }]);
        setLaborForm(prev => ({ ...prev, description: '', quantity: '1', hours: '1', amount: '' }));
        touch();
    };

    const updatePart = (key: string, patch: Partial<PartLine>) => { setPartLines(prev => prev.map(l => l.key === key ? { ...l, ...patch } : l)); touch(); };
    const updateLabor = (key: string, patch: Partial<LaborLine>) => { setLaborLines(prev => prev.map(l => l.key === key ? { ...l, ...patch } : l)); touch(); };

    /** Walk-in: match an existing car by plate, else a customer by phone, and only create what is missing (same rule as Jobs). */
    const resolveWalkInVehicle = async (): Promise<string> => {
        const plate = walkIn.plate.toUpperCase().trim();
        if (!plate || !walkIn.name.trim()) throw new Error('Enter at least the customer name and plate.');
        const wantedPhone = toSriLankanMsisdn(walkIn.phone);
        const [{ data: customers }, { data: cars }] = await Promise.all([
            supabase.from('customers').select('id, name, phone'),
            supabase.from('vehicles').select('id, license_plate, customer_id'),
        ]);
        const carMatch = (cars || []).find(v => (v.license_plate || '').toUpperCase().replace(/\s+/g, '') === plate.replace(/\s+/g, ''));
        if (carMatch) { toast(`${plate} is already on file — quote added to that customer.`, 'info'); return carMatch.id; }
        const custMatch = wantedPhone ? (customers || []).find(c => toSriLankanMsisdn(c.phone || '') === wantedPhone) : undefined;
        let customerId = custMatch?.id;
        if (custMatch) toast(`Matched ${custMatch.name} by phone number — no duplicate created.`, 'info');
        if (!customerId) {
            const { data, error } = await supabase.from('customers')
                .insert([{ title: walkIn.title, name: tidyName(walkIn.name), phone: walkIn.phone, tenant_id: tenantId }])
                .select().single();
            if (error) throw error;
            customerId = data.id;
        }
        const { data: car, error: carErr } = await supabase.from('vehicles')
            .insert([{ customer_id: customerId, make: tidyName(walkIn.make), model: tidyName(walkIn.model), license_plate: plate, tenant_id: tenantId }])
            .select().single();
        if (carErr) throw carErr;
        return car.id;
    };

    const reload = async (id: string): Promise<QuoteRow | null> => {
        const { data } = await supabase.from('quotations')
            .select(`*, vehicles (id, make, model, year, license_plate, color, vin, customers (title, name, phone, address, email)),
                     quotation_parts (*, parts (name)), quotation_labor (*)`)
            .eq('id', id).single();
        return (data as QuoteRow) || null;
    };

    const save = async (extra: Record<string, unknown> = {}): Promise<QuoteRow | null> => {
        if (locked) return current;
        setBusy('save');
        try {
            let vid = vehicleId;
            if (!vid && intakeMode === 'EXPRESS') vid = await resolveWalkInVehicle();
            if (!vid) throw new Error('Select the customer’s vehicle first.');

            const payload: Record<string, unknown> = {
                vehicle_id: vid,
                description: description.trim() || null,
                notes: notes.trim() || null,
                valid_until: validUntil || null,
                discount_type: discountType,
                discount_value: Number(discountValue) || 0,
                total_amount_lkr: summary.totalAmount,
                ...extra,
            };

            let id = current?.id;
            if (id) {
                const { error } = await supabase.from('quotations').update(payload).eq('id', id);
                if (error) throw error;
            } else {
                const { data, error } = await supabase.from('quotations')
                    .insert([{ ...payload, tenant_id: tenantId, status: (extra.status as string) || 'draft' }])
                    .select('id').single();
                if (error) throw error;
                id = data.id as string;
            }

            // Lines: update what is kept, insert what is new, delete what was removed.
            const keptPartIds = partLines.filter(l => l.id).map(l => l.id as string);
            const keptLaborIds = laborLines.filter(l => l.id).map(l => l.id as string);
            const removedParts = (current?.quotation_parts || []).map(p => p.id as string).filter(pid => !keptPartIds.includes(pid));
            const removedLabor = (current?.quotation_labor || []).map(l => l.id as string).filter(lid => !keptLaborIds.includes(lid));
            if (removedParts.length) {
                const { error } = await supabase.from('quotation_parts').delete().in('id', removedParts);
                if (error) throw error;
            }
            if (removedLabor.length) {
                const { error } = await supabase.from('quotation_labor').delete().in('id', removedLabor);
                if (error) throw error;
            }
            const partRow = (l: PartLine, i: number) => ({
                quotation_id: id, part_id: l.part_id, is_custom: l.is_custom, custom_name: l.custom_name || null,
                quantity: l.quantity, price_at_time_lkr: l.price_at_time_lkr, cost_at_time_lkr: l.cost_at_time_lkr,
                discount_type: l.discount_type, discount_value: l.discount_value, sort_order: i,
            });
            const laborRow = (l: LaborLine, i: number) => ({
                quotation_id: id, description: l.description, is_fixed: l.is_fixed, quantity: l.quantity, hours: l.hours,
                hourly_rate_lkr: l.hourly_rate_lkr, discount_type: l.discount_type, discount_value: l.discount_value, sort_order: i,
            });
            for (const [i, l] of partLines.entries()) {
                if (!l.id) continue;
                const { error } = await supabase.from('quotation_parts').update(partRow(l, i)).eq('id', l.id);
                if (error) throw error;
            }
            for (const [i, l] of laborLines.entries()) {
                if (!l.id) continue;
                const { error } = await supabase.from('quotation_labor').update(laborRow(l, i)).eq('id', l.id);
                if (error) throw error;
            }
            const newParts = partLines.map((l, i) => [l, i] as const).filter(([l]) => !l.id).map(([l, i]) => partRow(l, i));
            const newLabor = laborLines.map((l, i) => [l, i] as const).filter(([l]) => !l.id).map(([l, i]) => laborRow(l, i));
            if (newParts.length) {
                const { error } = await supabase.from('quotation_parts').insert(newParts);
                if (error) throw error;
            }
            if (newLabor.length) {
                const { error } = await supabase.from('quotation_labor').insert(newLabor);
                if (error) throw error;
            }

            partLines.filter(l => l.is_custom && l.custom_name).forEach(l =>
                savePartToMemory({ name: l.custom_name, price: l.price_at_time_lkr, cost: l.cost_at_time_lkr }, tenantId));
            laborLines.forEach(l => saveLaborToMemory({
                description: l.description, isFixed: l.is_fixed, hours: l.hours, hourlyRate: l.hourly_rate_lkr,
                fixedAmount: l.is_fixed ? l.hourly_rate_lkr : 0,
            }, tenantId));

            if (!current && tenantId) logAudit(tenantId, profile?.id, 'quotation.created', 'quotation', id, { total: summary.totalAmount });

            const fresh = await reload(id as string);
            if (fresh) {
                setCurrent(fresh);
                setVehicleId(fresh.vehicle_id);
                const v = fresh.vehicles;
                if (v) setVehicleLabel(`${v.license_plate} - ${v.make} ${v.model} (${v.customers?.name || ''})`);
                setPartLines(toPartLines(fresh.quotation_parts));
                setLaborLines(toLaborLines(fresh.quotation_labor));
                setDirty(false);
                onSaved(fresh);
            }
            return fresh;
        } catch (e) {
            toast(errMsg(e, 'Could not save the quotation.'), 'error');
            return null;
        } finally {
            setBusy(null);
        }
    };

    const setStatus = async (next: QuotationStatus) => {
        const stamp: Record<string, unknown> = { status: next };
        if (next === 'sent') stamp.sent_at = new Date().toISOString();
        if (next === 'accepted') stamp.accepted_at = new Date().toISOString();
        const saved = await save(stamp);
        if (saved) toast(`Quotation marked ${QUOTATION_STATUS_LABEL[next].toLowerCase()}.`, 'success');
    };

    const pdfData = (q: QuoteRow) => {
        const s = calcQuotationSummary(q.quotation_parts || [], q.quotation_labor || [], { type: q.discount_type, value: q.discount_value });
        return {
            quoteNumber: quotationNumber(q.id),
            date: fmtDate(q.created_at),
            validUntil: fmtDate(q.valid_until),
            description: q.description,
            notes: q.notes,
            customerDetails: q.vehicles?.customers,
            vehicleDetails: q.vehicles,
            parts: bySortOrder(q.quotation_parts),
            labor: bySortOrder(q.quotation_labor),
            subtotal: s.grossSubtotal,
            discount: s.totalDiscount,
            linesDiscount: s.linesDiscount,
            jobDiscount: s.jobDiscountAmount,
            discountType: q.discount_type,
            discountValue: q.discount_value,
            total: s.totalAmount,
            rawDate: new Date(q.created_at),
        };
    };

    /** Unsaved edits are saved first, so the PDF always matches what is on file. */
    const ensureSaved = async (): Promise<QuoteRow | null> => (dirty || !current) ? save() : current;

    const withPdf = async (label: string, fn: (doc: jsPDF, filename: string, q: QuoteRow) => Promise<void> | void) => {
        const q = await ensureSaved();
        if (!q) return;
        setBusy(label);
        try {
            const { buildQuotationPdf } = await import('../lib/quotationPdf');
            const { doc, filename } = await buildQuotationPdf(pdfData(q), tenant);
            await fn(doc, filename, q);
        } catch (e) {
            toast('PDF failed: ' + errMsg(e, 'unknown error'), 'error');
        } finally {
            setBusy(null);
        }
    };

    const downloadPdf = () => withPdf('pdf', (doc, filename) => { doc.save(filename); });

    const printPdf = () => withPdf('print', (doc) => {
        const url = URL.createObjectURL(doc.output('blob'));
        const iframe = document.createElement('iframe');
        Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
        iframe.src = url;
        iframe.onload = () => setTimeout(() => {
            try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); }
            catch { window.open(url, '_blank')?.print(); }
            setTimeout(() => { document.body.removeChild(iframe); URL.revokeObjectURL(url); }, 60000);
        }, 300);
        document.body.appendChild(iframe);
    });

    const sharePdf = () => withPdf('share', async (doc, filename, q) => {
        const file = new File([doc.output('blob')], filename, { type: 'application/pdf' });
        const v = q.vehicles;
        const text = quotationMessage({
            quoteNumber: quotationNumber(q.id),
            vehicle: v ? `${v.make} ${v.model} (${v.license_plate})` : '',
            total: Number(q.total_amount_lkr) || 0,
            validUntil: fmtDate(q.valid_until),
            shopName: tenant?.name,
        });
        const result = await shareInvoice({ file, title: `Quotation ${quotationNumber(q.id)}`, text, phone: v?.customers?.phone });
        if (result === 'fallback') doc.save(filename);
        if (result !== 'cancelled' && q.status === 'draft') {
            await supabase.from('quotations').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', q.id);
            const fresh = await reload(q.id);
            if (fresh) { setCurrent(fresh); onSaved(fresh); }
            toast('Shared — quotation marked as sent.', 'success');
        }
    });

    const convert = async () => {
        const q = await ensureSaved();
        if (!q) return;
        if (!(q.quotation_parts?.length || q.quotation_labor?.length)) return toast('Add at least one part or labour line first.', 'warning');
        const ok = await confirm({
            title: 'Convert to job?',
            message: `This creates a new job for ${q.vehicles?.license_plate || 'this vehicle'} with the same parts and labour at the quoted prices, and marks the quote as accepted and converted. Inventory parts are taken from stock now, the same as adding them to a job.`,
            confirmLabel: 'Create job',
        });
        if (!ok) return;
        setBusy('convert');
        try {
            const { data: raw, error } = await supabase.rpc('convert_quotation_to_job', { p_quotation_id: q.id });
            if (error) throw error;
            const data = raw as { success?: boolean; message?: string; job_id?: string; out_of_stock?: string[] } | null;
            if (!data?.success) {
                toast(data?.message || 'Could not convert this quotation.', 'error');
                if (data?.job_id) onConverted(data.job_id);
                return;
            }
            const short: string[] = data.out_of_stock || [];
            if (tenantId) logAudit(tenantId, profile?.id, 'quotation.converted', 'quotation', q.id, { job_id: data.job_id });
            toast(short.length
                ? `Job created. Not enough stock for ${short.join(', ')} — added as custom lines; swap them for stock when it arrives.`
                : 'Job created from the quotation.', short.length ? 'warning' : 'success');
            if (data.job_id) onConverted(data.job_id);
        } catch (e) {
            toast(errMsg(e, 'Could not convert this quotation.'), 'error');
        } finally {
            setBusy(null);
        }
    };

    const remove = async () => {
        if (!current) return onClose();
        const ok = await confirm({ title: 'Delete quotation?', message: `${quotationNumber(current.id)} will be deleted. This cannot be undone.`, confirmLabel: 'Delete', confirmStyle: 'danger' });
        if (!ok) return;
        const { error } = await supabase.from('quotations').delete().eq('id', current.id);
        if (error) return toast(error.message, 'error');
        toast('Quotation deleted.', 'success');
        onDeleted();
    };

    const filteredVehicles = vehicleSearch
        ? vehicles.filter(v => [v.license_plate, v.make, v.model, v.customers?.name || '']
            .some(s => (s || '').toLowerCase().includes(vehicleSearch.toLowerCase()))).slice(0, 30)
        : [];

    const title = (
        <div className="flex items-center gap-2 flex-wrap">
            <span>{current ? quotationNumber(current.id) : 'New Quotation'}</span>
            {current && (
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-lg border ${QUOTATION_STATUS_STYLE[status]}`}>
                    {QUOTATION_STATUS_LABEL[status]}
                </span>
            )}
        </div>
    );

    const disabled = locked || !!busy;

    return (
        <Modal isOpen onClose={onClose} title={title} maxWidth="max-w-3xl">
            <div className="space-y-5 pb-2">
                {locked && current?.job_id && (
                    <div className="p-3 rounded-xl border border-cyan-500/30 bg-cyan-500/5 text-cyan-200 text-sm flex items-center justify-between gap-3">
                        <span>This quote became a job. Complete the job as usual to get the invoice.</span>
                        <button onClick={() => navigate('/jobs', { state: { openJobId: current.job_id } })}
                            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 text-xs font-bold">
                            <ExternalLink size={14} /> Open job
                        </button>
                    </div>
                )}

                {/* Customer & vehicle */}
                <section>
                    <div className={labelCls}>Customer &amp; vehicle</div>
                    {vehicleId ? (
                        <div className="flex items-center justify-between gap-2 bg-slate-900 border border-slate-800 rounded-xl p-3">
                            <div className="flex items-center gap-2 text-white text-sm min-w-0">
                                <Car size={16} className="text-cyan-400 shrink-0" />
                                <span className="truncate">{vehicleLabel}</span>
                            </div>
                            {!locked && (
                                <button onClick={() => { setVehicleId(''); setVehicleLabel(''); setVehicleSearch(''); touch(); }}
                                    className="text-xs text-slate-400 hover:text-white shrink-0">Change</button>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="flex bg-slate-950 p-1 rounded-xl mb-3 border border-slate-800">
                                {(['SELECT', 'EXPRESS'] as const).map(m => (
                                    <button key={m} type="button" onClick={() => setIntakeMode(m)}
                                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${intakeMode === m ? 'bg-brand text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                                        {m === 'SELECT' ? 'SMART SEARCH' : 'NEW CUSTOMER'}
                                    </button>
                                ))}
                            </div>
                            {intakeMode === 'SELECT' ? (
                                <div className="relative">
                                    <Search className="absolute left-3 top-3 text-slate-500" size={18} />
                                    <input type="text" placeholder="Search: Customer, Plate, or Model..." value={vehicleSearch}
                                        onChange={e => { setVehicleSearch(e.target.value); setShowVehicleResults(true); }}
                                        onFocus={() => setShowVehicleResults(true)}
                                        className={`${inputCls} pl-10`} />
                                    {showVehicleResults && vehicleSearch && (
                                        <div className="absolute z-20 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                            {filteredVehicles.map(v => (
                                                <div key={v.id}
                                                    onClick={() => { setVehicleId(v.id); setVehicleLabel(`${v.license_plate} - ${v.make} ${v.model} (${v.customers?.name || ''})`); setShowVehicleResults(false); touch(); }}
                                                    className="p-3 hover:bg-slate-700 cursor-pointer border-b border-slate-700/50 last:border-0">
                                                    <div className="flex justify-between items-start">
                                                        <div className="font-bold text-white text-sm">{v.license_plate}</div>
                                                        <div className="text-[10px] bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded font-bold uppercase">{withTitle(v.customers?.title, v.customers?.name)}</div>
                                                    </div>
                                                    <div className="text-xs text-slate-400">{v.make} {v.model}</div>
                                                </div>
                                            ))}
                                            {filteredVehicles.length === 0 && <div className="p-4 text-center text-slate-500 text-sm italic">No matching vehicles found</div>}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className={labelCls}>Customer name</label>
                                        <div className="flex gap-2">
                                            <select value={walkIn.title} onChange={e => setWalkIn({ ...walkIn, title: e.target.value })}
                                                className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-white text-sm focus:border-brand focus:outline-none">
                                                {CUSTOMER_TITLES.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                            <input className={inputCls} placeholder="Full name" value={walkIn.name} onChange={e => setWalkIn({ ...walkIn, name: e.target.value })} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelCls}>Phone</label>
                                        <input className={`${inputCls} font-mono`} placeholder="077..." value={walkIn.phone} onChange={e => setWalkIn({ ...walkIn, phone: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Plate</label>
                                        <input className={`${inputCls} uppercase font-mono`} placeholder="CAQ-0462" value={walkIn.plate} onChange={e => setWalkIn({ ...walkIn, plate: e.target.value })} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className={labelCls}>Make</label>
                                            <input className={inputCls} placeholder="Mazda" value={walkIn.make} onChange={e => setWalkIn({ ...walkIn, make: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className={labelCls}>Model</label>
                                            <input className={inputCls} placeholder="Axela" value={walkIn.model} onChange={e => setWalkIn({ ...walkIn, model: e.target.value })} />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </section>

                <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                        <label className={labelCls}>Work to quote</label>
                        <input className={inputCls} placeholder="e.g. Front suspension overhaul" value={description} disabled={locked}
                            onChange={e => { setDescription(e.target.value); touch(); }} />
                    </div>
                    <div>
                        <label className={labelCls}><CalendarClock size={10} className="inline mr-1" />Valid until</label>
                        <input type="date" className={inputCls} value={validUntil} disabled={locked}
                            onChange={e => { setValidUntil(e.target.value); touch(); }} />
                    </div>
                </section>

                {/* Labour */}
                <section className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3 sm:p-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-white mb-3"><Wrench size={16} className="text-cyan-400" /> Labour</div>
                    {laborLines.length === 0 && <div className="text-xs text-slate-500 italic mb-3">No labour lines yet.</div>}
                    <div className="space-y-2 mb-3">
                        {laborLines.map(l => {
                            const gross = Math.max(1, l.quantity) * l.hours * l.hourly_rate_lkr;
                            return (
                                <div key={l.key} className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                                    <div className="flex gap-2 items-start">
                                        <input className="flex-1 min-w-0 bg-transparent text-white text-sm font-medium focus:outline-none" value={l.description} disabled={locked}
                                            onChange={e => updateLabor(l.key, { description: e.target.value })} />
                                        <div className="font-mono text-sm text-white shrink-0">{(gross - calcDiscount(gross, l.discount_type, l.discount_value)).toLocaleString()}</div>
                                        {!locked && <button onClick={() => { setLaborLines(prev => prev.filter(x => x.key !== l.key)); touch(); }} className="text-slate-500 hover:text-red-400 shrink-0"><Trash2 size={15} /></button>}
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-2 text-xs text-slate-400 items-center">
                                        <label className="flex items-center gap-1">Qty
                                            <input type="number" min={1} className="w-14 bg-slate-950 border border-slate-800 rounded-lg px-1.5 py-1 text-white" value={l.quantity} disabled={locked}
                                                onChange={e => updateLabor(l.key, { quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })} />
                                        </label>
                                        {l.is_fixed ? (
                                            <label className="flex items-center gap-1">Fixed LKR
                                                <input type="number" min={0} className="w-24 bg-slate-950 border border-slate-800 rounded-lg px-1.5 py-1 text-white" value={l.hourly_rate_lkr} disabled={locked}
                                                    onChange={e => updateLabor(l.key, { hourly_rate_lkr: Number(e.target.value) || 0 })} />
                                            </label>
                                        ) : (
                                            <>
                                                <label className="flex items-center gap-1">Hours
                                                    <input type="number" min={0} step="0.25" className="w-16 bg-slate-950 border border-slate-800 rounded-lg px-1.5 py-1 text-white" value={l.hours} disabled={locked}
                                                        onChange={e => updateLabor(l.key, { hours: Number(e.target.value) || 0 })} />
                                                </label>
                                                <label className="flex items-center gap-1">Rate
                                                    <input type="number" min={0} className="w-24 bg-slate-950 border border-slate-800 rounded-lg px-1.5 py-1 text-white" value={l.hourly_rate_lkr} disabled={locked}
                                                        onChange={e => updateLabor(l.key, { hourly_rate_lkr: Number(e.target.value) || 0 })} />
                                                </label>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {!locked && (
                        <div className="border-t border-slate-800 pt-3 space-y-2">
                            <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800 w-fit">
                                {(['fixed', 'hourly'] as const).map(m => (
                                    <button key={m} type="button" onClick={() => setLaborMode(m)}
                                        className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${laborMode === m ? 'bg-cyan-600 text-white' : 'text-slate-500'}`}>
                                        {m === 'fixed' ? 'Fixed price' : 'Hourly'}
                                    </button>
                                ))}
                            </div>
                            <AutoSuggestInput
                                value={laborForm.description}
                                onChange={val => setLaborForm(prev => ({ ...prev, description: val }))}
                                onSelect={(item: LaborMemoryItem) => {
                                    setLaborForm(prev => ({
                                        ...prev,
                                        description: item.description,
                                        hours: item.isFixed ? '1' : String(item.hours),
                                        rate: item.hourlyRate > 0 ? String(item.hourlyRate) : prev.rate,
                                        amount: item.isFixed ? String(item.fixedAmount || item.hourlyRate) : prev.amount,
                                    }));
                                    setLaborMode(item.isFixed ? 'fixed' : 'hourly');
                                }}
                                suggestions={laborSuggestions}
                                placeholder="Labour description (e.g. Full service)"
                                inputClassName={inputCls}
                            />
                            <div className="flex gap-2 items-end flex-wrap">
                                <div className="w-16">
                                    <label className={labelCls}>Qty</label>
                                    <input type="number" min={1} className={inputCls} value={laborForm.quantity} onChange={e => setLaborForm({ ...laborForm, quantity: e.target.value })} />
                                </div>
                                {laborMode === 'fixed' ? (
                                    <div className="flex-1 min-w-[110px]">
                                        <label className={labelCls}>Amount (LKR)</label>
                                        <input type="number" min={0} className={inputCls} value={laborForm.amount} onChange={e => setLaborForm({ ...laborForm, amount: e.target.value })} />
                                    </div>
                                ) : (
                                    <>
                                        <div className="w-20">
                                            <label className={labelCls}>Hours</label>
                                            <input type="number" min={0} step="0.25" className={inputCls} value={laborForm.hours} onChange={e => setLaborForm({ ...laborForm, hours: e.target.value })} />
                                        </div>
                                        <div className="flex-1 min-w-[100px]">
                                            <label className={labelCls}>Rate / hr</label>
                                            <input type="number" min={0} className={inputCls} value={laborForm.rate} onChange={e => setLaborForm({ ...laborForm, rate: e.target.value })} />
                                        </div>
                                    </>
                                )}
                                <button type="button" onClick={addLabor} className="btn-brand px-4 py-2.5 rounded-xl text-sm font-bold inline-flex items-center gap-1"><Plus size={16} /> Add</button>
                            </div>
                        </div>
                    )}
                </section>

                {/* Parts */}
                <section className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3 sm:p-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-white mb-3"><Package size={16} className="text-cyan-400" /> Parts</div>
                    {partLines.length === 0 && <div className="text-xs text-slate-500 italic mb-3">No parts yet.</div>}
                    <div className="space-y-2 mb-3">
                        {partLines.map(l => {
                            const gross = l.quantity * l.price_at_time_lkr;
                            const stock = l.part_id ? inventory.find(i => i.id === l.part_id)?.stock_quantity : undefined;
                            return (
                                <div key={l.key} className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                                    <div className="flex gap-2 items-start">
                                        <div className="flex-1 min-w-0">
                                            {l.is_custom ? (
                                                <input className="w-full bg-transparent text-white text-sm font-medium focus:outline-none" value={l.custom_name} disabled={locked}
                                                    onChange={e => updatePart(l.key, { custom_name: e.target.value })} />
                                            ) : (
                                                <div className="text-white text-sm font-medium truncate">{l.custom_name}</div>
                                            )}
                                            <div className="text-[10px] text-slate-500 uppercase font-bold">
                                                {l.is_custom ? 'Custom' : `Inventory${stock !== undefined ? ` · ${stock} in stock` : ''}`}
                                            </div>
                                        </div>
                                        <div className="font-mono text-sm text-white shrink-0">{(gross - calcDiscount(gross, l.discount_type, l.discount_value)).toLocaleString()}</div>
                                        {!locked && <button onClick={() => { setPartLines(prev => prev.filter(x => x.key !== l.key)); touch(); }} className="text-slate-500 hover:text-red-400 shrink-0"><Trash2 size={15} /></button>}
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-2 text-xs text-slate-400 items-center">
                                        <label className="flex items-center gap-1">Qty
                                            <input type="number" min={0} step={l.is_custom ? 'any' : 1} className="w-16 bg-slate-950 border border-slate-800 rounded-lg px-1.5 py-1 text-white" value={l.quantity} disabled={locked}
                                                onChange={e => updatePart(l.key, { quantity: l.is_custom ? Math.max(0, Number(e.target.value) || 0) : Math.max(1, parseInt(e.target.value, 10) || 1) })} />
                                        </label>
                                        <label className="flex items-center gap-1">Price
                                            <input type="number" min={0} className="w-24 bg-slate-950 border border-slate-800 rounded-lg px-1.5 py-1 text-white" value={l.price_at_time_lkr} disabled={locked}
                                                onChange={e => updatePart(l.key, { price_at_time_lkr: Number(e.target.value) || 0 })} />
                                        </label>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {!locked && (
                        <div className="border-t border-slate-800 pt-3 space-y-2">
                            <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800 w-fit">
                                {(['custom', 'inventory'] as const).map(m => (
                                    <button key={m} type="button" onClick={() => setPartMode(m)}
                                        className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${partMode === m ? 'bg-cyan-600 text-white' : 'text-slate-500'}`}>
                                        {m === 'custom' ? 'Custom' : 'Inventory'}
                                    </button>
                                ))}
                            </div>
                            {partMode === 'inventory' ? (
                                <select className={inputCls} value={partForm.part_id}
                                    onChange={e => {
                                        const p = inventory.find(i => i.id === e.target.value);
                                        setPartForm({ ...partForm, part_id: e.target.value, price: p ? String(p.price_lkr ?? '') : '' });
                                    }}>
                                    <option value="">Select part…</option>
                                    {inventory.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} — LKR {Number(p.price_lkr || 0).toLocaleString()} ({p.stock_quantity} in stock)</option>
                                    ))}
                                </select>
                            ) : (
                                <AutoSuggestInput
                                    value={partForm.custom_name}
                                    onChange={val => setPartForm(prev => ({ ...prev, custom_name: val }))}
                                    onSelect={(item: PartMemoryItem) => setPartForm(prev => ({
                                        ...prev,
                                        custom_name: item.name,
                                        price: item.price > 0 ? String(item.price) : prev.price,
                                        cost: item.cost > 0 ? String(item.cost) : prev.cost,
                                    }))}
                                    suggestions={partSuggestions}
                                    placeholder="Part name (e.g. Oil filter)"
                                    inputClassName={inputCls}
                                />
                            )}
                            <div className="flex gap-2 items-end flex-wrap">
                                <div className="w-16">
                                    <label className={labelCls}>Qty</label>
                                    <input type="number" min={1} className={inputCls} value={partForm.quantity} onChange={e => setPartForm({ ...partForm, quantity: e.target.value })} />
                                </div>
                                <div className="flex-1 min-w-[100px]">
                                    <label className={labelCls}>Price (LKR)</label>
                                    <input type="number" min={0} className={inputCls} value={partForm.price} onChange={e => setPartForm({ ...partForm, price: e.target.value })} />
                                </div>
                                {partMode === 'custom' && (
                                    <div className="flex-1 min-w-[100px]">
                                        <label className={labelCls}>Cost (optional)</label>
                                        <input type="number" min={0} className={inputCls} value={partForm.cost} onChange={e => setPartForm({ ...partForm, cost: e.target.value })} />
                                    </div>
                                )}
                                <button type="button" onClick={addPart} className="btn-brand px-4 py-2.5 rounded-xl text-sm font-bold inline-flex items-center gap-1"><Plus size={16} /> Add</button>
                            </div>
                        </div>
                    )}
                </section>

                {/* Notes + totals */}
                <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>Notes for the customer</label>
                        <textarea rows={4} className={inputCls} placeholder="e.g. Parts are genuine Mazda; 2 working days once approved." value={notes} disabled={locked}
                            onChange={e => { setNotes(e.target.value); touch(); }} />
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2 text-sm">
                        <div className="flex justify-between text-slate-400"><span>Labour</span><span className="font-mono">{summary.grossLabor.toLocaleString()}</span></div>
                        <div className="flex justify-between text-slate-400"><span>Parts</span><span className="font-mono">{summary.grossParts.toLocaleString()}</span></div>
                        <div className="flex justify-between items-center gap-2 text-slate-400">
                            <span>Discount</span>
                            <div className="flex gap-1 items-center">
                                <select className="bg-slate-950 border border-slate-800 rounded-lg px-1 py-1 text-white text-xs" value={discountType} disabled={locked}
                                    onChange={e => { setDiscountType(e.target.value as DiscountType); touch(); }}>
                                    <option value="amount">LKR</option>
                                    <option value="percent">%</option>
                                </select>
                                <input type="number" min={0} className="w-20 bg-slate-950 border border-slate-800 rounded-lg px-1.5 py-1 text-white text-right text-xs" value={discountValue} disabled={locked}
                                    placeholder="0" onChange={e => { setDiscountValue(e.target.value); touch(); }} />
                            </div>
                        </div>
                        {summary.totalDiscount > 0 && (
                            <div className="flex justify-between text-emerald-400"><span>You save</span><span className="font-mono">- {summary.totalDiscount.toLocaleString()}</span></div>
                        )}
                        <div className="flex justify-between items-baseline border-t border-slate-800 pt-2">
                            <span className="font-bold text-white">Estimated total</span>
                            <span className="font-mono font-black text-xl text-cyan-400">{lkr(summary.totalAmount)}</span>
                        </div>
                    </div>
                </section>

                {/* Actions */}
                <section className="space-y-3 pt-1">
                    <div className="grid grid-cols-3 gap-2">
                        <button onClick={downloadPdf} disabled={!!busy} className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold disabled:opacity-50">
                            <Download size={18} /> {busy === 'pdf' ? 'Preparing…' : 'PDF'}
                        </button>
                        <button onClick={printPdf} disabled={!!busy} className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold disabled:opacity-50">
                            <Printer size={18} /> {busy === 'print' ? 'Preparing…' : 'Print'}
                        </button>
                        <button onClick={sharePdf} disabled={!!busy} className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-bold disabled:opacity-50">
                            <MessageCircle size={18} /> {busy === 'share' ? 'Preparing…' : 'WhatsApp'}
                        </button>
                    </div>

                    {!locked && (
                        <div className="flex flex-wrap gap-2">
                            {current && status !== 'sent' && status !== 'accepted' && (
                                <button onClick={() => setStatus('sent')} disabled={disabled} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-300 text-xs font-bold disabled:opacity-50">
                                    <Send size={14} /> Mark sent
                                </button>
                            )}
                            {current && status !== 'accepted' && (
                                <button onClick={() => setStatus('accepted')} disabled={disabled} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-bold disabled:opacity-50">
                                    <CheckCircle size={14} /> Customer accepted
                                </button>
                            )}
                            {current && status !== 'declined' && (
                                <button onClick={() => setStatus('declined')} disabled={disabled} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-xs font-bold disabled:opacity-50">
                                    <XCircle size={14} /> Declined
                                </button>
                            )}
                            {current && (status === 'declined' || status === 'expired') && (
                                <button onClick={() => { if (validUntil < today) setValidUntil(addDaysISO(today, 14)); setStatus('draft'); }} disabled={disabled}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-600 bg-slate-800 text-slate-300 text-xs font-bold disabled:opacity-50">
                                    <RefreshCcw size={14} /> Reopen
                                </button>
                            )}
                            {current && <button onClick={remove} disabled={!!busy} className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-500 hover:text-red-400 text-xs font-bold"><Trash2 size={14} /> Delete</button>}
                        </div>
                    )}

                    {!locked && (
                        <div className="flex flex-col sm:flex-row gap-2">
                            <button onClick={() => save()} disabled={disabled || (!dirty && !!current)}
                                className="flex-1 inline-flex justify-center items-center gap-2 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm disabled:opacity-50">
                                <Save size={16} /> {busy === 'save' ? 'Saving…' : current ? (dirty ? 'Save changes' : 'Saved') : 'Save quote'}
                            </button>
                            {canConvertQuotation(status, current?.job_id) && (
                                <button onClick={convert} disabled={disabled}
                                    className="flex-1 inline-flex justify-center items-center gap-2 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 font-black text-sm disabled:opacity-50">
                                    <ArrowRightCircle size={18} /> {busy === 'convert' ? 'Creating job…' : status === 'accepted' ? 'Convert to job' : 'Accept & convert to job'}
                                </button>
                            )}
                        </div>
                    )}
                </section>
            </div>
        </Modal>
    );
};
