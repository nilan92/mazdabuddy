import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Plus, Trash2, Clock, CheckCircle, Package, User, Hash, Archive, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { JobCard, JobPart, Part, JobLabor } from '../types';
import { generateDiagnosis } from '../lib/ai';

interface JobDetailsProps {
    jobId: string;
    onClose: () => void;
    onUpdate: () => void;
}

export const JobDetails = ({ jobId, onClose, onUpdate }: JobDetailsProps) => {
    const { profile } = useAuth();
    const [job, setJob] = useState<JobCard | null>(null);
    const [jobParts, setJobParts] = useState<JobPart[]>([]);
    const [jobLabor, setJobLabor] = useState<JobLabor[]>([]);
    const [allParts, setAllParts] = useState<Part[]>([]);
    const [profiles, setProfiles] = useState<{id: string, full_name: string}[]>([]);
    const [activeTab, setActiveTab] = useState<'details' | 'parts' | 'labor'>('details');

    // Forms
    const [mileage, setMileage] = useState('');
    const [techNotes, setTechNotes] = useState('');
    const [status, setStatus] = useState<string>('');
    const [assignedTech, setAssignedTech] = useState<string>('');
    const [estimatedHours, setEstimatedHours] = useState<string>('');

    const [partForm, setPartForm] = useState({ 
        part_id: '', 
        quantity: 1, 
        is_custom: false, 
        custom_name: '', 
        custom_price_lkr: '',
        custom_cost_lkr: '' 
    });
    const [laborForm, setLaborForm] = useState({ description: '', hours: '', hourly_rate_lkr: '5000' }); // Default 5000

    // AI State
    const [aiKey, setAiKey] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);

    const fetchJobDetails = async (signal?: AbortSignal) => {
        try {
            // Job Info
            const { data: jobData } = await supabase
                .from('job_cards')
                // @ts-ignore
                .select('*, vehicles(*)')
                .eq('id', jobId)
                .abortSignal(signal!)
                .single();

            if (signal?.aborted) return;

            if (jobData) {
                setJob(jobData as JobCard);
                setMileage(jobData.mileage?.toString() || '');
                setTechNotes(jobData.technician_notes || '');
                setStatus(jobData.status);
                setAssignedTech(jobData.assigned_technician_id || '');
                setEstimatedHours(jobData.estimated_hours?.toString() || '');
            }

            // Parts
            const { data: partsData } = await supabase
                .from('job_parts')
                // @ts-ignore
                .select('*, parts(*)')
                .eq('job_id', jobId)
                .abortSignal(signal!);
            
            if (signal?.aborted) return;
            if (partsData) setJobParts(partsData as JobPart[]);

            // Labor
            const { data: laborData } = await supabase
                .from('job_labor')
                .select('*')
                .eq('job_id', jobId)
                .abortSignal(signal!);
            
            if (signal?.aborted) return;
            if (laborData) setJobLabor(laborData);

            // Inventory list (for dropdown)
            const { data: invData } = await supabase
                .from('parts')
                .select('*')
                .abortSignal(signal!);
            
            if (signal?.aborted) return;
            if (invData) setAllParts(invData);

            // Profiles (for assignment)
            const { data: profileData } = await supabase
                .from('profiles')
                .select('id, full_name')
                .abortSignal(signal!);
            
            if (signal?.aborted) return;
            if(profileData) setProfiles(profileData);
            
            // 5. Tenant Settings (Branding, AI & Labor Defaults)
            if (profile?.tenant_id) {
                const { data: tenantData } = await supabase
                    .from('tenants')
                    .select('ai_api_key, brand_color, default_labor_rate')
                    .eq('id', profile.tenant_id)
                    .single();
                
                if (tenantData?.ai_api_key) setAiKey(tenantData.ai_api_key);
                if (tenantData?.default_labor_rate) {
                    setLaborForm(prev => ({ ...prev, hourly_rate_lkr: tenantData.default_labor_rate.toString() }));
                }
            }
        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error('Error fetching job details:', error);
            }
        }
    };

    useEffect(() => {
        const controller = new AbortController();
        fetchJobDetails(controller.signal);
        
        return () => {
            controller.abort();
        };
    }, [jobId]);

    const handleUpdateJob = async () => {
        if (!job) return;

        const now = new Date();
        const updates: any = {
            mileage: mileage ? parseInt(mileage) : null,
            technician_notes: techNotes,
            status,
            assigned_technician_id: assignedTech || null,
            estimated_hours: estimatedHours ? parseFloat(estimatedHours) : 0
        };

        // --- Efficiency Tracking Logic (Start/Stop Timer) ---
        // 1. Moving INTO In Progress (Start Timer)
        if (status === 'in_progress' && job.status !== 'in_progress') {
            updates.last_start_time = now.toISOString();
            if (!job.started_at) updates.started_at = now.toISOString(); // First start
        } 
        
        // 2. Moving OUT of In Progress (Stop Timer)
        if (job.status === 'in_progress' && status !== 'in_progress') {
            if (job.last_start_time) {
                const start = new Date(job.last_start_time);
                const diffMinutes = Math.round((now.getTime() - start.getTime()) / 1000 / 60);
                const currentTotal = job.total_labor_time || 0;
                updates.total_labor_time = currentTotal + diffMinutes;
                updates.last_start_time = null; // Reset timer
            }
        }

        // --- NEW LOGIC START: Generate Invoice on Completion ---
        if (status === 'completed' && job?.status !== 'completed') {
            updates.completed_at = now.toISOString();
            // Force stop timer if not already handled by "Moving OUT" logic (which it is, but safe to be sure)
            
            // 1. Calculate Parts Total
            // (Note: jobParts comes from your existing state in this file)
            const partsTotal = jobParts.reduce((sum: number, p: any) => 
                sum + (p.quantity * (p.price_at_time_lkr || 0)), 0
            );

            // 2. Calculate Labor Total
            const laborTotal = jobLabor.reduce((sum: number, l: any) => 
                sum + (Number(l.hours) * (l.hourly_rate_lkr || 1500)), 0
            );

            const grandTotal = partsTotal + laborTotal;

            // 3. Check if invoice already exists to prevent duplicates
            const { data: existingInv } = await supabase
                .from('invoices')
                .select('id')
                .eq('job_id', jobId)
                .single();

            if (!existingInv) {
                // 4. Create the Real Invoice Record
                const { error: invError } = await supabase.from('invoices').insert({
                    job_id: jobId,
                    tenant_id: job.tenant_id,
                    subtotal_lkr: grandTotal,
                    tax_lkr: 0,
                    discount_lkr: 0,
                    total_amount_lkr: grandTotal,
                    created_at: now.toISOString(),
                    status: 'Unpaid' 
                });

                if (invError) {
                    alert("Warning: Job marked completed, but Invoice creation failed. " + invError.message);
                    return; 
                }
            }
        } 
        else if (status !== 'completed' && job?.status === 'completed') {
            updates.completed_at = null;
        }
        // --- NEW LOGIC END ---

        const { error } = await supabase.from('job_cards').update(updates).eq('id', jobId);
        
        if (error) {
            alert(error.message);
        } else {
            onUpdate();
            // Optimistic update for UI
            setJob(prev => prev ? { ...prev, ...updates } : null);
            if (status === 'completed' && job?.status !== 'completed') {
                alert("Job Completed & Invoice Generated!");
            } else {
                alert("Job Updated Successfully!");
            }
        }
    };

    const handleArchive = async () => {
        if(!confirm("Are you sure? Archived jobs will be hidden from the board.")) return;
        const { error } = await supabase.from('job_cards').update({ archived: true }).eq('id', jobId);
        if (error) alert(error.message);
        else {
            onUpdate();
            onClose();
        }
    };

    const handleAddPart = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // 1. Handle Custom Parts (No stock tracking)
        if (partForm.is_custom) {
            const cost = parseFloat(partForm.custom_cost_lkr) || 0;
            const price = parseFloat(partForm.custom_price_lkr) || 0;
            
            const { error } = await supabase.from('job_parts').insert({
                job_id: jobId,
                tenant_id: job?.tenant_id, // Added tenant_id
                part_id: null,
                quantity: partForm.quantity,
                price_at_time_lkr: price,
                cost_at_time_lkr: cost,
                is_custom: true,
                custom_name: partForm.custom_name
            });
            
            if (error) {
                alert(error.message);
            } else {
                fetchJobDetails();
                setPartForm({ part_id: '', quantity: 1, is_custom: false, custom_name: '', custom_price_lkr: '', custom_cost_lkr: '' });
            }
            return;
        }

        // 2. Handle Inventory Parts (Secure Transaction)
        // This calls the SQL function we created in Phase 1
        const { data, error } = await supabase.rpc('add_job_part_transaction', {
            p_job_id: jobId,
            p_part_id: partForm.part_id,
            p_quantity: partForm.quantity,
            p_user_id: profile?.id
        });

        if (error) {
            console.error(error);
            alert("Transaction failed: " + error.message);
        } else if (data && !data.success) {
            alert("Error: " + data.message); // Will show "Insufficient stock available"
        } else {
            fetchJobDetails(); // Refresh UI
            setPartForm({ part_id: '', quantity: 1, is_custom: false, custom_name: '', custom_price_lkr: '', custom_cost_lkr: '' });
        }
    };

    const handleAddLabor = async (e: React.FormEvent) => {
        e.preventDefault();
        const { error } = await supabase.from('job_labor').insert({
            job_id: jobId,
            tenant_id: job?.tenant_id, // Added tenant_id
            hours: parseFloat(laborForm.hours),
            description: laborForm.description,
            hourly_rate_lkr: parseFloat(laborForm.hourly_rate_lkr)
        });
        if(!error) {
            fetchJobDetails();
            setLaborForm(prev => ({...prev, description: '', hours: ''}));
        } else {
            alert(error.message);
        }
    };

    const handleRemovePart = async (id: string) => {
        if(!confirm("Remove this part? Stock will be returned to inventory.")) return;

        // Calls the secure SQL function that restores stock automatically
        const { error } = await supabase.rpc('remove_job_part_transaction', {
            p_job_part_id: id
        });

        if (error) alert("Error removing part: " + error.message);
        else fetchJobDetails();
    };
    
    const handleRemoveLabor = async (id: string) => {
        await supabase.from('job_labor').delete().eq('id', id);
        fetchJobDetails();
    };

    const handleAiAssist = async () => {
        if (!aiKey) {
            alert("AI API Key not configured in Settings.");
            return;
        }
        setIsAiLoading(true);
        try {
            const vehicleInfo = `${job?.vehicles?.make} ${job?.vehicles?.model} (${job?.vehicles?.license_plate})`;
            const suggestion = await generateDiagnosis(aiKey, vehicleInfo, job?.description || '', techNotes);
            
            const newNotes = techNotes ? `${techNotes}\n\n--- AI Suggestion ---\n${suggestion}` : `--- AI Suggestion ---\n${suggestion}`;
            setTechNotes(newNotes);
        } catch (e) {
            alert("AI Error: Failed to generate diagnosis.");
        } finally {
            setIsAiLoading(false);
        }
    };

    // Calculations
    const totalParts = jobParts.reduce((sum, p) => sum + (p.price_at_time_lkr * p.quantity), 0);
    const totalLabor = jobLabor.reduce((sum, l) => sum + (l.hourly_rate_lkr * l.hours), 0);
    // const totalHours = jobLabor.reduce((sum, l) => sum + l.hours, 0); // Removed unused
    // const estHours = parseFloat(estimatedHours) || 0; // Removed unused
    
    // Efficiency
    // Efficiency - Logic moved to inline render


    if (!job) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose} />
                <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-0 md:pl-10">
                    <div className="pointer-events-auto w-screen max-w-lg transform transition-all">
                        <div className="flex h-[100dvh] flex-col bg-slate-900 border-l border-slate-800 shadow-2xl">
                            
                            {/* Header */}
                            <div className="px-4 py-3 md:px-6 md:py-4 border-b border-slate-800 flex items-start justify-between bg-slate-950">
                                <div>
                                    <h2 className="text-lg md:text-xl font-black text-white">{job.vehicles?.make} {job.vehicles?.model}</h2>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded font-mono">{job.vehicles?.license_plate}</span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold
                                            ${job.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 
                                              job.status === 'in_progress' ? 'bg-blue-500/10 text-blue-400' : 
                                              'bg-slate-700 text-slate-400'}`}>
                                            {job.status.replace('_', ' ')}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                     {job.status === 'completed' && !job.archived && (
                                         <button onClick={handleArchive} className="p-2 text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 rounded-lg transition-colors" title="Archive Job">
                                             <Archive size={18} />
                                         </button>
                                     )}
                                     <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Tabs */}
                            <div className="flex border-b border-slate-800 bg-slate-900 z-10 sticky top-0">
                                <button onClick={() => setActiveTab('details')} className={`flex-1 py-3 text-xs md:text-sm font-bold border-b-2 transition-colors ${activeTab === 'details' ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-white'}`}>Details</button>
                                <button onClick={() => setActiveTab('parts')} className={`flex-1 py-3 text-xs md:text-sm font-bold border-b-2 transition-colors ${activeTab === 'parts' ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-white'}`}>Parts</button>
                                <button onClick={() => setActiveTab('labor')} className={`flex-1 py-3 text-xs md:text-sm font-bold border-b-2 transition-colors ${activeTab === 'labor' ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-white'}`}>Labor</button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-900 pb-40">
                                {activeTab === 'details' && (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Status</label>
                                                <select value={status} onChange={e => setStatus(e.target.value)} className="w-full bg-slate-800 text-white p-2 text-sm rounded border border-slate-700">
                                                    <option value="pending">Pending</option>
                                                    <option value="in_progress">In Progress</option>
                                                    <option value="waiting_parts">Waiting for Parts</option>
                                                    <option value="completed">Completed</option>
                                                    <option value="cancelled">Cancelled</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Technician</label>
                                                <div className="relative">
                                                    <select value={assignedTech} onChange={e => setAssignedTech(e.target.value)} className="w-full bg-slate-800 text-white p-2 pl-8 text-sm rounded border border-slate-700">
                                                        <option value="">Unassigned</option>
                                                        {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                                                    </select>
                                                    <User size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                             <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Mileage</label>
                                                <div className="relative">
                                                     <input type="number" onFocus={(e) => e.target.select()} value={mileage} onChange={e => setMileage(e.target.value)} className="w-full bg-slate-800 text-white p-2 pl-8 text-sm rounded border border-slate-700" placeholder="0" />
                                                     <Hash size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                                                </div>
                                             </div>
                                             <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Est. Hours</label>
                                                <div className="relative">
                                                     <input type="number" onFocus={(e) => e.target.select()} value={estimatedHours} onChange={e => setEstimatedHours(e.target.value)} className="w-full bg-slate-800 text-white p-2 pl-8 text-sm rounded border border-slate-700" placeholder="0" />
                                                     <Clock size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                                                </div>
                                             </div>
                                        </div>

                                        {(estimatedHours || job.total_labor_time) && (
                                            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-800">
                                                <div className="flex justify-between items-center mb-2">
                                                    <h4 className="text-[10px] font-bold text-slate-500 uppercase">Efficiency Tracking</h4>
                                                    {job.status === 'in_progress' && (
                                                        <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded animate-pulse font-bold flex items-center gap-1">
                                                            <Clock size={10} /> REC
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex justify-between items-end">
                                                    <div>
                                                        <div className="text-xs text-slate-400">Actual vs Est.</div>
                                                        <div className="text-xl font-bold text-white">
                                                            {job.total_labor_time ? (job.total_labor_time / 60).toFixed(1) : '0.0'} 
                                                            <span className="text-xs text-slate-500 font-normal"> / {parseFloat(estimatedHours || '0').toFixed(1)} hrs</span>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                         {(job.total_labor_time && estimatedHours) ? (
                                                            (job.total_labor_time / 60) > parseFloat(estimatedHours) ? 
                                                                <span className="text-red-400 text-[10px] flex items-center gap-1"><AlertCircle size={10}/> Over Budget</span> : 
                                                                <span className="text-emerald-400 text-[10px] flex items-center gap-1"><CheckCircle size={10}/> Efficient</span>
                                                         ) : <span className="text-slate-500 text-[10px]">-</span>}
                                                    </div>
                                                </div>
                                                <div className="w-full bg-slate-700 h-1.5 mt-3 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full rounded-full ${(job.total_labor_time && estimatedHours && (job.total_labor_time / 60) > parseFloat(estimatedHours)) ? 'bg-red-500' : 'bg-emerald-500'}`} 
                                                        style={{width: `${Math.min(100, (( (job.total_labor_time || 0) / 60 ) / (parseFloat(estimatedHours || '1'))) * 100)}%`}} 
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Description</label>
                                            <textarea rows={2} readOnly value={job.description} className="w-full bg-slate-900 text-slate-400 p-3 text-sm rounded border border-slate-800 focus:outline-none" />
                                        </div>

                                        <div>
                                            <div className="flex justify-between items-center mb-1">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase">Technician Notes</label>
                                                {aiKey && (
                                                    <button 
                                                        onClick={handleAiAssist} 
                                                        disabled={isAiLoading}
                                                        className="text-[10px] bg-purple-500/10 text-purple-400 px-2 py-1 rounded hover:bg-purple-500/20 disabled:opacity-50 flex items-center gap-1 transition-colors"
                                                    >
                                                        {isAiLoading ? 'Thinking...' : '✨ AI Assist'}
                                                    </button>
                                                )}
                                            </div>
                                            <textarea rows={4} value={techNotes} onChange={e => setTechNotes(e.target.value)} className="w-full bg-slate-800 text-white p-3 text-sm rounded border border-slate-700 focus:border-brand focus:outline-none" placeholder="Add diagnosis and repair notes..." />
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'parts' && (
                                    <div className="space-y-6">
                                        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                                            <div className="flex justify-between items-center mb-4">
                                                <h4 className="font-bold text-white text-sm flex items-center gap-2"><Plus size={16} className="text-brand"/> Add Part</h4>
                                                <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-700">
                                                    <button 
                                                        onClick={() => setPartForm({...partForm, is_custom: false})}
                                                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${!partForm.is_custom ? 'bg-cyan-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                                                    >Inventory</button>
                                                    <button 
                                                        onClick={() => setPartForm({...partForm, is_custom: true})}
                                                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${partForm.is_custom ? 'bg-cyan-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                                                    >Custom</button>
                                                </div>
                                            </div>

                                            <form onSubmit={handleAddPart} className="space-y-3">
                                                {!partForm.is_custom ? (
                                                    <div className="flex gap-2 items-center">
                                                        <div className="flex-1 min-w-0">
                                                            <select required value={partForm.part_id} onChange={e => setPartForm({...partForm, part_id: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm truncate">
                                                                <option value="">Select Part...</option>
                                                                {allParts.map(p => <option key={p.id} value={p.id}>{p.name} ({p.stock_quantity} in stock)</option>)}
                                                            </select>
                                                        </div>
                                                        <input type="number" min="1" onFocus={(e) => e.target.select()} value={partForm.quantity} onChange={e => setPartForm({...partForm, quantity: parseInt(e.target.value)})} className="w-14 bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm flex-shrink-0" />
                                                        <button type="submit" className="btn-brand px-3 py-2 rounded font-bold text-sm flex-shrink-0">Add</button>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        <div className="flex gap-2">
                                                            <input required placeholder="Custom Part Name (e.g. Engine Oil 4L)" value={partForm.custom_name} onChange={e => setPartForm({...partForm, custom_name: e.target.value})} className="flex-1 bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm" />
                                                        </div>
                                                        <div className="flex gap-2 items-center">
                                                            <div className="flex-1 grid grid-cols-2 gap-2">
                                                                <div className="relative">
                                                                    <span className="absolute left-2 top-2 text-[10px] text-slate-500">Sell Price</span>
                                                                    <input required type="number" onFocus={(e) => e.target.select()} placeholder="Sell Price" value={partForm.custom_price_lkr} onChange={e => setPartForm({...partForm, custom_price_lkr: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded p-2 pl-14 text-white text-xs font-mono" />
                                                                </div>
                                                                <div className="relative">
                                                                    <span className="absolute left-2 top-2 text-[10px] text-slate-500">Buy Cost</span>
                                                                    <input required type="number" onFocus={(e) => e.target.select()} placeholder="Buy Cost" value={partForm.custom_cost_lkr} onChange={e => setPartForm({...partForm, custom_cost_lkr: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded p-2 pl-12 text-white text-xs font-mono" />
                                                                </div>
                                                            </div>
                                                            <input type="number" min="1" onFocus={(e) => e.target.select()} value={partForm.quantity} onChange={e => setPartForm({...partForm, quantity: parseInt(e.target.value)})} className="w-12 bg-slate-900 border border-slate-600 rounded p-2 text-white text-xs" />
                                                            <button type="submit" className="btn-brand px-3 py-2 rounded font-bold text-sm whitespace-nowrap">Add</button>
                                                        </div>
                                                    </div>
                                                )}
                                            </form>
                                        </div>
                                        {/* Parts List */}
                                        <div className="space-y-2">
                                            {jobParts.map(part => (
                                                <div key={part.id} className="flex justify-between items-center bg-slate-800/50 p-3 rounded-lg border border-slate-800">
                                                    <div className="flex items-center gap-3">
                                                        <Package size={16} className={part.is_custom ? "text-amber-400" : "text-purple-400"} />
                                                        <div>
                                                            <div className="font-medium text-white text-sm">
                                                                {part.is_custom ? part.custom_name : part.parts?.name}
                                                                {part.is_custom && <span className="ml-2 text-[8px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1 rounded uppercase">Custom</span>}
                                                            </div>
                                                            <div className="text-xs text-slate-500">{part.quantity} x LKR {part.price_at_time_lkr.toLocaleString()}</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-mono text-white text-sm">{(part.price_at_time_lkr * part.quantity).toLocaleString()}</span>
                                                        <button onClick={() => handleRemovePart(part.id)} className="text-slate-600 hover:text-red-400"><Trash2 size={14}/></button>
                                                    </div>
                                                </div>
                                            ))}
                                            {jobParts.length === 0 && <div className="text-center text-slate-600 py-4 italic text-sm">No parts added.</div>}
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'labor' && (
                                     <div className="space-y-6">
                                        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                                            <h4 className="font-bold text-white mb-3 text-sm flex items-center gap-2"><Plus size={16} className="text-brand"/> Add Labor</h4>
                                            <form onSubmit={handleAddLabor} className="space-y-3">
                                                <div className="flex gap-2">
                                                    <input required placeholder="Description" value={laborForm.description} onChange={e => setLaborForm({...laborForm, description: e.target.value})} className="flex-1 bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm" />
                                                    <input required type="number" step="0.5" onFocus={(e) => e.target.select()} placeholder="Hrs" value={laborForm.hours} onChange={e => setLaborForm({...laborForm, hours: e.target.value})} className="w-16 bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm" />
                                                </div>
                                                <div className="flex gap-2 items-center">
                                                     <div className="flex-1 relative">
                                                        <span className="absolute left-2 top-2 text-[10px] text-slate-500">LKR</span>
                                                        <input required type="number" onFocus={(e) => e.target.select()} value={laborForm.hourly_rate_lkr} onChange={e => setLaborForm({...laborForm, hourly_rate_lkr: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded p-2 pl-8 text-white text-sm font-mono" />
                                                     </div>
                                                     <button type="submit" className="btn-brand px-4 py-2 rounded font-bold text-sm">Add</button>
                                                </div>
                                            </form>
                                        </div>
                                        {/* Labor List */}
                                        <div className="space-y-2">
                                            {jobLabor.map(labor => (
                                                <div key={labor.id} className="flex justify-between items-center bg-slate-800/50 p-3 rounded-lg border border-slate-800">
                                                    <div>
                                                        <div className="font-medium text-white text-sm">{labor.description}</div>
                                                        <div className="text-xs text-slate-500">{labor.hours} hrs @ {labor.hourly_rate_lkr}</div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-mono text-white text-sm">{(labor.hourly_rate_lkr * labor.hours).toLocaleString()}</span>
                                                        <button onClick={() => handleRemoveLabor(labor.id)} className="text-slate-600 hover:text-red-400"><Trash2 size={14}/></button>
                                                    </div>
                                                </div>
                                            ))}
                                            {jobLabor.length === 0 && <div className="text-center text-slate-600 py-4 italic text-sm">No labor entries.</div>}
                                        </div>
                                     </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-4 bg-slate-950 border-t border-slate-800 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                                <div className="flex justify-between items-center mb-2">
                                    <div className="text-slate-400 text-xs font-bold uppercase">Estimated Total</div>
                                    <div className="text-xl font-black text-brand font-mono">
                                        LKR {(totalParts + totalLabor).toLocaleString()}
                                    </div>
                                </div>
                                <button onClick={handleUpdateJob} className="w-full btn-brand py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 text-sm">
                                    <Save size={18} /> Update Job
                                </button>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
