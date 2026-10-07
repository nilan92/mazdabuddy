import React, { useState, useEffect } from 'react';
import { 
    ShieldCheck, 
    CheckCircle2, 
    AlertTriangle, 
    AlertCircle, 
    Download, 
    Plus, 
    Calendar, 
    Gauge, 
    ChevronDown, 
    ChevronUp,
    FileText,
    Wrench,
    Sparkles,
    Clock
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';
import { 
    INSPECTION_CATEGORIES, 
    getInspectionCounts,
    buildVehicleHealthPdf,
    type InspectionStatus, 
    type JobInspectionRecord
} from '../lib/inspections';

interface VehicleInspectionSectionProps {
    jobId: string;
    tenantId: string;
    job: any;
    currentMileage?: string | number | null;
    tenantDetails: any;
    readOnly?: boolean;
    isTechnician?: boolean;
    isLocked?: boolean;
    onUpdate?: () => void;
}

export const VehicleInspectionSection: React.FC<VehicleInspectionSectionProps> = ({
    jobId,
    tenantId,
    job,
    currentMileage,
    tenantDetails,
    readOnly = false,
    isLocked = false,
}) => {
    const { toast } = useToast();

    // Toggle switch: is this inspection module active for this job?
    const [hasInspection, setHasInspection] = useState<boolean>(Boolean(job?.has_inspection));
    const [isExpanded, setIsExpanded] = useState<boolean>(Boolean(job?.has_inspection));
    const [saving, setSaving] = useState<boolean>(false);
    const [generatingPdf, setGeneratingPdf] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(true);

    // Inspection items
    const [items, setItems] = useState<JobInspectionRecord[]>([]);

    // Next service recommendation
    const [nextServiceMileage, setNextServiceMileage] = useState<string>(
        job?.next_service_mileage ? String(job.next_service_mileage) : ''
    );
    const [nextServiceDate, setNextServiceDate] = useState<string>(
        job?.next_service_date ? String(job.next_service_date) : ''
    );
    const [inspectionNotes, setInspectionNotes] = useState<string>(
        job?.inspection_notes || ''
    );

    // Accordion state for categories
    const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
        'Fluids & Filters': true,
        'Brakes & Tires': true,
        'Suspension & Steering': false,
        'Underhood & Electrical': false,
        'Safety & Exterior': false,
    });

    // Custom item input
    const [customItemCategory, setCustomItemCategory] = useState<string>('Fluids & Filters');
    const [customItemName, setCustomItemName] = useState<string>('');
    const [showAddCustom, setShowAddCustom] = useState<boolean>(false);

    // Fetch existing inspection items
    useEffect(() => {
        let isMounted = true;
        const fetchInspections = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('job_inspections')
                    .select('*')
                    .eq('job_id', jobId)
                    .order('created_at', { ascending: true });

                if (error) throw error;

                if (isMounted) {
                    if (data && data.length > 0) {
                        setItems(data);
                    } else {
                        // Prepare default template items (in memory until user activates/saves)
                        const defaultList: JobInspectionRecord[] = [];
                        INSPECTION_CATEGORIES.forEach(cat => {
                            cat.items.forEach(name => {
                                defaultList.push({
                                    job_id: jobId,
                                    tenant_id: tenantId,
                                    category: cat.name,
                                    item_name: name,
                                    status: 'good',
                                    notes: '',
                                    estimated_cost_lkr: 0,
                                });
                            });
                        });
                        setItems(defaultList);
                    }
                }
            } catch (err: any) {
                console.error('Error fetching inspections:', err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchInspections();
        return () => { isMounted = false; };
    }, [jobId, tenantId]);

    // Handle toggle switch (Turn on/off inspection)
    const handleToggleSwitch = async (checked: boolean) => {
        if (readOnly || isLocked) return;

        setHasInspection(checked);
        setIsExpanded(checked);

        // If activating and next service mileage not set, auto-suggest +5000 km
        if (checked && !nextServiceMileage && currentMileage) {
            const num = parseInt(String(currentMileage));
            if (!isNaN(num) && num > 0) {
                setNextServiceMileage(String(num + 5000));
            }
        }

        // If activating and next service date not set, auto-suggest +3 months
        if (checked && !nextServiceDate) {
            const d = new Date();
            d.setMonth(d.getMonth() + 3);
            setNextServiceDate(d.toISOString().split('T')[0]);
        }

        try {
            await supabase
                .from('job_cards')
                .update({ has_inspection: checked })
                .eq('id', jobId);

            // If switching ON and no items in database yet, persist default items
            if (checked) {
                const { data: existing } = await supabase
                    .from('job_inspections')
                    .select('id')
                    .eq('job_id', jobId)
                    .limit(1);

                if (!existing || existing.length === 0) {
                    await handleSaveAllItems(items, false);
                }
            }
        } catch (err: any) {
            console.error('Error updating has_inspection:', err);
        }
    };

    // Update single item status
    const handleSetStatus = (index: number, status: InspectionStatus) => {
        if (readOnly || isLocked) return;
        const updated = [...items];
        updated[index] = { ...updated[index], status };
        setItems(updated);
    };

    // Update single item notes
    const handleSetNotes = (index: number, notes: string) => {
        if (readOnly || isLocked) return;
        const updated = [...items];
        updated[index] = { ...updated[index], notes };
        setItems(updated);
    };

    // Update single item estimated cost
    const handleSetCost = (index: number, costStr: string) => {
        if (readOnly || isLocked) return;
        const updated = [...items];
        const costNum = parseFloat(costStr);
        updated[index] = { ...updated[index], estimated_cost_lkr: isNaN(costNum) ? 0 : costNum };
        setItems(updated);
    };

    // Mark all items as Good (Fast-fill helper)
    const handleMarkAllGood = () => {
        if (readOnly || isLocked) return;
        const updated = items.map(item => ({ ...item, status: 'good' as InspectionStatus }));
        setItems(updated);
        toast('All checklist items marked as Good / Satisfactory.', 'info');
    };

    // Add a custom inspection item
    const handleAddCustomItem = () => {
        if (!customItemName.trim()) return;
        const newItem: JobInspectionRecord = {
            job_id: jobId,
            tenant_id: tenantId,
            category: customItemCategory,
            item_name: customItemName.trim(),
            status: 'good',
            notes: '',
            estimated_cost_lkr: 0,
        };
        setItems([...items, newItem]);
        setCustomItemName('');
        setShowAddCustom(false);
        toast(`Added "${newItem.item_name}" to ${customItemCategory}.`, 'success');
    };

    // Quick mileage shortcut
    const handleMileageShortcut = (addKm: number) => {
        const base = parseInt(String(currentMileage)) || 0;
        if (base > 0) {
            setNextServiceMileage(String(base + addKm));
        } else {
            const currentVal = parseInt(nextServiceMileage) || 0;
            setNextServiceMileage(String(currentVal + addKm));
        }
    };

    // Quick date shortcut
    const handleDateShortcut = (months: number) => {
        const d = new Date();
        d.setMonth(d.getMonth() + months);
        setNextServiceDate(d.toISOString().split('T')[0]);
    };

    // Save all items and job card recommendation metadata
    const handleSaveAllItems = async (itemsToSave = items, showToast = true) => {
        if (readOnly || isLocked) return;
        setSaving(true);
        try {
            // 1. Update job card metadata
            await supabase
                .from('job_cards')
                .update({
                    has_inspection: true,
                    next_service_mileage: nextServiceMileage ? parseInt(nextServiceMileage) : null,
                    next_service_date: nextServiceDate || null,
                    inspection_notes: inspectionNotes || null,
                })
                .eq('id', jobId);

            // 2. Upsert / sync inspection items
            for (const item of itemsToSave) {
                if (item.id) {
                    await supabase
                        .from('job_inspections')
                        .update({
                            status: item.status,
                            notes: item.notes || null,
                            estimated_cost_lkr: item.estimated_cost_lkr || 0,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', item.id);
                } else {
                    const { data } = await supabase
                        .from('job_inspections')
                        .insert([{
                            job_id: jobId,
                            tenant_id: tenantId,
                            category: item.category,
                            item_name: item.item_name,
                            status: item.status,
                            notes: item.notes || null,
                            estimated_cost_lkr: item.estimated_cost_lkr || 0,
                        }])
                        .select()
                        .single();

                    if (data) item.id = data.id;
                }
            }

            if (showToast) toast('Inspection checklist saved successfully.', 'success');
        } catch (err: any) {
            console.error('Error saving inspections:', err);
            if (showToast) toast('Failed to save inspection: ' + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    // Download / Print PDF report
    const handleDownloadReport = async () => {
        setGeneratingPdf(true);
        try {
            const { doc, filename } = await buildVehicleHealthPdf({
                job,
                inspections: items,
                tenant: tenantDetails,
                nextServiceMileage: nextServiceMileage ? parseInt(nextServiceMileage) : null,
                nextServiceDate: nextServiceDate || null,
                generalNotes: inspectionNotes,
            });
            doc.save(filename);
            toast('Vehicle Health Report downloaded.', 'success');
        } catch (err: any) {
            console.error('Error generating inspection PDF:', err);
            toast('Failed to generate PDF: ' + err.message, 'error');
        } finally {
            setGeneratingPdf(false);
        }
    };

    const counts = getInspectionCounts(items);

    return (
        <div className="border-t border-slate-800 bg-slate-900/60">
            {/* ── TOGGLE HEADER BAR (Compact when off, never clutters) ── */}
            <div className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                        hasInspection 
                            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                        <ShieldCheck size={20} />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-xs font-black text-white uppercase tracking-wider">
                                Vehicle Health &amp; Future Care
                            </h3>
                            {hasInspection && (
                                <div className="flex items-center gap-1.5 text-[10px] font-bold">
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                        {counts.good} Good
                                    </span>
                                    {counts.advisory > 0 && (
                                        <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                            {counts.advisory} Advisory
                                        </span>
                                    )}
                                    {counts.urgent > 0 && (
                                        <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30">
                                            {counts.urgent} Urgent
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            {hasInspection
                                ? 'Multi-point inspection & routine maintenance recommendations'
                                : 'Disabled — turn on switch to log inspection & future service advisories'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                    {hasInspection && (
                        <>
                            <button
                                type="button"
                                onClick={handleDownloadReport}
                                disabled={generatingPdf}
                                title="Download PDF Health Report"
                                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all active:scale-95"
                            >
                                <Download size={13} />
                                {generatingPdf ? 'Generating…' : 'Health PDF'}
                            </button>

                            <button
                                type="button"
                                onClick={() => setIsExpanded(!isExpanded)}
                                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                                title={isExpanded ? 'Collapse' : 'Expand'}
                            >
                                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </button>
                        </>
                    )}

                    {/* IOS-style Toggle Switch */}
                    <button
                        type="button"
                        role="switch"
                        aria-checked={hasInspection}
                        disabled={readOnly || isLocked}
                        onClick={() => handleToggleSwitch(!hasInspection)}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                            hasInspection ? 'bg-cyan-500' : 'bg-slate-700'
                        }`}
                        title={hasInspection ? 'Turn inspection view OFF' : 'Turn inspection view ON'}
                    >
                        <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                hasInspection ? 'translate-x-5' : 'translate-x-0'
                            }`}
                        />
                    </button>
                </div>
            </div>

            {/* ── EXPANDED INSPECTION FORM (Only shown when switch is ON) ── */}
            {hasInspection && isExpanded && (
                <div className="px-4 pb-6 space-y-5 animate-fade-in">
                    
                    {/* 1. Quick Toolbar: Fast-fill & Export */}
                    <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleMarkAllGood}
                                disabled={readOnly || isLocked}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 transition-all active:scale-95"
                                title="Quickly set all items to Good so you only edit advisories"
                            >
                                <Sparkles size={13} /> Mark All Good
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowAddCustom(!showAddCustom)}
                                disabled={readOnly || isLocked}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                            >
                                <Plus size={13} /> Custom Item
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleDownloadReport}
                                disabled={generatingPdf}
                                className="sm:hidden inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700"
                            >
                                <Download size={13} /> PDF
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSaveAllItems(items, true)}
                                disabled={saving || readOnly || isLocked}
                                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm transition-all active:scale-95"
                            >
                                {saving ? 'Saving…' : 'Save Checklist'}
                            </button>
                        </div>
                    </div>

                    {/* Custom Item Drawer */}
                    {showAddCustom && (
                        <div className="p-3 bg-slate-950 rounded-xl border border-cyan-500/30 space-y-2.5">
                            <div className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">
                                Add Custom Check Item
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <select
                                    value={customItemCategory}
                                    onChange={e => setCustomItemCategory(e.target.value)}
                                    className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg p-2"
                                >
                                    {INSPECTION_CATEGORIES.map(c => (
                                        <option key={c.name} value={c.name}>{c.name}</option>
                                    ))}
                                </select>
                                <input
                                    type="text"
                                    placeholder="Item name (e.g. Rear Diff Oil)"
                                    value={customItemName}
                                    onChange={e => setCustomItemName(e.target.value)}
                                    className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg p-2 sm:col-span-2"
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowAddCustom(false)}
                                    className="px-3 py-1 rounded text-xs text-slate-400 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleAddCustomItem}
                                    className="px-4 py-1 rounded text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white"
                                >
                                    Add Item
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 2. Next Routine Service Recommendation Box */}
                    <div className="p-4 bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/30 rounded-2xl space-y-3">
                        <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-amber-400" />
                            <h4 className="text-xs font-black text-amber-300 uppercase tracking-wider">
                                Next Routine Service Recommendation
                            </h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Target Mileage */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">
                                        Target Mileage (km)
                                    </label>
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            disabled={readOnly || isLocked}
                                            onClick={() => handleMileageShortcut(5000)}
                                            className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700"
                                        >
                                            +5,000 km
                                        </button>
                                        <button
                                            type="button"
                                            disabled={readOnly || isLocked}
                                            onClick={() => handleMileageShortcut(10000)}
                                            className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700"
                                        >
                                            +10,000 km
                                        </button>
                                    </div>
                                </div>
                                <div className="relative">
                                    <input
                                        type="number"
                                        disabled={readOnly || isLocked}
                                        value={nextServiceMileage}
                                        onChange={e => setNextServiceMileage(e.target.value)}
                                        placeholder={currentMileage ? `${parseInt(String(currentMileage)) + 5000}` : "e.g. 175000"}
                                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 pl-8 text-sm font-mono focus:border-amber-400 outline-none"
                                    />
                                    <Gauge size={14} className="absolute left-2.5 top-3 text-slate-500" />
                                </div>
                            </div>

                            {/* Target Date */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">
                                        Estimated Target Date
                                    </label>
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            disabled={readOnly || isLocked}
                                            onClick={() => handleDateShortcut(3)}
                                            className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700"
                                        >
                                            +3 Mo
                                        </button>
                                        <button
                                            type="button"
                                            disabled={readOnly || isLocked}
                                            onClick={() => handleDateShortcut(6)}
                                            className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700"
                                        >
                                            +6 Mo
                                        </button>
                                    </div>
                                </div>
                                <input
                                    type="date"
                                    disabled={readOnly || isLocked}
                                    value={nextServiceDate}
                                    onChange={e => setNextServiceDate(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 text-sm focus:border-amber-400 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 3. Category Inspection Checklists */}
                    {loading ? (
                        <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2 bg-slate-950/40 rounded-2xl border border-slate-800/80">
                            <Clock size={15} className="animate-spin text-cyan-400" />
                            <span>Loading inspection checklist…</span>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {INSPECTION_CATEGORIES.map(category => {
                            const catItems = items.filter(i => i.category === category.name);
                            if (catItems.length === 0) return null;

                            const catCounts = getInspectionCounts(catItems);
                            const isOpen = openCategories[category.name] ?? false;

                            return (
                                <div key={category.name} className="bg-slate-950/70 border border-slate-800 rounded-2xl overflow-hidden">
                                    {/* Category Accordion Header */}
                                    <button
                                        type="button"
                                        onClick={() => setOpenCategories({ ...openCategories, [category.name]: !isOpen })}
                                        className="w-full p-3.5 flex items-center justify-between bg-slate-900/60 hover:bg-slate-800/50 transition-colors text-left"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <Wrench size={14} className="text-cyan-400" />
                                            <span className="text-xs font-bold text-white uppercase tracking-wider">
                                                {category.name}
                                            </span>
                                            <span className="text-[10px] text-slate-500 font-mono">
                                                ({catItems.length})
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {catCounts.advisory > 0 && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                                    {catCounts.advisory} Advisory
                                                </span>
                                            )}
                                            {catCounts.urgent > 0 && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30">
                                                    {catCounts.urgent} Urgent
                                                </span>
                                            )}
                                            {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                                        </div>
                                    </button>

                                    {/* Items List */}
                                    {isOpen && (
                                        <div className="p-3.5 divide-y divide-slate-800/60 space-y-3">
                                            {catItems.map((item) => {
                                                const globalIndex = items.findIndex(it => it.item_name === item.item_name && it.category === item.category);

                                                return (
                                                    <div key={item.item_name} className="pt-3 first:pt-0 space-y-2">
                                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                                            <div className="min-w-0">
                                                                <span className="text-xs font-bold text-slate-200">
                                                                    {item.item_name}
                                                                </span>
                                                            </div>

                                                            {/* 3-State Traffic Light Selector */}
                                                            <div className="inline-flex rounded-lg p-0.5 bg-slate-900 border border-slate-800 self-start sm:self-auto">
                                                                <button
                                                                    type="button"
                                                                    disabled={readOnly || isLocked}
                                                                    onClick={() => handleSetStatus(globalIndex, 'good')}
                                                                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1 ${
                                                                        item.status === 'good'
                                                                            ? 'bg-emerald-500 text-slate-950 shadow-sm'
                                                                            : 'text-slate-400 hover:text-white'
                                                                    }`}
                                                                >
                                                                    <CheckCircle2 size={12} />
                                                                    Good
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    disabled={readOnly || isLocked}
                                                                    onClick={() => handleSetStatus(globalIndex, 'advisory')}
                                                                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1 ${
                                                                        item.status === 'advisory'
                                                                            ? 'bg-amber-500 text-slate-950 shadow-sm'
                                                                            : 'text-slate-400 hover:text-white'
                                                                    }`}
                                                                >
                                                                    <AlertTriangle size={12} />
                                                                    Advisory
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    disabled={readOnly || isLocked}
                                                                    onClick={() => handleSetStatus(globalIndex, 'urgent')}
                                                                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1 ${
                                                                        item.status === 'urgent'
                                                                            ? 'bg-red-500 text-white shadow-sm'
                                                                            : 'text-slate-400 hover:text-white'
                                                                    }`}
                                                                >
                                                                    <AlertCircle size={12} />
                                                                    Urgent
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Advisory / Future Work Note input */}
                                                        {(item.status === 'advisory' || item.status === 'urgent' || item.notes) && (
                                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pl-2 border-l-2 border-amber-500/40">
                                                                <input
                                                                    type="text"
                                                                    disabled={readOnly || isLocked}
                                                                    placeholder="Advisory note (e.g. Pads at ~30%, replace at next 5,000 km)"
                                                                    value={item.notes || ''}
                                                                    onChange={e => handleSetNotes(globalIndex, e.target.value)}
                                                                    className="sm:col-span-2 bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg p-2 focus:border-amber-400 outline-none"
                                                                />
                                                                <div className="relative">
                                                                    <span className="absolute left-2 top-2 text-[10px] text-slate-500">LKR</span>
                                                                    <input
                                                                        type="number"
                                                                        disabled={readOnly || isLocked}
                                                                        placeholder="Est. Cost"
                                                                        value={item.estimated_cost_lkr || ''}
                                                                        onChange={e => handleSetCost(globalIndex, e.target.value)}
                                                                        className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg p-2 pl-9 font-mono focus:border-amber-400 outline-none"
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                    {/* 4. Service Advisor General Summary Notes */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Service Advisor Overall Recommendations for Customer
                        </label>
                        <textarea
                            rows={3}
                            disabled={readOnly || isLocked}
                            value={inspectionNotes}
                            onChange={e => setInspectionNotes(e.target.value)}
                            placeholder="Overall vehicle condition summary, driving suggestions, or notes for the customer..."
                            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-xs leading-relaxed focus:border-cyan-500 outline-none"
                        />
                    </div>

                    {/* 5. Sticky/Bottom Save CTA */}
                    <div className="flex items-center justify-between pt-2">
                        <button
                            type="button"
                            onClick={handleDownloadReport}
                            disabled={generatingPdf}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all active:scale-95"
                        >
                            <FileText size={14} /> Download Health PDF Report
                        </button>

                        <button
                            type="button"
                            onClick={() => handleSaveAllItems(items, true)}
                            disabled={saving || readOnly || isLocked}
                            className="px-6 py-2.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/20 transition-all active:scale-95"
                        >
                            {saving ? 'Saving…' : 'Save Health Checklist'}
                        </button>
                    </div>

                </div>
            )}
        </div>
    );
};
