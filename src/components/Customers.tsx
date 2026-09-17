import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Phone, Edit2, Trash2, Mail, History, Calendar, RefreshCcw, MessageSquare, MessageCircle, Download, Wrench, Users } from 'lucide-react';
import { downloadCSV } from '../lib/csv';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { calcInvoiceTotal } from '../lib/totals';
import { tidyName, withTitle, CUSTOMER_TITLES } from '../lib/textCase';
import { Modal } from './Modal';
import { JobDetails } from './JobDetails';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { sendSMS, smsTemplates } from '../lib/sms';
import { waMeUrl, toSriLankanMsisdn } from '../lib/whatsapp';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Customer, Vehicle, JobCard } from '../types';

type HistoryJob = JobCard & {
    job_parts?: Parameters<typeof calcInvoiceTotal>[0];
    job_labor?: Parameters<typeof calcInvoiceTotal>[1];
};

/** job_cards has no total column; the money lives in the line items. Invoices
 *  only exist once a job is completed, so line items are the one source that
 *  works for every status. */
const jobTotal = (job: HistoryJob) => calcInvoiceTotal(job.job_parts ?? [], job.job_labor ?? []);

export const Customers = () => {
    const { profile } = useAuth();
    const { toast } = useToast();
    const confirm = useConfirm();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');

    // Modal States
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
    const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    
    const [customerHistory, setCustomerHistory] = useState<HistoryJob[]>([]);
    const [historySearch, setHistorySearch] = useState('');
    const [historyJobId, setHistoryJobId] = useState<string | null>(null);
    const [mergeOpen, setMergeOpen] = useState(false);
    const [merging, setMerging] = useState(false);

    // Service reminder SMS modal
    const [smsModal, setSmsModal] = useState<{ customer: Customer; vehicle: Vehicle | null } | null>(null);
    const [smsMessage, setSmsMessage] = useState('');
    const [smsSending, setSmsSending] = useState(false);

    // Forms
    const [customerForm, setCustomerForm] = useState({ title: 'Mr.', name: '', phone: '', email: '', address: '' });
    const [vehicleForm, setVehicleForm] = useState({ make: '', model: '', year: '', license_plate: '', color: '', vin: '' });

    const { data: customers = [], isLoading: customersLoading } = useQuery({
        queryKey: ['customers'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(500);
            if (error) throw error;
            return data as Customer[];
        }
    });

    const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery({
        queryKey: ['vehicles'],
        queryFn: async () => {
            const { data, error } = await supabase.from('vehicles').select('*');
            if (error) throw error;
            return data as Vehicle[];
        }
    });

    /* Job counts for the whole list in one query. Counting per row would be
       500 round trips; this returns only the vehicle→customer mapping and the
       job rows, which is small enough to tally on the client. */
    const { data: jobCounts = {} } = useQuery({
        queryKey: ['customer-job-counts'],
        queryFn: async () => {
            const [{ data: veh }, { data: jobs }] = await Promise.all([
                supabase.from('vehicles').select('id, customer_id'),
                supabase.from('job_cards').select('vehicle_id, status'),
            ]);
            const owner = new Map((veh || []).map(v => [v.id, v.customer_id]));
            const tally: Record<string, { total: number; open: number }> = {};
            for (const j of jobs || []) {
                const cust = owner.get(j.vehicle_id);
                if (!cust) continue;
                const t = tally[cust] ?? { total: 0, open: 0 };
                t.total += 1;
                if (j.status !== 'completed' && j.status !== 'cancelled') t.open += 1;
                tally[cust] = t;
            }
            return tally;
        },
    });

    /* Two records are the same person when their phone numbers normalise to the
       same thing — 0771234567, +94 77 123 4567 and 771234567 are one number.
       Express intake used to create a fresh customer for every walk-in, which is
       where these came from. */
    const duplicateGroups = useMemo(() => {
        const byPhone = new Map<string, Customer[]>();
        for (const c of customers) {
            const key = toSriLankanMsisdn(c.phone || '');
            if (!key) continue;
            byPhone.set(key, [...(byPhone.get(key) ?? []), c]);
        }
        return [...byPhone.values()]
            .filter(g => g.length > 1)
            // Keep the record with the most work against it by default; it is the
            // one most likely to carry the correct details.
            .map(g => [...g].sort((a, b) =>
                (jobCounts[b.id]?.total ?? 0) - (jobCounts[a.id]?.total ?? 0)
                || new Date((a as any).created_at ?? 0).getTime() - new Date((b as any).created_at ?? 0).getTime()));
    }, [customers, jobCounts]);

    /** A shared phone number does not always mean the same person — families and
     *  small firms share one. Where the names disagree the group is flagged, so
     *  a real pair of people are not silently welded together. */
    const namesAgree = (group: Customer[]) => {
        const norm = (n: string) => (n || '').toLowerCase().replace(/[^a-z]/g, '');
        const first = norm(group[0].name);
        return group.every(c => {
            const other = norm(c.name);
            return other === first || other.startsWith(first) || first.startsWith(other);
        });
    };

    /**
     * Moves every vehicle onto the surviving customer, then deletes the others.
     *
     * The order is not optional: customers cascade to vehicles and vehicles
     * cascade to job_cards, so deleting a duplicate first would take its whole
     * job history with it.
     */
    const mergeCustomer = async (group: Customer[]) => {
        const [keeper, ...dupes] = group;
        const totalJobs = group.reduce((t, c) => t + (jobCounts[c.id]?.total ?? 0), 0);
        const mismatched = !namesAgree(group);
        const ok = await confirm({
            title: `Merge into ${withTitle(keeper.title, keeper.name)}?`,
            message: (mismatched
                    ? `These records carry different names — ${group.map(c => c.name).join(', ')} — so they may be `
                      + `different people sharing one phone number. Merging them cannot be undone. `
                    : '')
                + `${dupes.length} record${dupes.length === 1 ? '' : 's'} will be removed and their `
                + `vehicles and ${totalJobs} job${totalJobs === 1 ? '' : 's'} moved onto `
                + `${withTitle(keeper.title, keeper.name)}.`,
            confirmLabel: mismatched ? 'Merge anyway' : 'Merge',
            confirmStyle: 'warning',
        });
        if (!ok) return;

        setMerging(true);
        try {
            const dupeIds = dupes.map(d => d.id);

            const { error: moveError } = await supabase
                .from('vehicles').update({ customer_id: keeper.id }).in('customer_id', dupeIds);
            if (moveError) throw moveError;

            // Fill anything blank on the survivor from the records being removed,
            // so merging never loses a detail that was only on a duplicate.
            const patch: Record<string, string> = {};
            for (const field of ['email', 'address', 'phone'] as const) {
                if (!keeper[field]) {
                    const found = dupes.find(d => d[field]);
                    if (found?.[field]) patch[field] = found[field] as string;
                }
            }
            if (Object.keys(patch).length) {
                await supabase.from('customers').update(patch).eq('id', keeper.id);
            }

            const { error: delError } = await supabase.from('customers').delete().in('id', dupeIds);
            if (delError) throw delError;

            refreshData();
            toast(`Merged into ${withTitle(keeper.title, keeper.name)}.`, 'success');
        } catch (e: any) {
            toast('Merge failed: ' + e.message, 'error');
        } finally {
            setMerging(false);
        }
    };

    const refreshData = () => {
        queryClient.invalidateQueries({ queryKey: ['customers'] });
        queryClient.invalidateQueries({ queryKey: ['vehicles'] });
        queryClient.invalidateQueries({ queryKey: ['customer-job-counts'] });
    };

    const loading = customersLoading || vehiclesLoading;

    const location = useLocation();

    useEffect(() => {
        // Handle SmartScan redirect
        const state = location.state as any;
        if (state?.initialPlate) {
            setSearchTerm(state.initialPlate);
            setVehicleForm(prev => ({
                ...prev,
                license_plate: state.initialPlate,
                make: state.make || '',
                model: state.model || ''
            }));
            // If we have a plate, we probably want to either find customer or create new
            // For now, let's just search.
        }
    }, [location]);

    const handleSaveCustomer = async (e: React.FormEvent) => {
        e.preventDefault();

        const tidied = { ...customerForm, name: tidyName(customerForm.name) };

        if (editingCustomer) {
             const { error } = await supabase.from('customers').update(tidied).eq('id', editingCustomer.id);
             if (error) toast(error.message, 'error');
        } else {
             const payload = { ...tidied, tenant_id: profile?.tenant_id };
             const { error } = await supabase.from('customers').insert([payload]);
             if (error) toast(error.message, 'error');
        }
        
        setIsCustomerModalOpen(false);
        setEditingCustomer(null);
        setCustomerForm({ title: 'Mr.', name: '', phone: '', email: '', address: '' });
        refreshData();
    };

    const handleSaveVehicle = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCustomer) return;

        // Added tenant_id to payload
        const payload = {
            ...vehicleForm,
            make: tidyName(vehicleForm.make),
            model: tidyName(vehicleForm.model),
            // Jobs.tsx already uppercases plates on express intake; this form
            // did not, which is how a lowercase plate got in.
            license_plate: vehicleForm.license_plate.trim().toUpperCase(),
            customer_id: selectedCustomer.id,
            tenant_id: profile?.tenant_id
        };
        
        if (editingVehicle) {
            const { tenant_id, ...updatePayload } = payload; 
            const { error } = await supabase.from('vehicles').update(updatePayload).eq('id', editingVehicle.id);
            if (error) toast(error.message, 'error');
        } else {
            const { error } = await supabase.from('vehicles').insert([payload]);
            if (error) toast(error.message, 'error');
        }
        
        setIsVehicleModalOpen(false);
        setEditingVehicle(null);
        setVehicleForm({ make: '', model: '', year: '', license_plate: '', color: '', vin: '' });
        refreshData();
    };

    const deleteCustomer = async (id: string) => {
        if (!await confirm({ title: 'Delete Customer', message: 'This will permanently delete the customer and all their vehicles.', confirmLabel: 'Delete' })) return;
        const { error } = await supabase.from('customers').delete().eq('id', id);
        if (error) toast(error.message, 'error');
        else { refreshData(); }
    };

    const fetchHistory = async (customerId: string) => {
        setSelectedCustomer(customers.find(c => c.id === customerId) || null);
        setIsHistoryModalOpen(true);

        const { data: vehicleData } = await supabase.from('vehicles').select('id').eq('customer_id', customerId);
        const vehicleIds = vehicleData?.map(v => v.id) || [];

        if (vehicleIds.length === 0) {
            setCustomerHistory([]);
            return;
        }

        const { data: jobs } = await supabase
            .from('job_cards')
            // @ts-ignore
            .select('*, vehicles(make, model, license_plate), job_parts(quantity, price_at_time_lkr), job_labor(hours, hourly_rate_lkr)')
            .in('vehicle_id', vehicleIds)
            .order('created_at', { ascending: false });
            
        if (jobs) setCustomerHistory(jobs as HistoryJob[]);
    };

    /** Searches what the workshop actually remembers a job by — the complaint,
     *  the diagnosis, the plate, the date — not just the vehicle. */
    const visibleHistory = customerHistory.filter(job => {
        const q = historySearch.trim().toLowerCase();
        if (!q) return true;
        return [
            job.description,
            job.technician_notes,
            job.status.replace(/_/g, ' '),
            job.vehicles?.make,
            job.vehicles?.model,
            job.vehicles?.license_plate,
            new Date(job.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        ].some(field => (field || '').toLowerCase().includes(q));
    });

    const filteredCustomers = customers.filter(c =>
        (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.phone || '').includes(searchTerm) ||
        vehicles.some(v => v.customer_id === c.id && (v.license_plate || '').toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleDeleteVehicle = async (vehicleId: string) => {
        if (!await confirm({ title: 'Delete Vehicle', message: 'This will permanently delete this vehicle and all its job history.', confirmLabel: 'Delete' })) return;
        const { error } = await supabase.from('vehicles').delete().eq('id', vehicleId);
        if (error) toast("Error deleting vehicle: " + error.message, 'error');
        else refreshData();
    };

    return (
        <div className="p-2">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Customers</h1>
                    <p className="text-slate-400">Manage clients and vehicle registries.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => downloadCSV('customers', customers.map((c: any) => ({
                            name: c.name, phone: c.phone, email: c.email, address: c.address,
                        })))}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                        title="Export CSV"
                    >
                        <Download size={20} />
                    </button>
                    <button
                        onClick={refreshData}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                        title="Refresh"
                    >
                        <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button 
                        onClick={() => {
                            setEditingCustomer(null);
                            setCustomerForm({ title: 'Mr.', name: '', phone: '', email: '', address: '' });
                            setIsCustomerModalOpen(true);
                        }}
                        className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg font-bold shadow-lg shadow-cyan-500/20"
                    >
                        <Plus size={20} /> Add Customer
                    </button>
                </div>
            </div>

            <div className="relative mb-8">
                 <Search className="absolute left-3 top-3 text-slate-500" size={20} />
                 <input 
                    type="text" 
                    placeholder="Search by name, phone, or license plate..." 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 text-white focus:outline-none focus:border-cyan-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                 />
            </div>

            {duplicateGroups.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3 mb-6">
                    <Users size={16} className="text-amber-400 shrink-0" />
                    <p className="text-sm text-amber-200/90 flex-1">
                        <span className="font-bold">
                            {duplicateGroups.length} customer{duplicateGroups.length === 1 ? '' : 's'} recorded more than once.
                        </span>{' '}
                        Same phone number, separate records — usually a walk-in entered again rather than looked up.
                        Merging keeps every vehicle and job.
                    </p>
                    <button onClick={() => setMergeOpen(true)}
                        className="shrink-0 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 px-4 py-2 rounded-lg text-xs font-bold transition-colors">
                        Review &amp; merge
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {loading ? (
                    <div className="col-span-full py-20 text-center text-slate-500">Loading customer database...</div>
                ) : (
                    filteredCustomers.map(customer => (
                        <div key={customer.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-colors">
                            <div className="flex flex-col md:flex-row md:justify-between md:items-start mb-6 gap-4">
                                <div className="flex items-center gap-4 min-w-0 md:flex-1">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                                        {(customer.name?.[0] || '?').toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <h3 className="text-xl font-bold text-white truncate">{withTitle(customer.title, customer.name)}</h3>
                                            {/* How much work this person has actually brought in — the
                                                quickest read on whether they are a regular. */}
                                            {(jobCounts[customer.id]?.total ?? 0) > 0 && (
                                                <span
                                                    title={`${jobCounts[customer.id].total} job${jobCounts[customer.id].total === 1 ? '' : 's'}`
                                                        + (jobCounts[customer.id].open ? ` · ${jobCounts[customer.id].open} still open` : '')}
                                                    className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                                                        jobCounts[customer.id].open > 0
                                                            ? 'bg-cyan-500/15 text-cyan-300'
                                                            : 'bg-slate-800 text-slate-400'}`}>
                                                    <Wrench size={10} />
                                                    {jobCounts[customer.id].total}
                                                    {jobCounts[customer.id].open > 0 && (
                                                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400 mt-1">
                                            <span className="flex items-center gap-1"><Phone size={14}/> {customer.phone}</span>
                                            {customer.email && <span className="flex items-center gap-1"><Mail size={14}/> {customer.email}</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2 w-full md:w-auto justify-end flex-shrink-0">
                                    <button
                                        onClick={async () => {
                                            if (!customer.phone) { toast("No phone number for this customer.", 'warning'); return; }
                                            if (!profile?.tenant_id) return;
                                            const veh = (vehicles as Vehicle[]).find(v => v.customer_id === customer.id);
                                            const { data: tenant } = await supabase.from('tenants').select('name, phone').eq('id', profile.tenant_id).single();
                                            const defaultMsg = smsTemplates.serviceReminder(
                                                customer.name, veh?.make || 'your vehicle', veh?.model || '',
                                                veh?.license_plate || '', tenant?.name || 'us', tenant?.phone || ''
                                            );
                                            setSmsMessage(defaultMsg);
                                            setSmsModal({ customer, vehicle: veh || null });
                                        }}
                                        className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-blue-400 transition-colors"
                                        title="Service reminder by SMS — sends immediately"
                                    >
                                        <MessageSquare size={18} />
                                    </button>
                                    {/* WhatsApp alongside SMS rather than instead of it: this one
                                        opens a draft the user sends themselves, which is both cheaper
                                        and reviewable, but not every customer is on WhatsApp. */}
                                    <button
                                        onClick={async () => {
                                            if (!profile?.tenant_id) return;
                                            const veh = (vehicles as Vehicle[]).find(v => v.customer_id === customer.id);
                                            const { data: tenant } = await supabase.from('tenants').select('name, phone').eq('id', profile.tenant_id).single();
                                            const msg = smsTemplates.serviceReminder(
                                                customer.name, veh?.make || 'your vehicle', veh?.model || '',
                                                veh?.license_plate || '', tenant?.name || 'us', tenant?.phone || ''
                                            );
                                            window.open(waMeUrl(customer.phone, msg), '_blank', 'noopener');
                                        }}
                                        className="p-2 rounded-lg bg-[#25D366]/15 text-[#25D366] hover:bg-[#25D366]/25 transition-colors"
                                        title="Service reminder on WhatsApp — opens a draft you send"
                                    >
                                        <MessageCircle size={18} />
                                    </button>
                                     <button
                                        onClick={() => { setHistorySearch(''); fetchHistory(customer.id); }}
                                        className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-cyan-400 transition-colors"
                                        title="Service History"
                                    >
                                        <History size={18} />
                                    </button>
                                    <button 
                                        onClick={() => {
                                            setEditingCustomer(customer);
                                            setCustomerForm({ title: customer.title || 'Mr.', name: customer.name, phone: customer.phone, email: customer.email || '', address: customer.address || '' });
                                            setIsCustomerModalOpen(true);
                                        }}
                                        className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                    <button onClick={() => deleteCustomer(customer.id)} className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-red-400 transition-colors">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                                    <span>Registered Vehicles</span>
                                    <button 
                                        onClick={() => {
                                            setSelectedCustomer(customer);
                                            setEditingVehicle(null);
                                            setVehicleForm({ make: '', model: '', year: '', license_plate: '', color: '', vin: '' });
                                            setIsVehicleModalOpen(true);
                                        }}
                                        className="text-cyan-500 hover:text-cyan-400 flex items-center gap-1"
                                    >
                                        <Plus size={14} /> Add Vehicle
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {vehicles.filter(v => v.customer_id === customer.id).map(vehicle => (
                                        <div key={vehicle.id} className="bg-slate-800/50 border border-slate-800 rounded-xl p-3 flex justify-between items-center group">
                                            <div>
                                                <div className="text-white font-medium">{vehicle.make} {vehicle.model}</div>
                                                <div className="text-xs font-mono text-cyan-500">{vehicle.license_plate}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button 
                                                    onClick={() => {
                                                        setSelectedCustomer(customer);
                                                        setEditingVehicle(vehicle);
                                                        setVehicleForm({ 
                                                            make: vehicle.make, 
                                                            model: vehicle.model, 
                                                            year: vehicle.year, 
                                                            license_plate: vehicle.license_plate,
                                                            color: vehicle.color || '',
                                                            vin: vehicle.vin || ''
                                                        });
                                                        setIsVehicleModalOpen(true);
                                                    }}
                                                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-slate-700 rounded transition-all"
                                                >
                                                    <Edit2 size={14} className="text-slate-400" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteVehicle(vehicle.id)}
                                                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/10 rounded transition-all"
                                                >
                                                    <Trash2 size={14} className="text-red-500" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {vehicles.filter(v => v.customer_id === customer.id).length === 0 && (
                                        <div className="col-span-full py-3 text-center text-slate-600 text-xs italic bg-slate-800/30 rounded-xl border border-dashed border-slate-800">
                                            No vehicles registered
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Customer Modal */}
            <Modal isOpen={isCustomerModalOpen} onClose={() => setIsCustomerModalOpen(false)} title={editingCustomer ? "Edit Customer" : "New Customer"}>
                <form onSubmit={handleSaveCustomer} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Full Name *</label>
                        <div className="flex gap-2">
                            <select
                                value={customerForm.title}
                                onChange={e => setCustomerForm({...customerForm, title: e.target.value})}
                                className="bg-slate-800 border border-slate-700 text-white rounded-lg p-3"
                            >
                                {CUSTOMER_TITLES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <input type="text" required className="flex-1 min-w-0 bg-slate-800 border border-slate-700 text-white rounded-lg p-3" value={customerForm.name} onChange={e => setCustomerForm({...customerForm, name: e.target.value})} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Phone *</label>
                            <input type="tel" required className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-3" value={customerForm.phone} onChange={e => setCustomerForm({...customerForm, phone: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Email</label>
                            <input type="email" className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-3" value={customerForm.email} onChange={e => setCustomerForm({...customerForm, email: e.target.value})} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Address</label>
                        <textarea className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-3" rows={2} value={customerForm.address} onChange={e => setCustomerForm({...customerForm, address: e.target.value})} />
                    </div>
                    <button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-lg shadow-lg">Save Customer</button>
                </form>
            </Modal>

            {/* Vehicle Modal */}
            <Modal isOpen={isVehicleModalOpen} onClose={() => setIsVehicleModalOpen(false)} title={editingVehicle ? "Edit Vehicle" : "Add New Vehicle"}>
                <form onSubmit={handleSaveVehicle} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Make *</label>
                            <input type="text" required className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-3" value={vehicleForm.make} onChange={e => setVehicleForm({...vehicleForm, make: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Model *</label>
                            <input type="text" required className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-3" value={vehicleForm.model} onChange={e => setVehicleForm({...vehicleForm, model: e.target.value})} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Year</label>
                            <input type="text" className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-3" value={vehicleForm.year} onChange={e => setVehicleForm({...vehicleForm, year: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">License Plate *</label>
                            <input type="text" required className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-3 font-mono" value={vehicleForm.license_plate} onChange={e => setVehicleForm({...vehicleForm, license_plate: e.target.value})} />
                        </div>
                    </div>
                    <button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-lg shadow-lg">Save Vehicle</button>
                </form>
            </Modal>

            {/* History Modal */}
            <Modal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} title={`Service History: ${withTitle(selectedCustomer?.title, selectedCustomer?.name)}`}>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                     {/* Summary Stats */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="bg-slate-800 p-3 rounded-lg text-center">
                            <div className="text-xs text-slate-500 uppercase">Jobs</div>
                            <div className="text-xl font-bold text-white">{customerHistory.length}</div>
                        </div>
                        <div className="bg-slate-800 p-3 rounded-lg text-center col-span-2">
                             <div className="text-xs text-slate-500 uppercase">Total Value</div>
                             <div className="text-xl font-bold text-cyan-400">
                                LKR {customerHistory.reduce((sum, job) => sum + jobTotal(job), 0).toLocaleString()}
                             </div>
                        </div>
                    </div>

                    {customerHistory.length > 0 && (
                        <div className="relative">
                            <Search className="absolute left-3 top-3 text-slate-500" size={16} />
                            <input
                                type="text"
                                value={historySearch}
                                onChange={e => setHistorySearch(e.target.value)}
                                placeholder="Search the issue, diagnosis, plate or date..."
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 pl-9 pr-3 text-white text-sm focus:outline-none focus:border-cyan-500"
                            />
                        </div>
                    )}

                    {customerHistory.length === 0 ? (
                         <div className="text-center text-slate-500 py-8">No job history found.</div>
                    ) : visibleHistory.length === 0 ? (
                         <div className="text-center text-slate-500 py-8">No job matches “{historySearch}”.</div>
                    ) : (
                        visibleHistory.map(job => (
                                <div
                                    key={job.id}
                                    className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 hover:border-cyan-500/50 transition-colors cursor-pointer"
                                    onClick={() => setHistoryJobId(job.id)}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`text-xs px-2 py-1 rounded uppercase font-bold
                                            ${job.status === 'completed' ? 'text-emerald-400 bg-emerald-900/30' : 'text-cyan-400 bg-cyan-900/30'}`}>
                                            {job.status.replace('_', ' ')}
                                        </span>
                                        <span className="text-xs text-slate-400 flex items-center gap-1">
                                            <Calendar size={12} /> {new Date(job.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <h4 className="font-bold text-white group-hover:text-cyan-400 transition-colors">
                                         {/* @ts-ignore */}
                                        {job.vehicles?.make} {job.vehicles?.model} ({job.vehicles?.license_plate})
                                    </h4>
                                <p className="text-sm text-slate-400 mt-1">{job.description}</p>
                                {job.technician_notes && (
                                    <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 whitespace-pre-line">
                                        <span className="text-slate-600 font-bold uppercase">Done: </span>
                                        {job.technician_notes}
                                    </p>
                                )}
                                <div className="mt-2 pt-2 border-t border-slate-700 flex justify-between items-center">
                                    <span className="text-[10px] text-slate-500 uppercase font-bold">
                                        {(job.job_parts?.length ?? 0)} parts · {(job.job_labor?.length ?? 0)} labour
                                    </span>
                                    <span className="text-cyan-400 font-mono font-bold">LKR {jobTotal(job).toLocaleString()}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </Modal>

            {/* Service Reminder SMS Modal */}
            <Modal isOpen={!!smsModal} onClose={() => setSmsModal(null)} title="Send Service Reminder">
                {smsModal && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl border border-slate-700">
                            <div>
                                <p className="text-white font-bold text-sm">{withTitle(smsModal.customer.title, smsModal.customer.name)}</p>
                                <p className="text-slate-400 text-xs">{smsModal.customer.phone}</p>
                                {smsModal.vehicle && (
                                    <p className="text-slate-500 text-xs mt-0.5">
                                        {smsModal.vehicle.make} {smsModal.vehicle.model} · {smsModal.vehicle.license_plate}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                                Message <span className="text-slate-600 normal-case font-normal">({smsMessage.length} chars)</span>
                            </label>
                            <textarea
                                rows={5}
                                value={smsMessage}
                                onChange={e => setSmsMessage(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-brand resize-none"
                                placeholder="Type your message..."
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setSmsModal(null)}
                                className="flex-1 py-3 rounded-xl font-bold text-slate-400 bg-slate-800 hover:bg-slate-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                disabled={smsSending || !smsMessage.trim()}
                                onClick={async () => {
                                    if (!profile?.tenant_id || !smsModal.customer.phone) return;
                                    setSmsSending(true);
                                    try {
                                        await sendSMS(smsModal.customer.phone, smsMessage, profile.tenant_id);
                                        toast(`Reminder sent to ${smsModal.customer.name}.`, 'success');
                                        setSmsModal(null);
                                    } catch (e: any) {
                                        toast("SMS failed: " + e.message, 'error');
                                    } finally {
                                        setSmsSending(false);
                                    }
                                }}
                                className="flex-1 py-3 rounded-xl font-bold btn-brand disabled:opacity-50 transition-all active:scale-95"
                            >
                                {smsSending ? 'Sending...' : 'Send SMS'}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal isOpen={mergeOpen} onClose={() => setMergeOpen(false)} title="Merge duplicate customers">
                <div className="space-y-4">
                    <p className="text-xs text-slate-500 -mt-1">
                        Grouped by phone number. The record kept is the one with the most jobs against
                        it; the others are removed and their vehicles and job history moved across.
                        Any detail missing from the record being kept is filled in from the others.
                    </p>

                    {duplicateGroups.length === 0 ? (
                        <p className="text-center text-slate-500 py-8 text-sm">No duplicates left.</p>
                    ) : duplicateGroups.map(group => {
                        const [keeper, ...dupes] = group;
                        return (
                            <div key={keeper.id} className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                        {keeper.phone}
                                    </span>
                                    {!namesAgree(group) && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">
                                            NAMES DIFFER
                                        </span>
                                    )}
                                </div>
                                {!namesAgree(group) && (
                                    <p className="text-[11px] text-amber-300/80 mb-2 leading-snug">
                                        Different names on one number. This is often a family or a
                                        workplace sharing a phone rather than a duplicate — check before merging.
                                    </p>
                                )}
                                <div className="space-y-1.5 mb-3">
                                    {group.map((c, i) => (
                                        <div key={c.id} className="flex items-center gap-2 text-sm">
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                                i === 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                                                {i === 0 ? 'KEEP' : 'MERGE'}
                                            </span>
                                            <span className={`flex-1 min-w-0 truncate ${i === 0 ? 'text-white font-medium' : 'text-slate-400'}`}>
                                                {withTitle(c.title, c.name)}
                                            </span>
                                            <span className="text-[11px] text-slate-500 shrink-0">
                                                {jobCounts[c.id]?.total ?? 0} job{(jobCounts[c.id]?.total ?? 0) === 1 ? '' : 's'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <button onClick={() => mergeCustomer(group)} disabled={merging}
                                    className={`w-full py-2.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-60 ${
                                        namesAgree(group)
                                            ? 'bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white'
                                            : 'bg-slate-900 border border-amber-500/30 text-amber-300/80 hover:bg-amber-500/15'}`}>
                                    {merging ? 'Merging…' : `Merge ${dupes.length} into ${keeper.name}`}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </Modal>

            {/* Renders above the history modal (z-9999 vs z-50), so closing it
                drops the user straight back onto the list they searched. */}
            {historyJobId && (
                <JobDetails
                    jobId={historyJobId}
                    readOnly={customerHistory.find(j => j.id === historyJobId)?.status === 'completed'}
                    onClose={() => setHistoryJobId(null)}
                    onUpdate={() => { if (selectedCustomer) fetchHistory(selectedCustomer.id); }}
                />
            )}
        </div>
    );
};
