import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Trash2, Clock, CheckCircle, Package, User, Hash, Archive, AlertCircle, Smartphone, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { sendSMS, smsTemplates } from '../lib/sms';
import { logAudit } from '../lib/audit';
import { sendPushNotification } from '../lib/push';
import type { JobCard, JobPart, Part, JobLabor } from '../types';
import { generateDiagnosis } from '../lib/ai';
import { ensureInvoiceForJob } from '../lib/invoices';
import { useQueryClient } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import { urlToBase64, fitLogoBox } from '../utils/pdfHelpers';

interface JobDetailsProps {
    jobId: string;
    onClose: () => void;
    onUpdate: () => void;
}

export const JobDetails = ({ jobId, onClose, onUpdate }: JobDetailsProps) => {
    const { profile } = useAuth();
    const { toast } = useToast();
    const confirm = useConfirm();
    const queryClient = useQueryClient();
    const [job, setJob] = useState<JobCard | null>(null);
    const [closing, setClosing] = useState(false);
    const isInitialLoad = useRef(true);
    const [jobParts, setJobParts] = useState<JobPart[]>([]);
    const [jobLabor, setJobLabor] = useState<JobLabor[]>([]);
    const [allParts, setAllParts] = useState<Part[]>([]);
    const [profiles, setProfiles] = useState<{id: string, full_name: string}[]>([]);

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

    // Dirty state tracking
    const initialState = useRef({ mileage: '', techNotes: '', status: '', assignedTech: '', estimatedHours: '' });
    const isDirty = (
        mileage !== initialState.current.mileage ||
        techNotes !== initialState.current.techNotes ||
        status !== initialState.current.status ||
        assignedTech !== initialState.current.assignedTech ||
        estimatedHours !== initialState.current.estimatedHours
    );
    const [savedSuccessfully, setSavedSuccessfully] = useState(false);

    // AI State
    const [aiKey, setAiKey] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [tenantDetails, setTenantDetails] = useState<any>(null);

    const fetchJobDetails = async (signal?: AbortSignal) => {
        try {
            // Job Info
            const { data: jobData } = await supabase
                .from('job_cards')
                // @ts-ignore
                .select('*, vehicles(*, customers(*))')
                .eq('id', jobId)
                .abortSignal(signal!)
                .single();

            if (signal?.aborted) return;

            if (jobData) {
                setJob(jobData as JobCard);
                if (isInitialLoad.current) {
                    // Only set form fields on first load — subsequent refreshes (after
                    // adding parts/labor) must NOT overwrite user's unsaved edits
                    const m = jobData.mileage?.toString() || '';
                    const n = jobData.technician_notes || '';
                    const s = jobData.status;
                    const a = jobData.assigned_technician_id || '';
                    const e = jobData.estimated_hours?.toString() || '';
                    setMileage(m);
                    setTechNotes(n);
                    setStatus(s);
                    setAssignedTech(a);
                    setEstimatedHours(e);
                    initialState.current = { mileage: m, techNotes: n, status: s, assignedTech: a, estimatedHours: e };
                    setSavedSuccessfully(false);
                    isInitialLoad.current = false;
                }
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
                    .select('name, address, phone, logo_url, terms_and_conditions, ai_api_key, brand_color, default_labor_rate, sms_auto_enabled')
                    .eq('id', profile.tenant_id)
                    .single();
                
                if (tenantData) {
                    setTenantDetails(tenantData);
                    if (tenantData.ai_api_key) setAiKey(tenantData.ai_api_key);
                    if (tenantData.default_labor_rate) {
                        setLaborForm(prev => ({ ...prev, hourly_rate_lkr: tenantData.default_labor_rate.toString() }));
                    }
                }
            }
        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error('Error fetching job details:', error);
            }
        }
    };

    // Lock body scroll while slide-over is open
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);

    useEffect(() => {
        isInitialLoad.current = true; // reset on new job
        const controller = new AbortController();
        fetchJobDetails(controller.signal);

        return () => {
            controller.abort();
        };
    }, [jobId]);

    const generateJobCardPDF = async () => {
        if (!job || !tenantDetails) {
            toast("Job or shop details still loading, please wait.", 'warning');
            return;
        }

        try {
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            
            // --- Header ---
            // Logo. Bounded on BOTH axes: 22mm tall keeps it clear of the rule at
            // y=40, and logoRight reserves horizontal space for the shop name.
            let logoRight = 15;
            if (tenantDetails.logo_url) {
                try {
                    const base64Img = await urlToBase64(tenantDetails.logo_url);
                    const imgProps = doc.getImageProperties(base64Img);
                    const { width, height } = fitLogoBox(imgProps.width, imgProps.height, 30, 22);
                    doc.addImage(base64Img, 'PNG', 15, 10, width, height);
                    logoRight = 15 + width;
                } catch (e) { console.warn("Logo error", e); }
            }

            // Shop Details. Right-aligned, but shrunk until it clears the logo so a
            // long workshop name can't run over it.
            const nameMaxWidth = (pageWidth - 15) - logoRight - 6;
            doc.setFont('helvetica', 'bold');
            let nameFontSize = 18;
            doc.setFontSize(nameFontSize);
            const shopName = tenantDetails.name || 'Workshop';
            while (nameFontSize > 9 && doc.getTextWidth(shopName) > nameMaxWidth) {
                nameFontSize -= 1;
                doc.setFontSize(nameFontSize);
            }
            doc.text(shopName, pageWidth - 15, 20, { align: 'right' });

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100);
            const address = tenantDetails.address || '';
            const phone = tenantDetails.phone || '';
            doc.text(address, pageWidth - 15, 26, { align: 'right' });
            doc.text(phone, pageWidth - 15, 31, { align: 'right' });

            // Title
            doc.setDrawColor(0);
            doc.setLineWidth(0.5);
            doc.line(15, 40, pageWidth - 15, 40);
            
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0);
            doc.text("JOB CARD", 15, 50);

            // Job Meta
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Job ID: #${job.id.slice(0, 8).toUpperCase()}`, 15, 58);
            doc.text(`Date: ${new Date(job.created_at).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, 15, 63);

            // Customer & Vehicle
            // @ts-ignore
            const customerName = job.vehicles?.customers?.name || "Walk-in Customer";
            // @ts-ignore
            const customerPhone = job.vehicles?.customers?.phone || "";
            const vehicleInfo = job.vehicles ? `${job.vehicles.year} ${job.vehicles.make} ${job.vehicles.model}` : "Unknown Vehicle";
            const plate = job.vehicles?.license_plate || "N/A";

            doc.setFillColor(245, 245, 245);
            doc.rect(15, 70, pageWidth - 30, 25, 'F');
            
            doc.setFont('helvetica', 'bold');
            doc.text("Customer:", 20, 78);
            doc.text("Vehicle:", 110, 78);
            
            doc.setFont('helvetica', 'normal');
            doc.text(`${customerName} (${customerPhone})`, 20, 84);
            doc.text(`${vehicleInfo} - ${plate}`, 110, 84);
            doc.text(`Mileage: ${mileage || 'N/A'} km`, 110, 90);

            // Reported Issue
            doc.setFont('helvetica', 'bold');
            doc.text("Reported Issue / Request:", 15, 105);
            doc.setFont('helvetica', 'normal');
            doc.text(job.description || "No description provided.", 15, 111);

            let yPos = 125;

            // Technician Notes
            if (techNotes) {
                doc.setFont('helvetica', 'bold');
                doc.text("Technician Diagnosis / Diagnosis:", 15, yPos);
                yPos += 6;
                doc.setFont('helvetica', 'normal');
                // Split text to fit width
                const splitNotes = doc.splitTextToSize(techNotes, pageWidth - 30);
                doc.text(splitNotes, 15, yPos);
                yPos += (splitNotes.length * 5) + 10;
            }

            // Tables (Simplified)
            // Parts
            if (jobParts.length > 0) {
                doc.setFont('helvetica', 'bold');
                doc.text("Parts & Materials", 15, yPos);
                yPos += 5;
                jobParts.forEach(p => {
                    const name = p.is_custom ? p.custom_name : p.parts?.name;
                    doc.setFont('helvetica', 'normal');
                    doc.text(`- ${name} (x${p.quantity})`, 20, yPos);
                    // Minimal/Rugged: No prices on Job Card usually, unless requested? 
                    // User said "summary... statement... accepted". 
                    // Usually Job Card for workshop doesn't need prices, but "give to customer" might imply estimate.
                    // I will leave prices out for "Job Card" (Work Order) style to be rugged/legal, 
                    // but maybe add them if it's an "Invoice". 
                    // User said "Job Card... summarizing what they will do".
                    yPos += 5;
                });
                yPos += 5;
            }

             // Labor
             if (jobLabor.length > 0) {
                doc.setFont('helvetica', 'bold');
                doc.text("Authorized Labor / Services", 15, yPos);
                yPos += 5;
                jobLabor.forEach(l => {
                    doc.setFont('helvetica', 'normal');
                    doc.text(`- ${l.description} (${l.hours} hrs)`, 20, yPos);
                    yPos += 5;
                });
                yPos += 10;
            }

            // Terms
            if (tenantDetails.terms_and_conditions) {
                if (yPos > 240) { doc.addPage(); yPos = 20; }
                
                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.text("Terms & Conditions:", 15, yPos);
                yPos += 5;
                const terms = doc.splitTextToSize(tenantDetails.terms_and_conditions, pageWidth - 30);
                doc.text(terms, 15, yPos);
                yPos += (terms.length * 3) + 15;
            } else {
                 yPos += 20;
            }

            // Signatures
            if (yPos > 250) { doc.addPage(); yPos = 20; }
            
            doc.setTextColor(0);
            doc.setDrawColor(0);
            doc.setLineWidth(0.1);
            
            doc.line(15, yPos + 20, 90, yPos + 20); // Customer Sig
            doc.line(110, yPos + 20, pageWidth - 15, yPos + 20); // Advisor Sig
            
            doc.setFontSize(8);
            doc.text("Customer Signature", 15, yPos + 25);
            doc.text("Service Advisor / Technician", 110, yPos + 25);
            
            doc.text("I authorize the above work and agree to the terms.", 15, yPos + 30);

            doc.save(`JobCard-${job.id.slice(0,6)}.pdf`);

        } catch (e: any) {
            console.error(e);
            toast("Error generating PDF: " + e.message, 'error');
        }
    };

    const doClose = () => {
        if (closing) return; // already closing
        setClosing(true);
        setTimeout(() => onClose(), 220);
    };

    const handleClose = async () => {
        if (isDirty) {
            const ok = await confirm({
                title: 'Unsaved Changes',
                message: 'You have unsaved changes.',
                confirmLabel: 'Update & Close',
                cancelLabel: 'Close Anyway',
                confirmStyle: 'default',
            });
            if (ok) await handleUpdateJob();
            doClose();
        } else {
            doClose();
        }
    };

    const getCustomerPhone = () => {
        // @ts-ignore
        return job?.vehicles?.customers?.phone as string | undefined;
    };

    const getCustomerName = () => {
        // @ts-ignore
        return (job?.vehicles?.customers?.name as string) || 'Customer';
    };

    const handleWhatsApp = () => {
         const phone = getCustomerPhone();
         if (!phone) { toast("No customer phone number on file.", 'warning'); return; }
         const vehicle = `${job?.vehicles?.make} ${job?.vehicles?.model}`;
         const message = `Hello! Regarding your ${vehicle} at ${tenantDetails?.name || 'our workshop'}. Status: ${status?.replace('_', ' ')}. ${techNotes ? `Note: ${techNotes}` : ''}`;
         const url = `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
         window.open(url, '_blank');
    };

    const handleSendSMS = async (type: 'status' | 'completed') => {
        const phone = getCustomerPhone();
        if (!phone) { toast("No customer phone number on file.", 'warning'); return; }
        if (!job?.tenant_id) { toast("Tenant info missing.", 'warning'); return; }

        const name = getCustomerName();
        const make = job.vehicles?.make || '';
        const model = job.vehicles?.model || '';
        const plate = job.vehicles?.license_plate || '';
        const shopPhone = tenantDetails?.phone || '';
        const shopName = tenantDetails?.name || 'the workshop';

        const message = type === 'completed'
            ? smsTemplates.jobCompleted(name, make, model, plate, shopName, shopPhone)
            : smsTemplates.jobInProgress(name, make, model, plate, shopName);

        try {
            await sendSMS(phone, message, job.tenant_id);
            toast("SMS sent to customer.", 'success');
        } catch (e: any) {
            toast("SMS failed: " + e.message, 'error');
        }
    };

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

        // --- Generate Invoice on Completion ---
        let invoiceCreated = false;
        if (status === 'completed' && job?.status !== 'completed') {
            updates.completed_at = now.toISOString();

            const { created, error: invError } = await ensureInvoiceForJob(jobId, job.tenant_id);
            if (invError) {
                toast("Job completed, but invoice creation failed: " + invError, 'error');
                return;
            }
            invoiceCreated = created;
        }
        else if (status !== 'completed' && job?.status === 'completed') {
            updates.completed_at = null;
        }

        const { error } = await supabase.from('job_cards').update(updates).eq('id', jobId);

        if (error) {
            toast(error.message, 'error');
        } else {
            onUpdate();
            setJob(prev => prev ? { ...prev, ...updates } : null);
            if (job?.tenant_id) {
                logAudit(job.tenant_id, profile?.id, `job.status_changed`, 'job_card', jobId, {
                    from: job.status, to: status,
                    vehicle: `${job.vehicles?.make} ${job.vehicles?.model}`,
                    plate: job.vehicles?.license_plate,
                });
            }

            const autoSMS = tenantDetails?.sms_auto_enabled !== false; // default true
            if (status === 'completed' && job?.status !== 'completed') {
                queryClient.invalidateQueries({ queryKey: ['invoices'] });
                toast(invoiceCreated
                    ? "Job completed & invoice generated!"
                    : "Job completed. An invoice already existed for it.", 'success');
                // Push to all tenant admins/managers
                if (job?.tenant_id) {
                    sendPushNotification({
                        tenantId: job.tenant_id,
                        title: '✅ Job Completed',
                        body: `${job.vehicles?.make} ${job.vehicles?.model} (${job.vehicles?.license_plate}) is ready.`,
                        tag: 'job-completed',
                        url: `/mazdabuddy/#/jobs`,
                    }).catch(() => {});
                }
                if (autoSMS) {
                    const phone = getCustomerPhone();
                    if (phone && job?.tenant_id) {
                        sendSMS(phone,
                            smsTemplates.jobCompleted(
                                getCustomerName(), job.vehicles?.make || '', job.vehicles?.model || '',
                                job.vehicles?.license_plate || '', tenantDetails?.name || 'the workshop', tenantDetails?.phone || ''
                            ),
                            job.tenant_id
                        ).catch(() => {});
                    }
                }
            } else if (status === 'in_progress' && job?.status !== 'in_progress') {
                toast("Job updated — work started.", 'success');
                if (autoSMS) {
                    const phone = getCustomerPhone();
                    if (phone && job?.tenant_id) {
                        sendSMS(phone,
                            smsTemplates.jobInProgress(
                                getCustomerName(), job.vehicles?.make || '', job.vehicles?.model || '',
                                job.vehicles?.license_plate || '', tenantDetails?.name || 'the workshop'
                            ),
                            job.tenant_id
                        ).catch(() => {});
                    }
                }
            } else {
                toast("Job updated successfully.", 'success');
            }
            // Reset dirty tracking after successful save
            initialState.current = { mileage, techNotes, status, assignedTech, estimatedHours };
            setSavedSuccessfully(true);
        }
    };

    const handleArchive = async () => {
        const ok = await confirm({ message: "Archive this job? It will be hidden from the active board.", confirmLabel: "Archive", confirmStyle: "warning" });
        if (!ok) return;
        const { error } = await supabase.from('job_cards').update({ archived: true }).eq('id', jobId);
        if (error) toast(error.message, 'error');
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
                part_id: null,
                quantity: partForm.quantity,
                price_at_time_lkr: price,
                cost_at_time_lkr: cost,
                is_custom: true,
                custom_name: partForm.custom_name
            });
            
            if (error) {
                toast(error.message, 'error');
            } else {
                fetchJobDetails();
                setPartForm({ part_id: '', quantity: 1, is_custom: false, custom_name: '', custom_price_lkr: '', custom_cost_lkr: '' });
                toast("Custom part added.", 'success');
            }
            return;
        }

        // 2. Handle Inventory Parts (Secure Transaction)
        const { data, error } = await supabase.rpc('add_job_part_transaction', {
            p_job_id: jobId,
            p_part_id: partForm.part_id,
            p_quantity: partForm.quantity,
            p_user_id: profile?.id
        });

        if (error) {
            console.error(error);
            toast("Transaction failed: " + error.message, 'error');
        } else if (data && !data.success) {
            toast(data.message, 'error');
        } else {
            fetchJobDetails();
            setPartForm({ part_id: '', quantity: 1, is_custom: false, custom_name: '', custom_price_lkr: '', custom_cost_lkr: '' });
            toast("Part added to job.", 'success');
        }
    };

    const handleAddLabor = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { error } = await supabase.from('job_labor').insert({
                job_id: jobId,
                hours: parseFloat(laborForm.hours),
                description: laborForm.description,
                hourly_rate_lkr: parseFloat(laborForm.hourly_rate_lkr)
            });
            
            if(!error) {
                fetchJobDetails();
                setLaborForm(prev => ({...prev, description: '', hours: ''}));
                toast("Labor entry added.", 'success');
            } else {
                toast(error.message, 'error');
            }
        } catch (err) {
            toast("Unexpected error adding labor.", 'error');
        }
    };

    const handleRemovePart = async (id: string) => {
        const ok = await confirm({ message: "Remove this part? Stock will be returned to inventory.", confirmLabel: "Remove" });
        if (!ok) return;

        const { error } = await supabase.rpc('remove_job_part_transaction', { p_job_part_id: id });

        if (error) toast("Error removing part: " + error.message, 'error');
        else { fetchJobDetails(); toast("Part removed, stock restored.", 'info'); }
    };

    const handleRemoveLabor = async (id: string) => {
        const { error } = await supabase.from('job_labor').delete().eq('id', id);
        if (error) toast("Error removing labor entry.", 'error');
        else fetchJobDetails();
    };

    const handleAiAssist = async () => {
        if (!aiKey) {
            toast("AI API Key not configured in Settings.", 'warning');
        return;
            return;
        }
        setIsAiLoading(true);
        try {
            const vehicleInfo = `${job?.vehicles?.make} ${job?.vehicles?.model} (${job?.vehicles?.license_plate})`;
            const suggestion = await generateDiagnosis(aiKey, vehicleInfo, job?.description || '', techNotes);
            
            const newNotes = techNotes ? `${techNotes}\n\n--- AI Suggestion ---\n${suggestion}` : `--- AI Suggestion ---\n${suggestion}`;
            setTechNotes(newNotes);
        } catch (e) {
            toast("AI Error: Failed to generate diagnosis.", 'error');
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
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={handleClose} />
                <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-0 md:pl-10">
                    <div className={`pointer-events-auto w-screen max-w-lg ${closing ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}>
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
                                              job.status === 'waiting_parts' ? 'bg-orange-500/10 text-orange-400' :
                                              job.status === 'cancelled' ? 'bg-red-500/10 text-red-400' :
                                              'bg-slate-700 text-slate-400'}`}>
                                            {job.status.replace(/_/g, ' ')}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 md:gap-2">
                                     {/* WhatsApp */}
                                     <button
                                        onClick={handleWhatsApp}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(37,211,102,0.12)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = '')}
                                        className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors"
                                        title="WhatsApp Customer"
                                     >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="#25D366">
                                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                        </svg>
                                        <span className="text-[9px] font-bold text-slate-500 uppercase leading-none">WA</span>
                                     </button>

                                     {/* SMS */}
                                     <button
                                        onClick={() => handleSendSMS(status === 'completed' ? 'completed' : 'status')}
                                        className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"
                                        title="Send SMS to Customer"
                                     >
                                        <Smartphone size={18} />
                                        <span className="text-[9px] font-bold uppercase leading-none">SMS</span>
                                     </button>

                                     {/* Job Card PDF */}
                                     <button
                                        onClick={generateJobCardPDF}
                                        className="flex flex-col items-center gap-0.5 px-2 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-lg transition-all border border-emerald-600/30 hover:border-emerald-500 active:scale-95"
                                        title="Download Job Card PDF"
                                     >
                                        <Download size={16} />
                                        <span className="text-[9px] font-bold uppercase leading-none">PDF</span>
                                     </button>

                                     {job.status === 'completed' && !job.archived && (
                                         <button onClick={handleArchive} className="p-2 text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 rounded-lg transition-colors" title="Archive Job">
                                             <Archive size={18} />
                                         </button>
                                     )}
                                     {/* Visible separator on all sizes */}
                                     <div className="w-px h-7 bg-slate-700 mx-1" />
                                     <button onClick={handleClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors" title="Close">
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Single-scroll content — no tabs */}
                            <div className="flex-1 overflow-y-auto bg-slate-900 pb-40">

                                {/* ── JOB DETAILS ───────────────────────── */}
                                <div className="p-4 space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
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

                                    <div className="grid grid-cols-2 gap-3">
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
                                        <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-800">
                                            <div className="flex justify-between items-center mb-1.5">
                                                <h4 className="text-[10px] font-bold text-slate-500 uppercase">Efficiency</h4>
                                                {job.status === 'in_progress' && (
                                                    <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded animate-pulse font-bold flex items-center gap-1">
                                                        <Clock size={10} /> REC
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex justify-between items-end">
                                                <div className="text-base font-bold text-white">
                                                    {job.total_labor_time ? (job.total_labor_time / 60).toFixed(1) : '0.0'}
                                                    <span className="text-xs text-slate-500 font-normal"> / {parseFloat(estimatedHours || '0').toFixed(1)} hrs</span>
                                                </div>
                                                {(job.total_labor_time && estimatedHours) ? (
                                                    (job.total_labor_time / 60) > parseFloat(estimatedHours) ?
                                                        <span className="text-red-400 text-[10px] flex items-center gap-1"><AlertCircle size={10}/> Over</span> :
                                                        <span className="text-emerald-400 text-[10px] flex items-center gap-1"><CheckCircle size={10}/> On track</span>
                                                ) : null}
                                            </div>
                                            <div className="w-full bg-slate-700 h-1.5 mt-2 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full ${(job.total_labor_time && estimatedHours && (job.total_labor_time / 60) > parseFloat(estimatedHours)) ? 'bg-red-500' : 'bg-emerald-500'}`}
                                                    style={{width: `${Math.min(100, (((job.total_labor_time || 0) / 60) / (parseFloat(estimatedHours || '1'))) * 100)}%`}} />
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
                                                <button onClick={handleAiAssist} disabled={isAiLoading}
                                                    className="text-[10px] bg-purple-500/10 text-purple-400 px-2 py-1 rounded hover:bg-purple-500/20 disabled:opacity-50 flex items-center gap-1 transition-colors">
                                                    {isAiLoading ? 'Thinking...' : '✨ AI Assist'}
                                                </button>
                                            )}
                                        </div>
                                        <textarea rows={4} value={techNotes} onChange={e => setTechNotes(e.target.value)} className="w-full bg-slate-800 text-white p-3 text-sm rounded border border-slate-700 focus:border-brand focus:outline-none" placeholder="Add diagnosis and repair notes..." />
                                    </div>
                                </div>

                                {/* ── PARTS ─────────────────────────────── */}
                                <div className="border-t border-slate-800">
                                    <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <Package size={14} className="text-brand" /> Parts
                                            {jobParts.length > 0 && <span className="bg-brand-soft text-brand text-[10px] px-1.5 py-0.5 rounded font-bold">{jobParts.length}</span>}
                                        </h3>
                                        <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-700">
                                            <button onClick={() => setPartForm({...partForm, is_custom: false})}
                                                className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${!partForm.is_custom ? 'bg-cyan-600 text-white' : 'text-slate-500'}`}>Inventory</button>
                                            <button onClick={() => setPartForm({...partForm, is_custom: true})}
                                                className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${partForm.is_custom ? 'bg-cyan-600 text-white' : 'text-slate-500'}`}>Custom</button>
                                        </div>
                                    </div>
                                    <div className="px-4 pb-3">
                                        <form onSubmit={handleAddPart} className="space-y-2">
                                            {!partForm.is_custom ? (
                                                <div className="flex gap-2 items-center">
                                                    <div className="flex-1 min-w-0">
                                                        <select required value={partForm.part_id} onChange={e => setPartForm({...partForm, part_id: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm">
                                                            <option value="">Select part...</option>
                                                            {allParts.map(p => <option key={p.id} value={p.id}>{p.name} ({p.stock_quantity})</option>)}
                                                        </select>
                                                    </div>
                                                    <input type="number" min="1" onFocus={(e) => e.target.select()} value={partForm.quantity} onChange={e => setPartForm({...partForm, quantity: parseInt(e.target.value)})} className="w-12 bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm text-center" />
                                                    <button type="submit" className="btn-brand px-3 py-2 rounded-lg font-bold text-sm">Add</button>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    <input required placeholder="Part name (e.g. Engine Oil 4L)" value={partForm.custom_name} onChange={e => setPartForm({...partForm, custom_name: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm" />
                                                    <div className="flex gap-2">
                                                        <div className="relative flex-1">
                                                            <span className="absolute left-2 top-2 text-[10px] text-slate-400">Sell</span>
                                                            <input required type="number" onFocus={(e) => e.target.select()} value={partForm.custom_price_lkr} onChange={e => setPartForm({...partForm, custom_price_lkr: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 pl-10 text-white text-sm font-mono" />
                                                        </div>
                                                        <div className="relative flex-1">
                                                            <span className="absolute left-2 top-2 text-[10px] text-slate-400">Cost</span>
                                                            <input required type="number" onFocus={(e) => e.target.select()} value={partForm.custom_cost_lkr} onChange={e => setPartForm({...partForm, custom_cost_lkr: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 pl-10 text-white text-sm font-mono" />
                                                        </div>
                                                        <input type="number" min="1" onFocus={(e) => e.target.select()} value={partForm.quantity} onChange={e => setPartForm({...partForm, quantity: parseInt(e.target.value)})} className="w-12 bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm text-center" />
                                                        <button type="submit" className="btn-brand px-3 py-2 rounded-lg font-bold text-sm">Add</button>
                                                    </div>
                                                </div>
                                            )}
                                        </form>
                                    </div>
                                    <div className="px-4 pb-4 space-y-2">
                                        {jobParts.map(part => (
                                            <div key={part.id} className="flex justify-between items-center bg-slate-800/40 p-3 rounded-lg border border-slate-800">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Package size={14} className={part.is_custom ? "text-amber-400 flex-shrink-0" : "text-purple-400 flex-shrink-0"} />
                                                    <div className="min-w-0">
                                                        <div className="font-medium text-white text-sm truncate">
                                                            {part.is_custom ? part.custom_name : part.parts?.name}
                                                            {part.is_custom && <span className="ml-1 text-[8px] bg-amber-500/10 text-amber-500 px-1 rounded uppercase">Custom</span>}
                                                        </div>
                                                        <div className="text-xs text-slate-500">{part.quantity} × LKR {part.price_at_time_lkr.toLocaleString()}</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                                    <span className="font-mono text-white text-sm">{(part.price_at_time_lkr * part.quantity).toLocaleString()}</span>
                                                    <button onClick={() => handleRemovePart(part.id)} className="text-slate-600 hover:text-red-400 p-1"><Trash2 size={14}/></button>
                                                </div>
                                            </div>
                                        ))}
                                        {jobParts.length === 0 && <p className="text-center text-slate-600 py-2 text-sm italic">No parts added yet.</p>}
                                    </div>
                                </div>

                                {/* ── LABOR ─────────────────────────────── */}
                                <div className="border-t border-slate-800">
                                    <div className="px-4 pt-4 pb-2">
                                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <Clock size={14} className="text-brand" /> Labor
                                            {jobLabor.length > 0 && <span className="bg-brand-soft text-brand text-[10px] px-1.5 py-0.5 rounded font-bold">{jobLabor.length}</span>}
                                        </h3>
                                    </div>
                                    <div className="px-4 pb-3">
                                        <form onSubmit={handleAddLabor} className="space-y-2">
                                            <div className="flex gap-2">
                                                <input required placeholder="Description" value={laborForm.description} onChange={e => setLaborForm({...laborForm, description: e.target.value})} className="flex-1 bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm" />
                                                <input required type="number" step="0.5" onFocus={(e) => e.target.select()} placeholder="Hrs" value={laborForm.hours} onChange={e => setLaborForm({...laborForm, hours: e.target.value})} className="w-16 bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm text-center" />
                                            </div>
                                            <div className="flex gap-2 items-center">
                                                <div className="flex-1 relative">
                                                    <span className="absolute left-2 top-2 text-[10px] text-slate-400">LKR/hr</span>
                                                    <input required type="number" onFocus={(e) => e.target.select()} value={laborForm.hourly_rate_lkr} onChange={e => setLaborForm({...laborForm, hourly_rate_lkr: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 pl-12 text-white text-sm font-mono" />
                                                </div>
                                                <button type="submit" className="btn-brand px-4 py-2 rounded-lg font-bold text-sm">Add</button>
                                            </div>
                                        </form>
                                    </div>
                                    <div className="px-4 pb-6 space-y-2">
                                        {jobLabor.map(labor => (
                                            <div key={labor.id} className="flex justify-between items-center bg-slate-800/40 p-3 rounded-lg border border-slate-800">
                                                <div className="min-w-0">
                                                    <div className="font-medium text-white text-sm truncate">{labor.description}</div>
                                                    <div className="text-xs text-slate-500">{labor.hours} hrs @ LKR {labor.hourly_rate_lkr.toLocaleString()}</div>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                                    <span className="font-mono text-white text-sm">{(labor.hourly_rate_lkr * labor.hours).toLocaleString()}</span>
                                                    <button onClick={() => handleRemoveLabor(labor.id)} className="text-slate-600 hover:text-red-400 p-1"><Trash2 size={14}/></button>
                                                </div>
                                            </div>
                                        ))}
                                        {jobLabor.length === 0 && <p className="text-center text-slate-600 py-2 text-sm italic">No labor entries yet.</p>}
                                    </div>
                                </div>

                                {/* ── BOTTOM CLOSE (one-handed) ─────────── */}
                                <div className="border-t border-slate-800 p-4">
                                    <button
                                        onClick={handleClose}
                                        className="w-full py-3 rounded-xl text-sm font-bold text-slate-400 bg-slate-800/60 hover:bg-slate-700 hover:text-white border border-slate-700 transition-colors active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <X size={16} /> Close Job Card
                                    </button>
                                </div>

                            </div>

                            {/* Footer */}
                            <div className="p-4 bg-slate-950 border-t border-slate-800 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                                <div className="flex justify-between items-center mb-2">
                                    <div className="text-slate-400 text-xs font-bold uppercase">Estimated Total</div>
                                    <div className="text-xl font-black text-brand font-mono">
                                        LKR {(totalParts + totalLabor).toLocaleString()}
                                    </div>
                                </div>
                                {savedSuccessfully && !isDirty ? (
                                    <button
                                        onClick={generateJobCardPDF}
                                        className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 text-sm bg-emerald-600 hover:bg-emerald-500 text-white"
                                    >
                                        <Download size={18} /> Download Job Card
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleUpdateJob}
                                        disabled={!isDirty}
                                        className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 text-sm ${
                                            isDirty
                                                ? 'btn-brand'
                                                : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                                        }`}
                                    >
                                        <Save size={18} /> {isDirty ? 'Update Job' : 'No Changes'}
                                    </button>
                                )}
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
