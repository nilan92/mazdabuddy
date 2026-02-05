import { useState, useEffect } from 'react';
import { Plus, Search, Phone, Edit2, Trash2, Mail, History, Calendar, RefreshCcw } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Modal } from './Modal';
import { useAuth } from '../context/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Customer, Vehicle, JobCard } from '../types';

export const Customers = () => {
    const { profile } = useAuth();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');

    // Modal States
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
    const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    
    const [customerHistory, setCustomerHistory] = useState<JobCard[]>([]);
    
    // Forms
    const [customerForm, setCustomerForm] = useState({ name: '', phone: '', email: '', address: '' });
    const [vehicleForm, setVehicleForm] = useState({ make: '', model: '', year: '', license_plate: '', color: '', vin: '' });

    const { data: customers = [], isLoading: customersLoading } = useQuery({
        queryKey: ['customers'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .order('created_at', { ascending: false });
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

    const refreshData = () => {
        queryClient.invalidateQueries({ queryKey: ['customers'] });
        queryClient.invalidateQueries({ queryKey: ['vehicles'] });
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
        
        if (editingCustomer) {
             const { error } = await supabase.from('customers').update(customerForm).eq('id', editingCustomer.id);
             if (error) alert(error.message);
        } else {
             // Added tenant_id to payload
             const payload = { ...customerForm, tenant_id: profile?.tenant_id };
             const { error } = await supabase.from('customers').insert([payload]);
             if (error) alert(error.message);
        }
        
        setIsCustomerModalOpen(false);
        setEditingCustomer(null);
        setCustomerForm({ name: '', phone: '', email: '', address: '' });
        refreshData();
    };

    const handleSaveVehicle = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCustomer) return;

        // Added tenant_id to payload
        const payload = { 
            ...vehicleForm, 
            customer_id: selectedCustomer.id,
            tenant_id: profile?.tenant_id 
        };
        
        if (editingVehicle) {
            const { tenant_id, ...updatePayload } = payload; 
            const { error } = await supabase.from('vehicles').update(updatePayload).eq('id', editingVehicle.id);
            if (error) alert(error.message);
        } else {
            const { error } = await supabase.from('vehicles').insert([payload]);
            if (error) alert(error.message);
        }
        
        setIsVehicleModalOpen(false);
        setEditingVehicle(null);
        setVehicleForm({ make: '', model: '', year: '', license_plate: '', color: '', vin: '' });
        refreshData();
    };

    const deleteCustomer = async (id: string) => {
        if (!confirm('Are you sure? This will delete all vehicles for this customer.')) return;
        const { error } = await supabase.from('customers').delete().eq('id', id);
        if (error) alert(error.message);
        else refreshData();
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
            .select('*, vehicles(make, model, license_plate)')
            .in('vehicle_id', vehicleIds)
            .order('created_at', { ascending: false });
            
        if (jobs) setCustomerHistory(jobs as JobCard[]);
    };

    const filteredCustomers = customers.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone.includes(searchTerm) ||
        vehicles.some(v => v.customer_id === c.id && v.license_plate.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleDeleteVehicle = async (vehicleId: string) => {
        if (!confirm("Are you sure? This will permanently delete this vehicle and all its job history.")) return;
        const { error } = await supabase.from('vehicles').delete().eq('id', vehicleId);
        if (error) {
            alert("Error deleting vehicle: " + error.message);
        } else {
            refreshData();
        }
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
                        onClick={refreshData}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                        title="Refresh"
                    >
                        <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button 
                        onClick={() => {
                            setEditingCustomer(null);
                            setCustomerForm({ name: '', phone: '', email: '', address: '' });
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {loading ? (
                    <div className="col-span-full py-20 text-center text-slate-500">Loading customer database...</div>
                ) : (
                    filteredCustomers.map(customer => (
                        <div key={customer.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-colors">
                            <div className="flex flex-col md:flex-row md:justify-between md:items-start mb-6 gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                                        {customer.name[0]}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-xl font-bold text-white truncate">{customer.name}</h3>
                                        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400 mt-1">
                                            <span className="flex items-center gap-1"><Phone size={14}/> {customer.phone}</span>
                                            {customer.email && <span className="flex items-center gap-1"><Mail size={14}/> {customer.email}</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2 w-full md:w-auto justify-end">
                                     <button 
                                        onClick={() => fetchHistory(customer.id)}
                                        className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-cyan-400 transition-colors"
                                        title="Service History"
                                    >
                                        <History size={18} />
                                    </button>
                                    <button 
                                        onClick={() => {
                                            setEditingCustomer(customer);
                                            setCustomerForm({ name: customer.name, phone: customer.phone, email: customer.email || '', address: customer.address || '' });
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
                        <input type="text" required className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-3" value={customerForm.name} onChange={e => setCustomerForm({...customerForm, name: e.target.value})} />
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
            <Modal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} title={`Service History: ${selectedCustomer?.name}`}>
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
                                LKR {customerHistory.reduce((sum, job) => sum + (job.estimated_cost_lkr || 0), 0).toLocaleString()}
                             </div>
                        </div>
                    </div>

                    {customerHistory.length === 0 ? (
                         <div className="text-center text-slate-500 py-8">No job history found.</div>
                    ) : (
                        customerHistory.map(job => (
                            <div key={job.id} className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`text-xs px-2 py-1 rounded uppercase font-bold
                                        ${job.status === 'completed' ? 'text-emerald-400 bg-emerald-900/30' : 'text-cyan-400 bg-cyan-900/30'}`}>
                                        {job.status.replace('_', ' ')}
                                    </span>
                                    <span className="text-xs text-slate-400 flex items-center gap-1">
                                        <Calendar size={12} /> {new Date(job.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                                <h4 className="font-bold text-white">
                                     {/* @ts-ignore */}
                                    {job.vehicles?.make} {job.vehicles?.model} ({job.vehicles?.license_plate})
                                </h4>
                                <p className="text-sm text-slate-400 mt-1">{job.description}</p>
                                <div className="mt-2 pt-2 border-t border-slate-700 flex justify-end">
                                    <span className="text-cyan-400 font-mono font-bold">LKR {job.estimated_cost_lkr?.toLocaleString() || 0}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </Modal>
        </div>
    );
};
