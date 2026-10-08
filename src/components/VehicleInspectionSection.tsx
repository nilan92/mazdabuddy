import React, { useState, useEffect } from 'react';
import { 
    ShieldCheck, 
    Download, 
    Plus, 
    Calendar, 
    ChevronDown, 
    ChevronUp, 
    FileText, 
    Wrench, 
    Sparkles, 
    Clock, 
    RotateCcw,
    Check,
    MessageSquare,
    Save
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
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

const STATUS_BUTTONS: { 
    status: InspectionStatus; 
    code: string; 
    shortLabel: string; 
    label: string; 
    activeClass: string; 
    title: string;
}[] = [
    { 
        status: 'checked', 
        code: '✓', 
        shortLabel: 'OK', 
        label: 'Checked', 
        activeClass: 'bg-emerald-500 text-slate-950 font-black ring-2 ring-emerald-300 shadow-md', 
        title: 'Checked / OK (✓)' 
    },
    { 
        status: 'adjusted', 
        code: 'A', 
        shortLabel: 'Adj', 
        label: 'Adjusted', 
        activeClass: 'bg-sky-500 text-slate-950 font-black ring-2 ring-sky-300 shadow-md', 
        title: 'Adjusted (A)' 
    },
    { 
        status: 'clean', 
        code: 'C', 
        shortLabel: 'Cln', 
        label: 'Clean', 
        activeClass: 'bg-teal-400 text-slate-950 font-black ring-2 ring-teal-200 shadow-md', 
        title: 'Clean / Cleaned (C)' 
    },
    { 
        status: 'replace', 
        code: 'R', 
        shortLabel: 'Rep', 
        label: 'Replace', 
        activeClass: 'bg-amber-400 text-slate-950 font-black ring-2 ring-amber-200 shadow-md', 
        title: 'Replace Recommended (R)' 
    },
    { 
        status: 'problem', 
        code: 'X', 
        shortLabel: 'Bad', 
        label: 'Problem', 
        activeClass: 'bg-rose-500 text-white font-black ring-2 ring-rose-300 shadow-md', 
        title: 'Problem / Fault (X)' 
    },
    { 
        status: 'na', 
        code: 'NA', 
        shortLabel: 'N/A', 
        label: 'N/A', 
        activeClass: 'bg-slate-700 text-white font-bold ring-1 ring-slate-500 shadow-sm', 
        title: 'Not Applicable (NA)' 
    },
];

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
    const confirm = useConfirm();

    // Toggle switch: is this inspection module active for this job?
    const [hasInspection, setHasInspection] = useState<boolean>(Boolean(job?.has_inspection));
    const [isExpanded, setIsExpanded] = useState<boolean>(Boolean(job?.has_inspection));
    const [saving, setSaving] = useState<boolean>(false);
    const [generatingPdf, setGeneratingPdf] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(true);

    // Inspection items
    const [items, setItems] = useState<JobInspectionRecord[]>([]);

    // Toggled note drawers per global index
    const [openNoteIndices, setOpenNoteIndices] = useState<Record<number, boolean>>({});

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

    // Accordion state for categories (7 official sections)
    const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
        '1. [Engine On]': true,
        '2. [Engine Off]': true,
        '3. Wheel / Suspension': false,
        '4. Underbody / Chassis': false,
        '5. Final Checks (Engine On)': false,
        '6. Fluid Leakage': false,
        '7. Final Operations': false,
    });

    // Custom item input
    const [customItemCategory, setCustomItemCategory] = useState<string>('1. [Engine On]');
    const [customItemName, setCustomItemName] = useState<string>('');
    const [showAddCustom, setShowAddCustom] = useState<boolean>(false);

    // Build the default 47-item standard check sheet list
    const createStandardItemsList = (): JobInspectionRecord[] => {
        const defaultList: JobInspectionRecord[] = [];
        INSPECTION_CATEGORIES.forEach(cat => {
            cat.items.forEach(name => {
                defaultList.push({
                    job_id: jobId,
                    tenant_id: tenantId,
                    category: cat.name,
                    item_name: name,
                    status: 'checked',
                    notes: '',
                    estimated_cost_lkr: 0,
                });
            });
        });
        return defaultList;
    };

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
                        // Prepare official 47-item template
                        setItems(createStandardItemsList());
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

    // Toggle observation note drawer for an item
    const toggleItemNote = (index: number) => {
        setOpenNoteIndices(prev => ({
            ...prev,
            [index]: !prev[index]
        }));
    };

    // Mark all items as Checked (✓) (Fast-fill helper)
    const handleMarkAllChecked = () => {
        if (readOnly || isLocked) return;
        const updated = items.map(item => ({ ...item, status: 'checked' as InspectionStatus }));
        setItems(updated);
        toast('All items marked as Checked (✓).', 'info');
    };

    // Reload the official 47-item check sheet template
    const handleResetToStandardSheet = async () => {
        if (readOnly || isLocked) return;
        const ok = await confirm({
            message: "Load the official Periodic Maintenance Check Sheet (47 items)? This will replace existing checklist items for this job card with the standard check sheet.",
            confirmLabel: "Load Standard Sheet",
            confirmStyle: "default"
        });
        if (!ok) return;

        try {
            // Delete old records for this job in Supabase
            await supabase.from('job_inspections').delete().eq('job_id', jobId);
            const standardList = createStandardItemsList();
            setItems(standardList);
            await handleSaveAllItems(standardList, false);
            toast("Loaded official Periodic Maintenance Check Sheet (47 items).", "success");
        } catch (err: any) {
            toast("Error loading template: " + err.message, "error");
        }
    };

    // Toggle expand/collapse all categories
    const handleToggleAllCategories = () => {
        const allOpen = Object.values(openCategories).every(Boolean);
        const newState: Record<string, boolean> = {};
        INSPECTION_CATEGORIES.forEach(c => {
            newState[c.name] = !allOpen;
        });
        setOpenCategories(newState);
    };

    // Add a custom inspection item
    const handleAddCustomItem = () => {
        if (!customItemName.trim()) return;
        const newItem: JobInspectionRecord = {
            job_id: jobId,
            tenant_id: tenantId,
            category: customItemCategory,
            item_name: customItemName.trim(),
            status: 'checked',
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

            if (showToast) toast('Periodic Maintenance Check Sheet saved successfully.', 'success');
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
            toast('Periodic Maintenance Check Sheet PDF downloaded.', 'success');
        } catch (err: any) {
            console.error('Error generating inspection PDF:', err);
            toast('Failed to generate PDF: ' + err.message, 'error');
        } finally {
            setGeneratingPdf(false);
        }
    };

    const counts = getInspectionCounts(items);

    return (
        <div className="border-t border-slate-800 bg-slate-900/60 relative">
            {/* ── TOGGLE HEADER BAR (Compact when off, never clutters) ── */}
            <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        hasInspection 
                            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                        <ShieldCheck size={20} />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-xs font-black text-white uppercase tracking-wider">
                                Periodic Maintenance Check Sheet
                            </h3>
                            {hasInspection && (
                                <div className="flex items-center gap-1.5 text-[10px] font-bold flex-wrap">
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                        {counts.checked} ✓ Checked
                                    </span>
                                    {counts.adjusted > 0 && (
                                        <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
                                            {counts.adjusted} A
                                        </span>
                                    )}
                                    {counts.clean > 0 && (
                                        <span className="px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-400 border border-teal-500/30">
                                            {counts.clean} C
                                        </span>
                                    )}
                                    {counts.replace > 0 && (
                                        <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                            {counts.replace} R
                                        </span>
                                    )}
                                    {counts.problem > 0 && (
                                        <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30">
                                            {counts.problem} X
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            {hasInspection
                                ? 'CODES: ✓ Checked | A Adjusted | C Clean | R Replace | X Problem | NA Not Applicable'
                                : 'Disabled — turn on switch to log periodic maintenance check sheet'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                    {hasInspection && (
                        <>
                            <button
                                type="button"
                                onClick={handleDownloadReport}
                                disabled={generatingPdf}
                                title="Download Check Sheet PDF"
                                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all active:scale-95"
                            >
                                <Download size={13} />
                                {generatingPdf ? 'Generating…' : 'Check Sheet PDF'}
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
                        title={hasInspection ? 'Turn check sheet view OFF' : 'Turn check sheet view ON'}
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
                <div className="px-3 sm:px-4 pb-20 sm:pb-6 space-y-4 animate-fade-in">
                    
                    {/* 1. Quick Toolbar: Fast-fill, Reset, Expand, & Export */}
                    <div className="p-3 bg-slate-950/90 rounded-2xl border border-slate-800 space-y-2.5">
                        {/* Primary Action Buttons */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={handleMarkAllChecked}
                                disabled={readOnly || isLocked}
                                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 shadow-sm transition-all active:scale-95"
                                title="Quickly set all items to Checked (✓) so you only edit exceptions"
                            >
                                <Sparkles size={14} className="text-emerald-400" />
                                <span>Mark All Checked (✓)</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSaveAllItems(items, true)}
                                disabled={saving || readOnly || isLocked}
                                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/25 transition-all active:scale-95"
                            >
                                {saving ? <Clock size={14} className="animate-spin" /> : <Save size={14} />}
                                <span>{saving ? 'Saving…' : 'Save Check Sheet'}</span>
                            </button>
                        </div>

                        {/* Secondary Helper Actions (Scrollable on small mobile screens) */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 text-xs no-scrollbar">
                            <button
                                type="button"
                                onClick={handleResetToStandardSheet}
                                disabled={readOnly || isLocked}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/80 whitespace-nowrap transition-colors shrink-0"
                                title="Reload official 47-item Periodic Maintenance Check Sheet"
                            >
                                <RotateCcw size={12} /> Standard 47 Items
                            </button>
                            <button
                                type="button"
                                onClick={handleToggleAllCategories}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/80 whitespace-nowrap transition-colors shrink-0"
                            >
                                {Object.values(openCategories).every(Boolean) ? 'Collapse All' : 'Expand All'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowAddCustom(!showAddCustom)}
                                disabled={readOnly || isLocked}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/80 whitespace-nowrap transition-colors shrink-0"
                            >
                                <Plus size={13} /> Custom Item
                            </button>
                            <button
                                type="button"
                                onClick={handleDownloadReport}
                                disabled={generatingPdf}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/80 whitespace-nowrap transition-colors shrink-0"
                            >
                                <Download size={13} /> PDF Report
                            </button>
                        </div>
                    </div>

                    {/* CODES LEGEND STRIP */}
                    <div className="px-3 py-2 bg-slate-950/60 rounded-xl border border-slate-800/80 text-[11px] flex flex-wrap items-center justify-between gap-2 text-slate-400">
                        <span className="font-bold text-slate-300 text-[10px] uppercase tracking-wider">Check Codes:</span>
                        <div className="flex flex-wrap items-center gap-2.5 font-mono text-[11px]">
                            <span><strong className="text-emerald-400">✓</strong> OK</span>
                            <span><strong className="text-sky-400">A</strong> Adj</span>
                            <span><strong className="text-teal-400">C</strong> Cln</span>
                            <span><strong className="text-amber-400">R</strong> Rep</span>
                            <span><strong className="text-rose-400">X</strong> Bad</span>
                            <span><strong className="text-slate-400">NA</strong> N/A</span>
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
                                    placeholder="Item name (e.g. Inverter Coolant Hose)"
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
                    <div className="p-3.5 sm:p-4 bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/30 rounded-2xl space-y-3">
                        <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-amber-400" />
                            <h4 className="text-xs font-black text-amber-300 uppercase tracking-wider">
                                Next Routine Service Recommendation
                            </h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
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
                                            className="text-[9px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 active:scale-95 transition-all"
                                        >
                                            +5,000 km
                                        </button>
                                        <button
                                            type="button"
                                            disabled={readOnly || isLocked}
                                            onClick={() => handleMileageShortcut(10000)}
                                            className="text-[9px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 active:scale-95 transition-all"
                                        >
                                            +10,000 km
                                        </button>
                                    </div>
                                </div>
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    disabled={readOnly || isLocked}
                                    placeholder="e.g. 85000"
                                    value={nextServiceMileage}
                                    onChange={e => setNextServiceMileage(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 text-sm font-mono focus:border-amber-400 outline-none"
                                />
                            </div>

                            {/* Target Date */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">
                                        Target Date
                                    </label>
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            disabled={readOnly || isLocked}
                                            onClick={() => handleDateShortcut(3)}
                                            className="text-[9px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 active:scale-95 transition-all"
                                        >
                                            +3 Mo
                                        </button>
                                        <button
                                            type="button"
                                            disabled={readOnly || isLocked}
                                            onClick={() => handleDateShortcut(6)}
                                            className="text-[9px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 active:scale-95 transition-all"
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
                            <span>Loading check sheet…</span>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {INSPECTION_CATEGORIES.map((category, catIndex) => {
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
                                            className="w-full p-3 sm:p-3.5 flex items-center justify-between bg-slate-900/60 hover:bg-slate-800/50 transition-colors text-left"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Wrench size={14} className="text-cyan-400 shrink-0" />
                                                <span className="text-xs font-bold text-white uppercase tracking-wider truncate">
                                                    {category.name}
                                                </span>
                                                <span className="text-[10px] text-slate-500 font-mono shrink-0">
                                                    ({catItems.length})
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                                                {catCounts.replace > 0 && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                                        {catCounts.replace} Rep
                                                    </span>
                                                )}
                                                {catCounts.problem > 0 && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30">
                                                        {catCounts.problem} Bad
                                                    </span>
                                                )}
                                                {catCounts.adjusted > 0 && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
                                                        {catCounts.adjusted} Adj
                                                    </span>
                                                )}
                                                {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                                            </div>
                                        </button>

                                        {/* Items List */}
                                        {isOpen && (
                                            <div className="p-3 divide-y divide-slate-800/60 space-y-3">
                                                {catItems.map((item, itemIdx) => {
                                                    const globalIndex = items.findIndex(it => it.item_name === item.item_name && it.category === item.category);
                                                    const hasSpecialStatus = item.status === 'replace' || item.status === 'advisory' || item.status === 'problem' || item.status === 'urgent' || item.status === 'adjusted' || Boolean(item.notes);
                                                    const isNoteOpen = Boolean(openNoteIndices[globalIndex]) || hasSpecialStatus;

                                                    return (
                                                        <div key={item.item_name} className="pt-3 first:pt-0 space-y-2">
                                                            {/* Item Header & Note Trigger */}
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className="flex items-baseline gap-1.5 min-w-0">
                                                                    <span className="text-[10px] font-mono font-bold text-slate-500 shrink-0">
                                                                        {catIndex + 1}.{itemIdx + 1}
                                                                    </span>
                                                                    <span className="text-xs sm:text-sm font-semibold text-slate-100 leading-snug">
                                                                        {item.item_name}
                                                                    </span>
                                                                </div>

                                                                <button
                                                                    type="button"
                                                                    disabled={readOnly || isLocked}
                                                                    onClick={() => toggleItemNote(globalIndex)}
                                                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors shrink-0 ${
                                                                        item.notes?.trim()
                                                                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                                                            : isNoteOpen
                                                                                ? 'bg-slate-800 text-cyan-300 border border-cyan-500/30'
                                                                                : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                                                                    }`}
                                                                    title="Add or edit observation note"
                                                                >
                                                                    <MessageSquare size={10} />
                                                                    <span>{item.notes?.trim() ? 'Note' : '+ Note'}</span>
                                                                </button>
                                                            </div>

                                                            {/* 6-Code Selector (A, ✓, X, NA, C, R) - Mobile Grid & Desktop Flex */}
                                                            <div className="grid grid-cols-6 gap-1 w-full sm:inline-flex sm:w-auto p-1 bg-slate-900/90 rounded-xl border border-slate-800/80">
                                                                {STATUS_BUTTONS.map(btn => {
                                                                    const isSelected = item.status === btn.status ||
                                                                        (btn.status === 'checked' && item.status === 'good') ||
                                                                        (btn.status === 'replace' && item.status === 'advisory') ||
                                                                        (btn.status === 'problem' && item.status === 'urgent');

                                                                    return (
                                                                        <button
                                                                            key={btn.status}
                                                                            type="button"
                                                                            disabled={readOnly || isLocked}
                                                                            onClick={() => handleSetStatus(globalIndex, btn.status)}
                                                                            className={`flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 py-1.5 sm:py-1 px-1 sm:px-2.5 rounded-lg transition-all active:scale-90 select-none ${
                                                                                isSelected 
                                                                                    ? btn.activeClass 
                                                                                    : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                                                                            }`}
                                                                            title={btn.title}
                                                                        >
                                                                            <span className="font-mono font-black text-xs sm:text-xs">{btn.code}</span>
                                                                            <span className="text-[8px] sm:text-[10px] font-bold uppercase tracking-tight leading-none opacity-90">{btn.shortLabel}</span>
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>

                                                            {/* Observation / Notes / Cost input drawer */}
                                                            {isNoteOpen && (
                                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2 rounded-xl bg-slate-900/50 border border-slate-800/90 pl-3 border-l-2 border-l-cyan-400">
                                                                    <input
                                                                        type="text"
                                                                        disabled={readOnly || isLocked}
                                                                        placeholder="Observation note (e.g. Worn down, cleaned filter, adjusted play...)"
                                                                        value={item.notes || ''}
                                                                        onChange={e => handleSetNotes(globalIndex, e.target.value)}
                                                                        className="sm:col-span-2 bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-lg p-2 focus:border-cyan-400 outline-none placeholder:text-slate-500"
                                                                    />
                                                                    <div className="relative">
                                                                        <span className="absolute left-2.5 top-2 text-[10px] font-bold text-slate-500">LKR</span>
                                                                        <input
                                                                            type="number"
                                                                            inputMode="numeric"
                                                                            disabled={readOnly || isLocked}
                                                                            placeholder="Est. Cost"
                                                                            value={item.estimated_cost_lkr || ''}
                                                                            onChange={e => handleSetCost(globalIndex, e.target.value)}
                                                                            className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-lg p-2 pl-10 font-mono focus:border-cyan-400 outline-none placeholder:text-slate-500"
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

                    {/* 4. Special Comments / Notes */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Special Comments / Workshop Notes
                        </label>
                        <textarea
                            rows={3}
                            disabled={readOnly || isLocked}
                            value={inspectionNotes}
                            onChange={e => setInspectionNotes(e.target.value)}
                            placeholder="Special comments or workshop notes regarding periodic maintenance condition..."
                            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-xs leading-relaxed focus:border-cyan-500 outline-none"
                        />
                    </div>

                    {/* 5. Bottom Save CTA */}
                    <div className="flex items-center justify-between pt-2">
                        <button
                            type="button"
                            onClick={handleDownloadReport}
                            disabled={generatingPdf}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all active:scale-95"
                        >
                            <FileText size={14} /> Download Check Sheet PDF
                        </button>

                        <button
                            type="button"
                            onClick={() => handleSaveAllItems(items, true)}
                            disabled={saving || readOnly || isLocked}
                            className="px-5 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/20 transition-all active:scale-95 flex items-center gap-1.5"
                        >
                            {saving ? <Clock size={13} className="animate-spin" /> : <Save size={13} />}
                            <span>{saving ? 'Saving…' : 'Save Check Sheet'}</span>
                        </button>
                    </div>

                </div>
            )}

            {/* ── STICKY FLOATING BOTTOM BAR ON MOBILE (Thumb-friendly fast actions) ── */}
            {hasInspection && isExpanded && (
                <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 p-2.5 px-4 flex items-center justify-between sm:hidden shadow-2xl">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-black text-emerald-400 flex items-center gap-1">
                            <Check size={14} className="stroke-[3]" />
                            {counts.checked}/{items.length} Checked
                        </span>
                        {(counts.problem > 0 || counts.replace > 0) && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                {counts.problem + counts.replace} Issue{counts.problem + counts.replace > 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={handleDownloadReport}
                            disabled={generatingPdf}
                            className="p-2 rounded-lg text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700 active:scale-95 transition-all"
                            title="Download Check Sheet PDF"
                        >
                            <Download size={14} />
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSaveAllItems(items, true)}
                            disabled={saving || readOnly || isLocked}
                            className="px-3.5 py-2 rounded-lg text-xs font-black bg-cyan-600 hover:bg-cyan-500 text-white shadow-md active:scale-95 transition-all flex items-center gap-1.5"
                        >
                            {saving ? <Clock size={13} className="animate-spin" /> : <Save size={13} />}
                            <span>{saving ? 'Saving…' : 'Save'}</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
