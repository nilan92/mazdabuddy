import { useState, useEffect } from 'react';
import { Plus, Search, RefreshCcw, Archive, UserCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { JobDetails } from './JobDetails'; // New Component
import { Modal } from './Modal';
import { useAuth } from '../context/AuthContext';
import type { JobCard, Vehicle } from '../types';

export const Jobs = () => {
    const { profile } = useAuth();
    const [jobs, setJobs] = useState<JobCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Filters
    const [showArchived, setShowArchived] = useState(false);
    const [showAllJobs, setShowAllJobs] = useState(true); // Default to all, Tech can toggle

    // Modals
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    const [isNewJobModalOpen, setIsNewJobModalOpen] = useState(false);
    
    // New Job Form
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [newJobForm, setNewJobForm] = useState({ vehicle_id: '', description: '' });

    const fetchJobs = async (signal?: AbortSignal) => {
        setLoading(true);
        try {
            const { data } = await supabase
                .from('job_cards')
                // @ts-ignore
                .select('*, vehicles(id, make, model, license_plate), profiles(full_name)')
                .order('created_at', { ascending: false })
                .abortSignal(signal!);
            
            if (signal?.aborted) return;
            if (data) setJobs(data as JobCard[]);
            
            // Fetch vehicles for dropdown
            const { data: vData } = await supabase
                .from('vehicles')
                .select('*')
                .abortSignal(signal!);
            
            if (signal?.aborted) return;
            if (vData) setVehicles(vData);
        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error('Error fetching jobs:', error);
            }
        } finally {
            if (!signal?.aborted) {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        const controller = new AbortController();
        fetchJobs(controller.signal);
        
        return () => {
            controller.abort();
        };
    }, []);

    // Initial role check
    useEffect(() => {
        if (profile?.role === 'technician') {
             setShowAllJobs(false); // Techs default to "My Jobs"
        }
    }, [profile]);

    const handleCreateJob = async (e: React.FormEvent) => {
        e.preventDefault();
        const { error } = await supabase.from('job_cards').insert([{
            vehicle_id: newJobForm.vehicle_id,
            description: newJobForm.description,
            status: 'pending',
            assigned_technician_id: profile?.id // Auto-assign creator if they are a tech? Optional.
        }]);

        if (error) alert(error.message);
        else {
            setIsNewJobModalOpen(false);
            setNewJobForm({ vehicle_id: '', description: '' });
            fetchJobs();
        }
    };

    const handleDragStart = (e: React.DragEvent, id: string) => {
        e.dataTransfer.setData('jobId', id);
    };

    const handleDrop = async (e: React.DragEvent, status: string) => {
        const id = e.dataTransfer.getData('jobId');
        // Optimistic update
        setJobs(jobs.map(j => j.id === id ? { ...j, status: status as any } : j));
        
        await supabase.from('job_cards').update({ status }).eq('id', id);
        fetchJobs(); // Sync full data
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
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${showAllJobs ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-cyan-900/30 text-cyan-400 border-cyan-500/50'}`}
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
                    <button onClick={() => setIsNewJobModalOpen(true)} className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg font-bold shadow-lg shadow-cyan-500/20">
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
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-10 text-white focus:outline-none focus:border-cyan-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                 />
            </div>

            {/* Kanban Board */}
            <div className="flex-1 overflow-x-auto">
                <div className="flex gap-6 min-w-[1000px] h-full pb-4">
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
                                            <span className="text-xs font-mono text-cyan-500 bg-cyan-950/30 px-1.5 py-0.5 rounded border border-cyan-900/50">
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
                <form onSubmit={handleCreateJob} className="space-y-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Select Vehicle</label>
                        <select 
                            required 
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white"
                            value={newJobForm.vehicle_id}
                            onChange={(e) => setNewJobForm({...newJobForm, vehicle_id: e.target.value})}
                        >
                            <option value="">-- Choose Vehicle --</option>
                            {vehicles.map(v => (
                                <option key={v.id} value={v.id}>{v.license_plate} - {v.make} {v.model}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Issue Description</label>
                        <textarea 
                            required
                            rows={3}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white"
                            value={newJobForm.description}
                            onChange={(e) => setNewJobForm({...newJobForm, description: e.target.value})}
                        />
                    </div>
                    <button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-3 rounded-lg font-bold">Create Job Card</button>
                    <p className="text-xs text-center text-slate-500">Need to add a vehicle? Go to 'Customers' tab first.</p>
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
