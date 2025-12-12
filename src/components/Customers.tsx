import { useState, useEffect } from 'react';
import { Plus, Search, Phone, Edit2, Trash2, Mail, History, Calendar, RefreshCcw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Modal } from './Modal';
import { useAuth } from '../context/AuthContext';
import type { Customer, Vehicle, JobCard } from '../types';

export const Customers = () => {
    const { profile } = useAuth();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(true);
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

    const fetchData = async () => {
        setLoading(true);
        const { data: custData } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
        const { data: vehicleData } = await supabase.from('vehicles').select('*');
        
        if (custData) setCustomers(custData);
        if (vehicleData) setVehicles(vehicleData);
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSaveCustomer = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (editingCustomer) {
             const { error } = await supabase.from('customers').update(customerForm).eq('id', editingCustomer.id);
             if (error) alert(error.message);
        } else {
             const { error } = await supabase.from('customers').insert([customerForm]);
             if (error) alert(error.message);
        }
        
        setIsCustomerModalOpen(false);
        setEditingCustomer(null);
        setCustomerForm({ name: '', phone: '', email: '', address: '' });
        fetchData();
    };

    const handleSaveVehicle = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (editingVehicle) {
            const { error } = await supabase.from('vehicles').update(vehicleForm).eq('id', editingVehicle.id);
            if (error) alert(error.message);
        } else {
            if (!selectedCustomer) return;
            const { error } = await supabase.from('vehicles').insert([{
                ...vehicleForm,
                customer_id: selectedCustomer.id
            }]);
            if (error) alert(error.message);
        }
        
        setIsVehicleModalOpen(false);
        setEditingVehicle(null);
        setVehicleForm({ make: '', model: '', year: '', license_plate: '', color: '', vin: '' });
        fetchData();
    };

    const handleViewHistory = async (customer: Customer, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setSelectedCustomer(customer);
        setIsHistoryModalOpen(true);
        
        const customerVehicles = vehicles.filter(v => v.customer_id === customer.id);
        const vehicleIds = customerVehicles.map(v => v.id);

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

    const openEditCustomer = (c: Customer, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setEditingCustomer(c);
        setCustomerForm({ 
            name: c.name, 
            phone: c.phone, 
            email: c.email || '', 
            address: c.address || '' 
        });
        setIsCustomerModalOpen(true);
    };

    const openEditVehicle = (v: Vehicle, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setEditingVehicle(v);
        setVehicleForm({
            make: v.make,
            model: v.model,
            year: v.year,
            license_plate: v.license_plate,
            color: v.color || '',
            vin: v.vin || ''
        });
        setIsVehicleModalOpen(true);
    };

    const filteredCustomers = customers.filter(c => {
        const matchesName = c.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesPhone = c.phone.includes(searchTerm);
        
        // Search in their vehicles too
        const customerVehicles = vehicles.filter(v => v.customer_id === c.id);
        const matchesVehicle = customerVehicles.some(v => 
            v.make.toLowerCase().includes(searchTerm.toLowerCase()) || 
            v.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
            v.license_plate.toLowerCase().includes(searchTerm.toLowerCase())
        );

        return matchesName || matchesPhone || matchesVehicle;
    });

    const handleDeleteVehicle = async (vehicleId: string) => {
        const confirmText = prompt("WARNING: This will permanently delete this vehicle and all its job history.\n\nType 'delete' to confirm:");
        
        if (confirmText?.toLowerCase() === 'delete') {
            const { error } = await supabase.from('vehicles').delete().eq('id', vehicleId);
            if (error) {
                alert("Error deleting vehicle: " + error.message);
            } else {
                alert("Vehicle deleted.");
                fetchData(); // Changed from fetchCustomers() to fetchData()
                setSelectedCustomer(null); // Close modal
            }
        } else if (confirmText !== null) {
            alert("Deletion cancelled. You must type 'delete'.");
        }
    };

    return (
        <div className="h-[calc(100vh-100px)] flex flex-col">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Customers</h1>
                    <p className="text-slate-400">Manage client profiles and history.</p>
                </div>
                <div className="flex gap-4">
                    <button onClick={fetchData} className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors">
                        <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button 
                        onClick={() => {
                            setEditingCustomer(null);
                            setCustomerForm({ name: '', phone: '', email: '', address: '' });
                            setIsCustomerModalOpen(true);
                        }}
                        className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-cyan-500/20"
                    >
                        <Plus size={20} /> New Customer
                    </button>
                </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-6">
                <div className="relative">
                    <Search className="absolute left-3 top-3 text-slate-500" size={20} />
                    <input 
                        type="text" 
                        placeholder="Search by Name, Phone, Car Model or Plate..." 
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 text-white focus:outline-none focus:border-cyan-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pb-4">
                {filteredCustomers.map(customer => (
                    <div 
                        key={customer.id} 
                        onClick={() => openEditCustomer(customer)}
                        className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 hover:border-cyan-500/30 hover:bg-slate-800/80 transition-all group cursor-pointer relative"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors">{customer.name}</h3>
                                <div className="flex items-center gap-2 text-slate-400 text-sm mt-1">
                                    <Phone size={14} /> {customer.phone}
                                </div>
                                {customer.email && (
                                    <div className="flex items-center gap-2 text-slate-400 text-sm mt-1">
                                        <Mail size={14} /> {customer.email}
                                    </div>
                                )}
                            </div>
                            
                            {/* Actions */}
                            <div className="flex gap-2">
                                {/* Only allow history view if NOT a technician, or if role is admin/manager/accountant */}
                                {profile?.role !== 'technician' && (
                                    <button onClick={(e) => handleViewHistory(customer, e)} className="p-2 bg-slate-800 hover:bg-purple-900 text-purple-400 rounded-lg transition-colors z-10" title="View History">
                                        <History size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                        
                        <div className="pt-4 border-t border-slate-800 space-y-2">
                             <div className="flex justify-between items-center bg-slate-950/50 p-2 rounded-lg">
                                <span className="text-xs font-bold text-slate-500 uppercase">Vehicles</span>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setSelectedCustomer(customer); setEditingVehicle(null); setVehicleForm({make:'',model:'',year:'',license_plate:'',color:'',vin:''}); setIsVehicleModalOpen(true); }}
                                    className="text-xs bg-slate-800 hover:bg-cyan-900 text-cyan-400 px-2 py-1 rounded transition-colors"
                                 >
                                    + Add
                                 </button>
                             </div>
                                                          <div className="space-y-2">
                                        {vehicles.filter(v => v.customer_id === customer.id).map(v => (
                                            <div key={v.id} className="bg-slate-800 p-3 rounded-lg border border-slate-700 flex justify-between items-center group">
                                                <div>
                                                    <div className="font-bold text-cyan-400">{v.license_plate}</div>
                                                    <div className="text-sm text-slate-400">{v.make} {v.model} ({v.year})</div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={(e) => openEditVehicle(v, e)} className="p-2 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors">
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteVehicle(v.id); }} className="p-2 hover:bg-red-900/30 rounded text-slate-600 hover:text-red-400 transition-colors" title="Delete Vehicle">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                             {vehicles.filter(v => v.customer_id === customer.id).length === 0 && (
                                 <p className="text-xs text-slate-600 italic pl-2">No vehicles.</p>
                             )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Edit/Add Customer Modal */}
            <Modal isOpen={isCustomerModalOpen} onClose={() => setIsCustomerModalOpen(false)} title={editingCustomer ? "Edit Customer" : "New Customer"}>
                <form onSubmit={handleSaveCustomer} className="space-y-4">
                    <input required placeholder="Full Name" value={customerForm.name} onChange={e => setCustomerForm({...customerForm, name: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white" />
                    <input required placeholder="Phone Number" value={customerForm.phone} onChange={e => setCustomerForm({...customerForm, phone: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white" />
                    <input type="email" placeholder="Email (Optional)" value={customerForm.email} onChange={e => setCustomerForm({...customerForm, email: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white" />
                    <textarea placeholder="Address (Optional)" value={customerForm.address} onChange={e => setCustomerForm({...customerForm, address: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white" />
                    <button type="submit" className="w-full bg-cyan-600 text-white py-2 rounded-lg font-bold">Save Customer</button>
                </form>
            </Modal>

            {/* Add/Edit Vehicle Modal */}
            <Modal isOpen={isVehicleModalOpen} onClose={() => setIsVehicleModalOpen(false)} title={editingVehicle ? "Edit Vehicle" : `Add Vehicle for ${selectedCustomer?.name}`}>
                <form onSubmit={handleSaveVehicle} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <input required placeholder="Make (e.g. Mazda)" value={vehicleForm.make} onChange={e => setVehicleForm({...vehicleForm, make: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white" />
                        <input required placeholder="Model (e.g. Axela)" value={vehicleForm.model} onChange={e => setVehicleForm({...vehicleForm, model: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <input required placeholder="Year" value={vehicleForm.year} onChange={e => setVehicleForm({...vehicleForm, year: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white" />
                        <input required placeholder="License Plate" value={vehicleForm.license_plate} onChange={e => setVehicleForm({...vehicleForm, license_plate: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white" />
                    </div>
                    <input placeholder="Color" value={vehicleForm.color} onChange={e => setVehicleForm({...vehicleForm, color: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white" />
                    <button type="submit" className="w-full bg-cyan-600 text-white py-2 rounded-lg font-bold">
                        {editingVehicle ? 'Update Vehicle' : 'Add Vehicle'}
                    </button>
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
