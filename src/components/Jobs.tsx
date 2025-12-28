import { useState, useEffect } from 'react';
import { Plus, Search, RefreshCcw, Archive, UserCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { JobDetails } from './JobDetails'; // New Component
import { Modal } from './Modal';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { JobCard, Vehicle } from '../types';

export const Jobs = () => {
    const { profile } = useAuth();
    const queryClient = useQueryClient();
    
    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    const [showAllJobs, setShowAllJobs] = useState(true);

    // Modals
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    const [isNewJobModalOpen, setIsNewJobModalOpen] = useState(false);
    const [intakeMode, setIntakeMode] = useState<'SELECT' | 'EXPRESS'>('SELECT');
    
    // New Job Form
    const [newJobForm, setNewJobForm] = useState({ 
        vehicle_id: '', 
        description: '',
        // Express Fields
        customerName: '',
        customerPhone: '',
        vehicleMake: '',
        vehicleModel: '',
        licensePlate: ''
    });
    const [vehicleSearchTerm, setVehicleSearchTerm] = useState('');
    const [showVehicleResults, setShowVehicleResults] = useState(false);

    const { data: jobs = [], isLoading: jobsLoading } = useQuery({
        queryKey: ['jobs'],
        queryFn: async () => {
    const { data } = await supabase
        .from('job_cards')
        // @ts-ignore
        .select('*, vehicles(id, make, model, license_plate), profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(50); // <--- Added Limit to prevent crashing
    
    return data as JobCard[] || [];
}
    });

    const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery({
        queryKey: ['vehicles'],
        queryFn: async () => {
            const { data } = await supabase
                .from('vehicles')
                .select('*, customers(name)');
            return data as Vehicle[] || [];
        }
    });

    const loading = jobsLoading || vehiclesLoading;

    const fetchJobs = () => {
        queryClient.invalidateQueries({ queryKey: ['jobs'] });
        queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    };


    const location = useLocation();

    // Initial role check & SmartScan redirect
    useEffect(() => {
        if (profile?.role === 'technician') {
             setShowAllJobs(false);
        }

        const state = location.state as any;
        if (state?.vehicleId) {
            setNewJobForm(prev => ({ ...prev, vehicle_id: state.vehicleId }));
            setVehicleSearchTerm(state.initialPlate || '');
            setIsNewJobModalOpen(true);
        }
    }, [profile, location]);

    const handleCreateJob = async (e: React.FormEvent) => {
        e.preventDefault();
        
        try {
            let finalVehicleId = newJobForm.vehicle_id;

            // Handle Express Intake (Customer -> Vehicle -> Job)
            if (intakeMode === 'EXPRESS') {
                // 1. Create Customer
                const { data: customerData, error: custError } = await supabase
                    .from('customers')
                    .insert([{ 
                        name: newJobForm.customerName, 
                        phone: newJobForm.customerPhone,
                        tenant_id: profile?.tenant_id
                    }])
                    .select()
                    .single();
                
                if (custError) throw custError;

                // 2. Create Vehicle
                const { data: vehicleData, error: vehError } = await supabase
                    .from('vehicles')
                    .insert([{
                        customer_id: customerData.id,
                        make: newJobForm.vehicleMake,
                        model: newJobForm.vehicleModel,
                        license_plate: newJobForm.licensePlate.toUpperCase(),
                        tenant_id: profile?.tenant_id
                    }])
                    .select()
                    .single();
                
                if (vehError) throw vehError;
                finalVehicleId = vehicleData.id;
            }

            if (!finalVehicleId) throw new Error("Please select or add a vehicle.");

            // 3. Create Job Card
            const { error: jobError } = await supabase.from('job_cards').insert([{
                vehicle_id: finalVehicleId,
                description: newJobForm.description,
                status: 'pending',
                assigned_technician_id: profile?.id,
                tenant_id: profile?.tenant_id
            }]);

            if (jobError) throw jobError;

            setIsNewJobModalOpen(false);
            setNewJobForm({ 
                vehicle_id: '', 
                description: '',
                customerName: '',
                customerPhone: '',
                vehicleMake: '',
                vehicleModel: '',
                licensePlate: ''
            });
            setVehicleSearchTerm('');
            fetchJobs();
        } catch (error: any) {
            alert(error.message);
        }
    };

    const handleDragStart = (e: React.DragEvent, id: string) => {
        e.dataTransfer.setData('jobId', id);
    };

    const handleDrop = async (e: React.DragEvent, status: string) => {
        const id = e.dataTransfer.getData('jobId');
        await supabase.from('job_cards').update({ status }).eq('id', id);
        fetchJobs(); // Sync full data via React Query invalidate
    };

    const handleDragOver = (e: React.DragEvent) => e.preventDefault();

    const filteredJobs = jobs.filter(job => {
        const matchesSearch = job.vehicles?.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              job.vehicles?.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              job.vehicles?.license_plate.toLowerCase().includes(searchTerm.toLowerCase());
                              
        const matchesArchive = showArchived ? job.archived : !job.archived;
        
        // Role Filtering
        let matchesRole = true;
        if (!showAllJobs && profile?.role === 'technician') {
             matchesRole = job.assigned_technician_id === profile.id;
        }

        return matchesSearch && matchesArchive && matchesRole;
    });

    const columns = [
        { id: 'pending', label: 'Pending', color: 'bg-slate-800 border-slate-700' },
        { id: 'in_progress', label: 'In Progress', color: 'bg-blue-900/20 border-blue-900/50' },
        { id: 'waiting_parts', label: 'Waiting Parts', color: 'bg-orange-900/20 border-orange-900/50' },
        { id: 'completed', label: 'Completed', color: 'bg-emerald-900/20 border-emerald-900/50' }
    ];

    return (
        <div className="h-[calc(100vh-100px)] flex flex-col">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                     <h1 className="text-3xl font-bold text-white mb-2">Job Board</h1>
                     <p className="text-slate-400">Drag and drop to manage workflow.</p>
                </div>

                <div className="flex flex-wrap gap-3 items-center">
                     {/* Technician Filtering Toggle */}
                     {profile?.role === 'technician' && (
                         <button 
                            onClick={() => setShowAllJobs(!showAllJobs)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${showAllJobs ? 'bg-slate-800 text-slate-400 border-slate-700' : 'active-link'}`}
                         >
                            <UserCheck size={16} /> {showAllJobs ? 'All Jobs' : 'My Jobs'}
                         </button>
                     )}

                     {/* Archive Toggle */}
                     <button 
                        onClick={() => setShowArchived(!showArchived)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${showArchived ? 'bg-amber-900/30 text-amber-400 border-amber-500/50' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
                     >
                        <Archive size={16} /> {showArchived ? 'Archived' : 'Active'}
                     </button>

                     <button onClick={() => fetchJobs()} className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors">
                        <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button onClick={() => setIsNewJobModalOpen(true)} className="flex items-center gap-2 btn-brand px-4 py-2 rounded-lg font-bold shadow-lg">
                        <Plus size={20} /> New Job
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="relative mb-6">
                 <Search className="absolute left-3 top-3 text-slate-500" size={20} />
                 <input 
                    type="text" 
                    placeholder="Search by vehicle or plate..." 
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-10 text-white focus:outline-none focus:border-brand"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                 />
            </div>

            {/* Kanban Board */}
            <div className="flex-1 md:overflow-x-auto overflow-y-auto">
                <div className="flex flex-col md:flex-row gap-6 md:min-w-[1000px] h-auto md:h-full pb-4">
                    {columns.map(col => (
                        <div 
                            key={col.id} 
                            className={`flex-1 rounded-xl border flex flex-col ${col.color}`}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, col.id)}
                        >
                            <div className="p-4 border-b border-white/5 font-bold text-white flex justify-between">
                                {col.label}
                                <span className="bg-white/10 px-2 rounded text-sm">
                                    {filteredJobs.filter(j => j.status === col.id).length}
                                </span>
                            </div>
                            <div className="p-3 space-y-3 flex-1 overflow-y-auto">
                                {filteredJobs.filter(j => j.status === col.id).map(job => (
                                    <div 
                                        key={job.id} 
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, job.id)}
                                        onClick={() => setSelectedJobId(job.id)}
                                        className="bg-slate-900 hover:bg-slate-800 p-4 rounded-lg border border-slate-800 cursor-pointer shadow-sm hover:border-cyan-500/50 transition-all group"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-xs font-mono text-brand bg-brand-soft px-1.5 py-0.5 rounded border border-brand/20">
                                                {job.vehicles?.license_plate}
                                            </span>
                                            {job.assigned_technician_id && (
                                                <div className="text-xs bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                    <UserCheck size={10} /> Assigned
                                                </div>
                                            )}
                                        </div>
                                        <h3 className="font-bold text-white mb-1">{job.vehicles?.make} {job.vehicles?.model}</h3>
                                        <p className="text-sm text-slate-400 line-clamp-2">{job.description}</p>
                                        
                                        <div className="mt-3 flex items-center justify-between text-xs text-slate-500 border-t border-slate-800 pt-2">
                                            <span>{new Date(job.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* New Job Modal */}
            <Modal isOpen={isNewJobModalOpen} onClose={() => setIsNewJobModalOpen(false)} title="Create New Job">
                <div className="flex bg-slate-950 p-1 rounded-xl mb-6 border border-slate-800">
                    <button 
                        onClick={() => setIntakeMode('SELECT')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${intakeMode === 'SELECT' ? 'bg-brand text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        SMART SEARCH
                    </button>
                    <button 
                        onClick={() => setIntakeMode('EXPRESS')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${intakeMode === 'EXPRESS' ? 'bg-brand text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        WALK-IN INTAKE
                    </button>
                </div>

                <form onSubmit={handleCreateJob} className="space-y-4">
                    {intakeMode === 'SELECT' ? (
                        <div className="relative">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Existing Vehicle</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-3 text-slate-500" size={18} />
                                <input 
                                    type="text"
                                    placeholder="Search: Customer, Plate, or Model..."
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 pl-10 text-white focus:border-brand focus:outline-none"
                                    value={vehicleSearchTerm}
                                    onChange={(e) => {
                                        setVehicleSearchTerm(e.target.value);
                                        setShowVehicleResults(true);
                                    }}
                                    onFocus={() => setShowVehicleResults(true)}
                                />
                            </div>
                            
                            {showVehicleResults && vehicleSearchTerm && (
                                <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                    {vehicles
                                        .filter(v => 
                                            v.license_plate.toLowerCase().includes(vehicleSearchTerm.toLowerCase()) ||
                                            v.make.toLowerCase().includes(vehicleSearchTerm.toLowerCase()) ||
                                            v.model.toLowerCase().includes(vehicleSearchTerm.toLowerCase()) ||
                                            v.customers?.name.toLowerCase().includes(vehicleSearchTerm.toLowerCase())
                                        )
                                        .map(v => (
                                            <div 
                                                key={v.id}
                                                onClick={() => {
                                                    setNewJobForm({...newJobForm, vehicle_id: v.id});
                                                    setVehicleSearchTerm(`${v.license_plate} - ${v.make} ${v.model} (${v.customers?.name})`);
                                                    setShowVehicleResults(false);
                                                }}
                                                className="p-3 hover:bg-slate-700 cursor-pointer border-b border-slate-700/50 last:border-0"
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div className="font-bold text-white text-sm">{v.license_plate}</div>
                                                    <div className="text-[10px] bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded font-bold uppercase">{v.customers?.name}</div>
                                                </div>
                                                <div className="text-xs text-slate-400">{v.make} {v.model}</div>
                                            </div>
                                        ))}
                                    {vehicles.filter(v => 
                                        v.license_plate.toLowerCase().includes(vehicleSearchTerm.toLowerCase()) ||
                                        v.make.toLowerCase().includes(vehicleSearchTerm.toLowerCase()) ||
                                        v.model.toLowerCase().includes(vehicleSearchTerm.toLowerCase()) ||
                                        v.customers?.name.toLowerCase().includes(vehicleSearchTerm.toLowerCase())
                                    ).length === 0 && (
                                        <div className="p-4 text-center text-slate-500 text-sm italic">No matching vehicles found</div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4 animate-fade-in">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Customer Name</label>
                                    <input 
                                        required
                                        type="text"
                                        placeholder="Full Name"
                                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-white text-sm focus:border-brand focus:outline-none"
                                        value={newJobForm.customerName}
                                        onChange={(e) => setNewJobForm({...newJobForm, customerName: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Phone Number</label>
                                    <input 
                                        required
                                        type="text"
                                        placeholder="0112..."
                                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-white text-sm focus:border-brand focus:outline-none font-mono"
                                        value={newJobForm.customerPhone}
                                        onChange={(e) => setNewJobForm({...newJobForm, customerPhone: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Make</label>
                                    <input 
                                        required
                                        type="text"
                                        placeholder="Toyota"
                                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-white text-sm focus:border-brand focus:outline-none"
                                        value={newJobForm.vehicleMake}
                                        onChange={(e) => setNewJobForm({...newJobForm, vehicleMake: e.target.value})}
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Model</label>
                                    <input 
                                        required
                                        type="text"
                                        placeholder="Vitz"
                                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-white text-sm focus:border-brand focus:outline-none"
                                        value={newJobForm.vehicleModel}
                                        onChange={(e) => setNewJobForm({...newJobForm, vehicleModel: e.target.value})}
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">License Plate</label>
                                    <input 
                                        required
                                        type="text"
                                        placeholder="WP-XXX..."
                                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-white text-sm focus:border-brand focus:outline-none font-mono uppercase"
                                        value={newJobForm.licensePlate}
                                        onChange={(e) => setNewJobForm({...newJobForm, licensePlate: e.target.value})}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Service Required / Fault Description</label>
                        <textarea 
                            required
                            rows={3}
                            placeholder="Describe the issues reported by the customer..."
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white text-sm focus:border-brand focus:outline-none"
                            value={newJobForm.description}
                            onChange={(e) => setNewJobForm({...newJobForm, description: e.target.value})}
                        />
                    </div>
                    
                    <button type="submit" className="w-full btn-brand py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-all">
                        {intakeMode === 'EXPRESS' ? 'Register & Start Job' : 'Create Job Card'}
                    </button>
                    {intakeMode === 'SELECT' && (
                        <p className="text-[10px] text-center text-slate-500 uppercase font-bold tracking-widest mt-2">
                            New Customer? Switch to <span className="text-brand cursor-pointer font-black" onClick={() => setIntakeMode('EXPRESS')}>Walk-In Intake</span>
                        </p>
                    )}
                </form>
            </Modal>

            {/* Job Details Slide-over */}
            {selectedJobId && (
                <JobDetails 
                    jobId={selectedJobId} 
                    onClose={() => setSelectedJobId(null)} 
                    onUpdate={fetchJobs} 
                />
            )}
        </div>
    );
};
