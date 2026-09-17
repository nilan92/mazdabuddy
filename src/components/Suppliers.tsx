import { useState, useMemo } from 'react';
import { 
    Plus, Search, Phone, Edit2, Trash2, Mail, History, 
    Calendar, RefreshCcw, Download, Truck, 
    FileText, CheckCircle2, AlertCircle, MapPin, 
    Clock
} from 'lucide-react';
import { downloadCSV } from '../lib/csv';
import { supabase } from '../lib/supabase';
import { Modal } from './Modal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { waMeUrl } from '../lib/whatsapp';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Supplier } from '../types';

interface SupplierBill {
    id: string;
    date: string;
    amount_lkr: number;
    category: string;
    description: string | null;
    supplier: string | null;
    paid: boolean;
    paid_on: string | null;
    due_date: string | null;
    payment_method: string | null;
}

export const Suppliers = () => {
    const { profile } = useAuth();
    const { toast } = useToast();
    const confirm = useConfirm();
    const queryClient = useQueryClient();

    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'unpaid' | 'settled'>('all');

    // Modals
    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    const [isBillModalOpen, setIsBillModalOpen] = useState(false);
    const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);

    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [statementSearch, setStatementSearch] = useState('');

    // Supplier Form
    const [supplierForm, setSupplierForm] = useState({
        name: '',
        contact_person: '',
        phone: '',
        email: '',
        address: '',
        payment_terms: 'Net 30',
        notes: ''
    });

    // Quick Bill Form
    const [billForm, setBillForm] = useState({
        amount_lkr: '',
        date: new Date().toISOString().split('T')[0],
        category: 'Parts purchases',
        reference: '',
        paid: false,
        paid_via: 'bank',
        due_date: ''
    });

    // 1. Fetch Suppliers
    const { data: suppliers = [], isLoading: suppliersLoading } = useQuery({
        queryKey: ['suppliers'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('suppliers')
                .select('*')
                .order('name', { ascending: true });
            if (error) throw error;
            return data as Supplier[];
        }
    });

    // 2. Fetch Supplier Bills from user_expenses (the finance single source of truth)
    const { data: rawBills = [], isLoading: billsLoading } = useQuery({
        queryKey: ['supplier_bills'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('user_expenses')
                .select('id, date, amount_lkr, category, description, supplier, paid, paid_on, due_date, payment_method')
                .eq('is_income', false)
                .not('supplier', 'is', null)
                .order('date', { ascending: false });
            if (error) throw error;
            return (data || []) as SupplierBill[];
        }
    });

    const refreshData = () => {
        queryClient.invalidateQueries({ queryKey: ['suppliers'] });
        queryClient.invalidateQueries({ queryKey: ['supplier_bills'] });
        queryClient.invalidateQueries({ queryKey: ['finances'] });
    };

    // Calculate per-supplier totals
    const supplierStats = useMemo(() => {
        const stats: Record<string, { total: number; outstanding: number; count: number; bills: SupplierBill[] }> = {};
        for (const bill of rawBills) {
            const name = (bill.supplier || '').trim().toLowerCase();
            if (!name) continue;
            if (!stats[name]) {
                stats[name] = { total: 0, outstanding: 0, count: 0, bills: [] };
            }
            const amt = Number(bill.amount_lkr) || 0;
            stats[name].total += amt;
            if (!bill.paid) {
                stats[name].outstanding += amt;
            }
            stats[name].count += 1;
            stats[name].bills.push(bill);
        }
        return stats;
    }, [rawBills]);

    // KPI Summary
    const totalPurchases = useMemo(() => rawBills.reduce((sum, b) => sum + (Number(b.amount_lkr) || 0), 0), [rawBills]);
    const totalOutstanding = useMemo(() => rawBills.filter(b => !b.paid).reduce((sum, b) => sum + (Number(b.amount_lkr) || 0), 0), [rawBills]);
    const totalPaid = totalPurchases - totalOutstanding;

    // Filter suppliers
    const filteredSuppliers = useMemo(() => {
        return suppliers.filter(s => {
            const name = (s.name || '').toLowerCase();
            const contact = (s.contact_person || '').toLowerCase();
            const phone = (s.phone || '');
            const q = searchTerm.toLowerCase();

            const matchesSearch = name.includes(q) || contact.includes(q) || phone.includes(q);
            if (!matchesSearch) return false;

            const stat = supplierStats[name] || { total: 0, outstanding: 0, count: 0 };
            if (filterStatus === 'unpaid') return stat.outstanding > 0;
            if (filterStatus === 'settled') return stat.total > 0 && stat.outstanding === 0;
            return true;
        });
    }, [suppliers, searchTerm, filterStatus, supplierStats]);

    // Save Supplier
    const handleSaveSupplier = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!supplierForm.name.trim()) {
            toast('Supplier name is required.', 'error');
            return;
        }

        try {
            if (editingSupplier) {
                const { error } = await supabase
                    .from('suppliers')
                    .update({
                        name: supplierForm.name.trim(),
                        contact_person: supplierForm.contact_person.trim() || null,
                        phone: supplierForm.phone.trim() || null,
                        email: supplierForm.email.trim() || null,
                        address: supplierForm.address.trim() || null,
                        payment_terms: supplierForm.payment_terms || 'Net 30',
                        notes: supplierForm.notes.trim() || null
                    })
                    .eq('id', editingSupplier.id);
                if (error) throw error;
                toast('Supplier updated successfully.', 'success');
            } else {
                const { error } = await supabase
                    .from('suppliers')
                    .insert({
                        tenant_id: profile?.tenant_id,
                        name: supplierForm.name.trim(),
                        contact_person: supplierForm.contact_person.trim() || null,
                        phone: supplierForm.phone.trim() || null,
                        email: supplierForm.email.trim() || null,
                        address: supplierForm.address.trim() || null,
                        payment_terms: supplierForm.payment_terms || 'Net 30',
                        notes: supplierForm.notes.trim() || null
                    });
                if (error) throw error;
                toast('Supplier created successfully.', 'success');
            }
            setIsSupplierModalOpen(false);
            refreshData();
        } catch (error: any) {
            toast(error.message, 'error');
        }
    };

    // Delete Supplier
    const handleDeleteSupplier = async (supplier: Supplier) => {
        const ok = await confirm({
            title: `Delete ${supplier.name}?`,
            message: 'This removes the vendor profile from the directory. Past bills in Finance will remain intact.',
            confirmLabel: 'Delete',
            confirmStyle: 'danger'
        });
        if (!ok) return;

        const { error } = await supabase.from('suppliers').delete().eq('id', supplier.id);
        if (error) toast(error.message, 'error');
        else {
            toast('Supplier deleted.', 'info');
            refreshData();
        }
    };

    // Record Bill for Supplier
    const handleRecordBill = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSupplier) return;
        const amt = parseFloat(billForm.amount_lkr);
        if (isNaN(amt) || amt <= 0) {
            toast('Please enter a valid bill amount.', 'error');
            return;
        }

        try {
            const { error } = await supabase
                .from('user_expenses')
                .insert({
                    tenant_id: profile?.tenant_id,
                    created_by: profile?.id,
                    supplier: selectedSupplier.name,
                    amount_lkr: amt,
                    category: billForm.category || 'Parts purchases',
                    description: billForm.reference ? `Bill ${billForm.reference}` : 'Supplier purchase',
                    date: billForm.date,
                    paid: billForm.paid,
                    paid_on: billForm.paid ? billForm.date : null,
                    payment_method: billForm.paid ? billForm.paid_via : null,
                    due_date: !billForm.paid && billForm.due_date ? billForm.due_date : null,
                    is_income: false
                });

            if (error) throw error;
            toast(`Bill of LKR ${amt.toLocaleString()} recorded for ${selectedSupplier.name}.`, 'success');
            setIsBillModalOpen(false);
            setBillForm({
                amount_lkr: '',
                date: new Date().toISOString().split('T')[0],
                category: 'Parts purchases',
                reference: '',
                paid: false,
                paid_via: 'bank',
                due_date: ''
            });
            refreshData();
        } catch (error: any) {
            toast('Error recording bill: ' + error.message, 'error');
        }
    };

    // Settle Bill (Mark as Paid)
    const handleMarkBillPaid = async (billId: string, amount: number) => {
        const ok = await confirm({
            title: 'Settle Bill Payment',
            message: `Mark bill of LKR ${amount.toLocaleString()} as paid today? This records payment in your finance cashbook.`,
            confirmLabel: 'Mark as Paid',
            confirmStyle: 'default'
        });
        if (!ok) return;

        const today = new Date().toISOString().split('T')[0];
        const { error } = await supabase
            .from('user_expenses')
            .update({
                paid: true,
                paid_on: today,
                payment_method: 'bank'
            })
            .eq('id', billId);

        if (error) toast(error.message, 'error');
        else {
            toast('Bill marked as settled.', 'success');
            refreshData();
        }
    };

    // WhatsApp supplier
    const handleWhatsApp = (supplier: Supplier) => {
        if (!supplier.phone) {
            toast(`No phone number recorded for ${supplier.name}.`, 'warning');
            return;
        }
        const msg = `Hello ${supplier.contact_person || supplier.name}, this is ${profile?.tenants?.name || 'AutoPulse Workshop'}. Inquiring regarding parts and orders.`;
        window.open(waMeUrl(supplier.phone, msg), '_blank', 'noopener');
    };

    // Statement bills for selected supplier
    const currentSupplierBills = useMemo(() => {
        if (!selectedSupplier) return [];
        const name = selectedSupplier.name.toLowerCase();
        const bills = supplierStats[name]?.bills || [];
        if (!statementSearch.trim()) return bills;
        const q = statementSearch.toLowerCase();
        return bills.filter(b => 
            (b.description || '').toLowerCase().includes(q) ||
            (b.category || '').toLowerCase().includes(q) ||
            b.date.includes(q) ||
            b.amount_lkr.toString().includes(q)
        );
    }, [selectedSupplier, supplierStats, statementSearch]);

    return (
        <div className="p-2 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Suppliers</h1>
                    <p className="text-slate-400">Manage parts vendors, purchases, and payables connected to Finance.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => downloadCSV('suppliers', suppliers.map((s: any) => {
                            const stat = supplierStats[s.name.toLowerCase()] || { total: 0, outstanding: 0, count: 0 };
                            return {
                                Name: s.name,
                                Contact: s.contact_person || '',
                                Phone: s.phone || '',
                                Email: s.email || '',
                                TotalPurchases: stat.total,
                                OutstandingPayable: stat.outstanding,
                                Terms: s.payment_terms || ''
                            };
                        }))}
                        className="p-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors"
                        title="Export CSV"
                    >
                        <Download size={18} />
                    </button>
                    <button
                        onClick={refreshData}
                        className="p-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors"
                        title="Refresh Data"
                    >
                        <RefreshCcw size={18} className={suppliersLoading || billsLoading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={() => {
                            setEditingSupplier(null);
                            setSupplierForm({
                                name: '',
                                contact_person: '',
                                phone: '',
                                email: '',
                                address: '',
                                payment_terms: 'Net 30',
                                notes: ''
                            });
                            setIsSupplierModalOpen(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl transition-colors shadow-lg shadow-cyan-500/20"
                    >
                        <Plus size={18} />
                        <span>Add Supplier</span>
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Vendors</span>
                        <div className="p-2 bg-cyan-500/10 rounded-xl text-cyan-400">
                            <Truck size={18} />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-white">{suppliers.length}</div>
                    <div className="text-xs text-slate-400 mt-1">{rawBills.length} recorded purchases</div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Purchases</span>
                        <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400">
                            <FileText size={18} />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-white">LKR {totalPurchases.toLocaleString()}</div>
                    <div className="text-xs text-slate-400 mt-1">Lifetime parts & stock bills</div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-rose-400">Outstanding Owed</span>
                        <div className="p-2 bg-rose-500/10 rounded-xl text-rose-400">
                            <AlertCircle size={18} />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-rose-400">LKR {totalOutstanding.toLocaleString()}</div>
                    <div className="text-xs text-slate-400 mt-1">Accounts payable due to vendors</div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Settled Bills</span>
                        <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
                            <CheckCircle2 size={18} />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-emerald-400">LKR {totalPaid.toLocaleString()}</div>
                    <div className="text-xs text-slate-400 mt-1">Cleared and paid in full</div>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3.5 top-3 text-slate-500" size={16} />
                    <input
                        type="text"
                        placeholder="Search vendor name, contact, phone..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                </div>

                <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-xl w-full sm:w-auto">
                    {(['all', 'unpaid', 'settled'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setFilterStatus(tab)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                                filterStatus === tab
                                    ? 'bg-cyan-500/20 text-cyan-400'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            {tab === 'all' ? 'All Vendors' : tab === 'unpaid' ? 'Has Balance' : 'Settled'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Supplier Directory Cards */}
            {suppliersLoading ? (
                <div className="py-16 text-center text-slate-500 text-sm">Loading supplier directory...</div>
            ) : filteredSuppliers.length === 0 ? (
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center">
                    <Truck size={40} className="mx-auto text-slate-600 mb-3" />
                    <h3 className="text-lg font-bold text-white mb-1">No suppliers found</h3>
                    <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
                        {searchTerm ? `No vendor matching "${searchTerm}".` : 'Add your parts suppliers to track invoices, bills, and outstanding payables.'}
                    </p>
                    <button
                        onClick={() => {
                            setEditingSupplier(null);
                            setSupplierForm({
                                name: '',
                                contact_person: '',
                                phone: '',
                                email: '',
                                address: '',
                                payment_terms: 'Net 30',
                                notes: ''
                            });
                            setIsSupplierModalOpen(true);
                        }}
                        className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-sm transition-colors"
                    >
                        Add First Supplier
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredSuppliers.map(supplier => {
                        const stat = supplierStats[supplier.name.toLowerCase()] || { total: 0, outstanding: 0, count: 0, bills: [] };
                        const hasOwed = stat.outstanding > 0;

                        return (
                            <div
                                key={supplier.id}
                                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 transition-all flex flex-col justify-between"
                            >
                                <div>
                                    {/* Vendor Top */}
                                    <div className="flex items-start justify-between gap-3 mb-4">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white font-black text-lg shrink-0 shadow-lg shadow-cyan-500/10">
                                                {supplier.name[0].toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="text-base font-bold text-white truncate" title={supplier.name}>
                                                    {supplier.name}
                                                </h3>
                                                {supplier.contact_person && (
                                                    <p className="text-xs text-slate-400 truncate">{supplier.contact_person}</p>
                                                )}
                                            </div>
                                        </div>

                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/50 shrink-0">
                                            {supplier.payment_terms || 'Net 30'}
                                        </span>
                                    </div>

                                    {/* Contact Details */}
                                    <div className="space-y-1.5 text-xs text-slate-400 mb-5">
                                        {supplier.phone && (
                                            <div className="flex items-center gap-2">
                                                <Phone size={13} className="text-slate-500" />
                                                <span>{supplier.phone}</span>
                                            </div>
                                        )}
                                        {supplier.email && (
                                            <div className="flex items-center gap-2 truncate">
                                                <Mail size={13} className="text-slate-500" />
                                                <span className="truncate">{supplier.email}</span>
                                            </div>
                                        )}
                                        {supplier.address && (
                                            <div className="flex items-center gap-2 truncate">
                                                <MapPin size={13} className="text-slate-500" />
                                                <span className="truncate">{supplier.address}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Financial Summary */}
                                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 mb-4 grid grid-cols-2 gap-2 text-center">
                                        <div>
                                            <span className="text-[10px] font-semibold text-slate-500 uppercase block">Purchases</span>
                                            <span className="text-sm font-bold text-white">LKR {stat.total.toLocaleString()}</span>
                                            <span className="text-[10px] text-slate-500 block">{stat.count} bill{stat.count === 1 ? '' : 's'}</span>
                                        </div>
                                        <div className="border-l border-slate-800 pl-2">
                                            <span className="text-[10px] font-semibold text-slate-500 uppercase block">Balance Owed</span>
                                            <span className={`text-sm font-bold ${hasOwed ? 'text-rose-400' : 'text-emerald-400'}`}>
                                                LKR {stat.outstanding.toLocaleString()}
                                            </span>
                                            <span className={`text-[10px] ${hasOwed ? 'text-rose-500' : 'text-emerald-500'} block`}>
                                                {hasOwed ? 'Payment due' : 'Fully settled'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center justify-between pt-3 border-t border-slate-800/60 gap-1.5">
                                    <div className="flex items-center gap-1">
                                        {supplier.phone && (
                                            <>
                                                <a
                                                    href={`tel:${supplier.phone}`}
                                                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                                                    title="Call Supplier"
                                                >
                                                    <Phone size={15} />
                                                </a>
                                                <button
                                                    type="button"
                                                    onClick={() => handleWhatsApp(supplier)}
                                                    className="p-2 bg-slate-800 hover:bg-[#25D366]/20 text-[#25D366] rounded-lg transition-colors"
                                                    title="Chat on WhatsApp"
                                                >
                                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                                    </svg>
                                                </button>
                                            </>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedSupplier(supplier);
                                                setIsStatementModalOpen(true);
                                            }}
                                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-400 rounded-lg transition-colors"
                                            title="View Statement & History"
                                        >
                                            <History size={15} />
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedSupplier(supplier);
                                                setBillForm(f => ({
                                                    ...f,
                                                    amount_lkr: '',
                                                    reference: '',
                                                    paid: false,
                                                    due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
                                                }));
                                                setIsBillModalOpen(true);
                                            }}
                                            className="px-2.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
                                        >
                                            <Plus size={13} />
                                            <span>Record Bill</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditingSupplier(supplier);
                                                setSupplierForm({
                                                    name: supplier.name,
                                                    contact_person: supplier.contact_person || '',
                                                    phone: supplier.phone || '',
                                                    email: supplier.email || '',
                                                    address: supplier.address || '',
                                                    payment_terms: supplier.payment_terms || 'Net 30',
                                                    notes: supplier.notes || ''
                                                });
                                                setIsSupplierModalOpen(true);
                                            }}
                                            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
                                            title="Edit Supplier"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteSupplier(supplier)}
                                            className="p-1.5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
                                            title="Delete Supplier"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal 1: Add / Edit Supplier */}
            <Modal
                isOpen={isSupplierModalOpen}
                onClose={() => setIsSupplierModalOpen(false)}
                title={editingSupplier ? `Edit ${editingSupplier.name}` : 'Add New Supplier'}
            >
                <form onSubmit={handleSaveSupplier} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Vendor / Supplier Name *
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. Cworks, Sterling Aftermarket, DIMO"
                            value={supplierForm.name}
                            onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Contact Person</label>
                            <input
                                type="text"
                                placeholder="Account rep or manager"
                                value={supplierForm.contact_person}
                                onChange={e => setSupplierForm({ ...supplierForm, contact_person: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Phone Number</label>
                            <input
                                type="tel"
                                placeholder="0771234567"
                                value={supplierForm.phone}
                                onChange={e => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Email</label>
                            <input
                                type="email"
                                placeholder="sales@supplier.com"
                                value={supplierForm.email}
                                onChange={e => setSupplierForm({ ...supplierForm, email: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Payment Terms</label>
                            <select
                                value={supplierForm.payment_terms}
                                onChange={e => setSupplierForm({ ...supplierForm, payment_terms: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                            >
                                <option value="Net 30">Net 30 Days</option>
                                <option value="Net 15">Net 15 Days</option>
                                <option value="Cash on Delivery">Cash on Delivery (COD)</option>
                                <option value="Advance Payment">Advance Payment</option>
                                <option value="Immediate">Immediate / Cash</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Office / Warehouse Address</label>
                        <input
                            type="text"
                            placeholder="Street, City"
                            value={supplierForm.address}
                            onChange={e => setSupplierForm({ ...supplierForm, address: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Notes</label>
                        <textarea
                            rows={2}
                            placeholder="Parts supplied, account numbers, delivery notes..."
                            value={supplierForm.notes}
                            onChange={e => setSupplierForm({ ...supplierForm, notes: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <button
                            type="button"
                            onClick={() => setIsSupplierModalOpen(false)}
                            className="px-4 py-2 text-slate-400 hover:text-white text-sm transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-sm transition-colors shadow-lg shadow-cyan-500/20"
                        >
                            {editingSupplier ? 'Save Changes' : 'Create Supplier'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Modal 2: Quick Record Bill */}
            <Modal
                isOpen={isBillModalOpen}
                onClose={() => setIsBillModalOpen(false)}
                title={`Record Purchase Bill — ${selectedSupplier?.name}`}
            >
                <form onSubmit={handleRecordBill} className="space-y-4">
                    <p className="text-xs text-slate-400">
                        This records an expense bill in your finance books under <strong className="text-white">{selectedSupplier?.name}</strong>.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Bill Amount (LKR) *</label>
                            <input
                                type="number"
                                step="any"
                                inputMode="decimal"
                                required
                                placeholder="e.g. 35000"
                                value={billForm.amount_lkr}
                                onChange={e => setBillForm({ ...billForm, amount_lkr: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white text-sm focus:outline-none focus:border-cyan-500 font-mono"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Bill Date</label>
                            <input
                                type="date"
                                required
                                value={billForm.date}
                                onChange={e => setBillForm({ ...billForm, date: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Category</label>
                            <select
                                value={billForm.category}
                                onChange={e => setBillForm({ ...billForm, category: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                            >
                                <option value="Parts purchases">Parts purchases</option>
                                <option value="Consumables & cleaning">Consumables & cleaning</option>
                                <option value="Tools & equipment">Tools & equipment</option>
                                <option value="Subcontract & lathe">Subcontract & lathe</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Invoice / Bill Ref</label>
                            <input
                                type="text"
                                placeholder="e.g. INV-2026-089"
                                value={billForm.reference}
                                onChange={e => setBillForm({ ...billForm, reference: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                            />
                        </div>
                    </div>

                    {/* Paid or Unpaid */}
                    <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                        <label className="flex items-center gap-2.5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={billForm.paid}
                                onChange={e => setBillForm({ ...billForm, paid: e.target.checked })}
                                className="w-4 h-4 rounded text-cyan-500 focus:ring-cyan-500/20 bg-slate-900 border-slate-700"
                            />
                            <span className="text-sm font-semibold text-white">Bill has already been paid in full</span>
                        </label>

                        {billForm.paid ? (
                            <div className="mt-3 pt-3 border-t border-slate-800 flex items-center gap-3">
                                <label className="text-xs text-slate-400">Paid via:</label>
                                <select
                                    value={billForm.paid_via}
                                    onChange={e => setBillForm({ ...billForm, paid_via: e.target.value })}
                                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                                >
                                    <option value="bank">Bank Transfer</option>
                                    <option value="cash">Cash in Hand</option>
                                    <option value="cheque">Cheque</option>
                                </select>
                            </div>
                        ) : (
                            <div className="mt-3 pt-3 border-t border-slate-800">
                                <label className="text-xs text-slate-400 block mb-1">Due Date (Payment Deadline):</label>
                                <input
                                    type="date"
                                    value={billForm.due_date}
                                    onChange={e => setBillForm({ ...billForm, due_date: e.target.value })}
                                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white w-full sm:w-auto"
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <button
                            type="button"
                            onClick={() => setIsBillModalOpen(false)}
                            className="px-4 py-2 text-slate-400 hover:text-white text-sm transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-sm transition-colors shadow-lg shadow-cyan-500/20"
                        >
                            Save Bill
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Modal 3: Supplier Statement / Bill History */}
            <Modal
                isOpen={isStatementModalOpen}
                onClose={() => setIsStatementModalOpen(false)}
                title={`Vendor Statement — ${selectedSupplier?.name}`}
            >
                <div className="space-y-4">
                    {/* Header Statement Summary */}
                    {selectedSupplier && (
                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-wrap justify-between items-center gap-4">
                            <div>
                                <span className="text-xs text-slate-500 uppercase block">Total Purchases</span>
                                <span className="text-xl font-black text-white">
                                    LKR {(supplierStats[selectedSupplier.name.toLowerCase()]?.total || 0).toLocaleString()}
                                </span>
                            </div>
                            <div className="text-right">
                                <span className="text-xs text-slate-500 uppercase block">Outstanding Payable</span>
                                <span className={`text-xl font-black ${(supplierStats[selectedSupplier.name.toLowerCase()]?.outstanding || 0) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                    LKR {(supplierStats[selectedSupplier.name.toLowerCase()]?.outstanding || 0).toLocaleString()}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Search in statement */}
                    <div className="flex items-center justify-between gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 text-slate-500" size={15} />
                            <input
                                type="text"
                                placeholder="Filter bills by ref, description, date..."
                                value={statementSearch}
                                onChange={e => setStatementSearch(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                            />
                        </div>

                        {selectedSupplier && currentSupplierBills.length > 0 && (
                            <button
                                onClick={() => downloadCSV(`${selectedSupplier.name}-statement`, currentSupplierBills.map(b => ({
                                    Date: b.date,
                                    Category: b.category,
                                    Description: b.description || '',
                                    Amount: b.amount_lkr,
                                    Paid: b.paid ? 'Yes' : 'No',
                                    PaidOn: b.paid_on || '',
                                    DueDate: b.due_date || ''
                                })))}
                                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs flex items-center gap-1 shrink-0"
                                title="Export Statement CSV"
                            >
                                <Download size={14} />
                                <span className="hidden sm:inline">Export</span>
                            </button>
                        )}
                    </div>

                    {/* List of bills */}
                    <div className="max-h-[55vh] overflow-y-auto space-y-2 pr-1">
                        {currentSupplierBills.length === 0 ? (
                            <div className="py-12 text-center text-slate-500 text-xs">
                                No bills found for this vendor.
                            </div>
                        ) : (
                            currentSupplierBills.map(bill => (
                                <div
                                    key={bill.id}
                                    className="bg-slate-800/40 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 flex items-center justify-between gap-3 transition-colors"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-bold text-white truncate">
                                                {bill.description || bill.category}
                                            </span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                bill.paid
                                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                            }`}>
                                                {bill.paid ? 'PAID' : 'UNPAID'}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                                            <span className="flex items-center gap-1">
                                                <Calendar size={12} /> {bill.date}
                                            </span>
                                            {bill.category && (
                                                <span className="bg-slate-900 px-1.5 py-0.5 rounded text-slate-400">
                                                    {bill.category}
                                                </span>
                                            )}
                                            {!bill.paid && bill.due_date && (
                                                <span className="text-amber-400 flex items-center gap-1">
                                                    <Clock size={12} /> Due {bill.due_date}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0">
                                        <div className="text-right">
                                            <div className="text-sm font-bold text-white font-mono">
                                                LKR {Number(bill.amount_lkr).toLocaleString()}
                                            </div>
                                            {bill.paid && bill.paid_on && (
                                                <div className="text-[10px] text-slate-500">Paid {bill.paid_on}</div>
                                            )}
                                        </div>

                                        {!bill.paid && (
                                            <button
                                                type="button"
                                                onClick={() => handleMarkBillPaid(bill.id, Number(bill.amount_lkr))}
                                                className="px-2.5 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-xs font-semibold rounded-lg transition-colors border border-emerald-500/20"
                                            >
                                                Settle Bill
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="flex justify-end pt-2">
                        <button
                            type="button"
                            onClick={() => setIsStatementModalOpen(false)}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold"
                        >
                            Close Statement
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
