import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, Clock, Package, Wrench, Phone, AlertCircle, Download, Camera, ShieldCheck, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { withTitle } from '../lib/textCase';

/**
 * Public, no login. Reached at /#/status/<public_token>.
 *
 * Everything here comes from the get_job_status() function, which returns a
 * deliberately narrow row — no prices, no notes, no ids. The token is the only
 * credential, so the page must never ask for or display anything more.
 */

interface StatusRow {
    status: string;
    created_at: string;
    completed_at: string | null;
    make: string | null;
    model: string | null;
    license_plate: string | null;
    customer_title: string | null;
    customer_name: string | null;
    shop_name: string | null;
    shop_phone: string | null;
    shop_logo_url: string | null;
}

interface InspectionItem {
    id?: string;
    category: string;
    item_name: string;
    status: 'good' | 'advisory' | 'urgent';
    notes?: string;
    estimated_cost_lkr?: number;
}

interface InspectionPayload {
    has_inspection: boolean;
    next_service_mileage: number | null;
    next_service_date: string | null;
    inspection_notes: string | null;
    mileage: number | null;
    inspections: InspectionItem[];
}

interface StatusPhoto {
    url: string;
    taken_at: string;
}

/**
 * `<a download>` is ignored cross-origin — the browser navigates to the image
 * instead of saving it — so the bytes have to come back as a blob first. That
 * needs CORS on the bucket, which may not be set, hence the fallback: open the
 * image so the customer can save it by long-press.
 */
async function savePhoto(url: string, index: number) {
    try {
        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = `photo-${index + 1}.${(blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(objectUrl);
    } catch {
        window.open(url, '_blank', 'noopener');
    }
}

const STEPS = [
    { key: 'pending', label: 'Received', icon: Clock },
    { key: 'waiting_parts', label: 'Waiting for Parts', icon: Package },
    { key: 'in_progress', label: 'In Progress', icon: Wrench },
    { key: 'completed', label: 'Ready for Collection', icon: CheckCircle },
];

const HEADLINE: Record<string, string> = {
    pending: 'We have your vehicle',
    waiting_parts: 'Waiting for parts',
    in_progress: 'Work in progress',
    completed: 'Ready for collection',
};

export const JobStatus = () => {
    const { token } = useParams<{ token: string }>();
    const [row, setRow] = useState<StatusRow | null>(null);
    const [photos, setPhotos] = useState<StatusPhoto[]>([]);
    const [inspectionData, setInspectionData] = useState<InspectionPayload | null>(null);
    const [showAllInspections, setShowAllInspections] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!token) { setLoading(false); return; }
            const [status, pics, insp] = await Promise.all([
                supabase.rpc('get_job_status', { p_token: token }),
                supabase.rpc('get_job_photos', { p_token: token }),
                supabase.rpc('get_job_inspection', { p_token: token }),
            ]);
            if (cancelled) return;
            if (status.error) console.warn('status lookup failed', status.error.message);
            // Photos and inspections are optional — a failure here must not blank the status page.
            if (pics.error) console.warn('photo lookup failed', pics.error.message);
            if (insp.error) console.warn('inspection lookup failed', insp.error.message);
            setRow((status.data as StatusRow[] | null)?.[0] ?? null);
            setPhotos((pics.data as StatusPhoto[] | null) ?? []);
            setInspectionData((insp.data as InspectionPayload[] | null)?.[0] ?? null);
            setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [token]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500">
                Checking…
            </div>
        );
    }

    if (!row) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
                <div className="text-center max-w-sm">
                    <AlertCircle size={40} className="mx-auto text-slate-600 mb-4" />
                    <h1 className="text-xl font-bold text-white mb-2">Link not found</h1>
                    <p className="text-slate-400 text-sm">
                        This status link is no longer valid. Please contact the workshop
                        for an update.
                    </p>
                </div>
            </div>
        );
    }

    const currentIndex = STEPS.findIndex(s => s.key === row.status);
    const vehicle = [row.make, row.model].filter(Boolean).join(' ') || 'Your vehicle';

    return (
        <div className="min-h-screen bg-slate-950 text-white px-5 py-10">
            <div className="max-w-md mx-auto">

                <header className="flex items-center gap-3 mb-10">
                    {row.shop_logo_url && (
                        <img src={row.shop_logo_url} alt="" className="w-11 h-11 rounded-xl object-contain bg-white/5" />
                    )}
                    <div className="min-w-0">
                        <p className="font-bold truncate">{row.shop_name}</p>
                        {row.shop_phone && <p className="text-xs text-slate-500">{row.shop_phone}</p>}
                    </div>
                </header>

                <p className="text-slate-400 text-sm mb-1">
                    {withTitle(row.customer_title, row.customer_name) || 'Hello'}
                </p>
                <h1 className="text-3xl font-black mb-1 leading-tight">
                    {HEADLINE[row.status] ?? 'Update'}
                </h1>
                <p className="text-slate-400 mb-10">
                    {vehicle}{row.license_plate ? ` · ${row.license_plate}` : ''}
                </p>

                <ol className="space-y-1 mb-10">
                    {STEPS.map((step, i) => {
                        const Icon = step.icon;
                        const done = currentIndex >= 0 && i <= currentIndex;
                        const active = i === currentIndex;
                        return (
                            <li key={step.key} className="flex items-center gap-4">
                                <div className="flex flex-col items-center">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border transition-colors ${
                                        active ? 'bg-cyan-500 border-cyan-400 text-slate-950'
                                        : done ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400'
                                        : 'bg-slate-900 border-slate-800 text-slate-600'}`}>
                                        <Icon size={18} />
                                    </div>
                                    {i < STEPS.length - 1 && (
                                        <div className={`w-px h-8 ${done ? 'bg-cyan-500/40' : 'bg-slate-800'}`} />
                                    )}
                                </div>
                                <span className={`text-sm ${active ? 'text-white font-bold' : done ? 'text-slate-300' : 'text-slate-600'}`}>
                                    {step.label}
                                </span>
                            </li>
                        );
                    })}
                </ol>

                {/* ── VEHICLE HEALTH & FUTURE CARE REPORT ── */}
                {inspectionData?.has_inspection && (inspectionData.inspections?.length ?? 0) > 0 && (() => {
                    const insps = inspectionData.inspections || [];
                    const goodCount = insps.filter(i => i.status === 'good').length;
                    const advisoryItems = insps.filter(i => i.status === 'advisory');
                    const urgentItems = insps.filter(i => i.status === 'urgent');

                    return (
                        <section className="mb-10 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="text-cyan-400 shrink-0" size={18} />
                                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                                        Vehicle Health &amp; Care Report
                                    </h2>
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] font-bold">
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                        {goodCount} Passed
                                    </span>
                                    {advisoryItems.length > 0 && (
                                        <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                            {advisoryItems.length} Future
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Next Routine Service Target */}
                            {(inspectionData.next_service_mileage || inspectionData.next_service_date) && (
                                <div className="p-3.5 bg-gradient-to-br from-amber-500/10 via-slate-950 to-slate-950 border border-amber-500/30 rounded-xl space-y-1">
                                    <div className="text-[10px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <Calendar size={12} /> Next Routine Service Due
                                    </div>
                                    <div className="text-sm font-bold text-white flex flex-wrap items-baseline gap-x-2">
                                        {inspectionData.next_service_mileage && (
                                            <span>Target: {Number(inspectionData.next_service_mileage).toLocaleString()} km</span>
                                        )}
                                        {inspectionData.next_service_date && (
                                            <span className="text-xs text-amber-300/80 font-normal">
                                                (Est. {new Date(inspectionData.next_service_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })})
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Advisories / Future Work Attention Items */}
                            {(advisoryItems.length > 0 || urgentItems.length > 0) && (
                                <div className="space-y-2">
                                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                        Items to Watch for Next Visit
                                    </h3>
                                    <div className="space-y-2">
                                        {urgentItems.map((item, idx) => (
                                            <div key={`u-${idx}`} className="p-3 bg-red-950/20 border border-red-500/30 rounded-xl space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-bold text-red-200">{item.item_name}</span>
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 uppercase">
                                                        Urgent
                                                    </span>
                                                </div>
                                                {item.notes && (
                                                    <p className="text-xs text-slate-300 italic">"{item.notes}"</p>
                                                )}
                                            </div>
                                        ))}
                                        {advisoryItems.map((item, idx) => (
                                            <div key={`a-${idx}`} className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-xl space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-bold text-amber-200">{item.item_name}</span>
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 uppercase">
                                                        Advisory
                                                    </span>
                                                </div>
                                                {item.notes && (
                                                    <p className="text-xs text-slate-300 italic">"{item.notes}"</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Service Advisor General Notes */}
                            {inspectionData.inspection_notes && (
                                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Advisor Notes</span>
                                    <p className="italic leading-relaxed">"{inspectionData.inspection_notes}"</p>
                                </div>
                            )}

                            {/* Expandable full multi-point list */}
                            <div className="pt-2 border-t border-slate-800/80">
                                <button
                                    type="button"
                                    onClick={() => setShowAllInspections(!showAllInspections)}
                                    className="w-full py-2 text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center justify-center gap-1.5 transition-colors"
                                >
                                    {showAllInspections ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    {showAllInspections ? 'Hide Full Multi-Point Checklist' : `View All Checked Systems (${insps.length})`}
                                </button>

                                {showAllInspections && (
                                    <div className="mt-3 pt-3 border-t border-slate-800/60 divide-y divide-slate-800/40 text-xs">
                                        {insps.map((item, idx) => (
                                            <div key={idx} className="py-2 flex items-center justify-between gap-2">
                                                <span className="text-slate-300 font-medium truncate">{item.item_name}</span>
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                                    item.status === 'good'
                                                        ? 'bg-emerald-500/10 text-emerald-400'
                                                        : item.status === 'urgent'
                                                        ? 'bg-red-500/10 text-red-400'
                                                        : 'bg-amber-500/10 text-amber-400'
                                                }`}>
                                                    {item.status.toUpperCase()}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </section>
                    );
                })()}

                {photos.length > 0 && (
                    <section className="mb-10">
                        <h2 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                            <Camera size={15} className="text-cyan-400" />
                            Photos from the workshop
                        </h2>
                        <div className="grid grid-cols-2 gap-2">
                            {photos.map((photo, i) => (
                                <div key={photo.url} className="relative aspect-square rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
                                    <a href={photo.url} target="_blank" rel="noopener noreferrer">
                                        <img
                                            src={photo.url}
                                            alt={`Workshop photo ${i + 1}`}
                                            loading="lazy"
                                            className="w-full h-full object-cover"
                                        />
                                    </a>
                                    <button
                                        onClick={() => savePhoto(photo.url, i)}
                                        title="Save this photo"
                                        aria-label={`Save photo ${i + 1}`}
                                        className="absolute bottom-1.5 right-1.5 p-2 rounded-lg bg-black/70 text-white hover:bg-black active:scale-95 transition-all"
                                    >
                                        <Download size={15} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-3">
                            Tap a photo to view it full size, or the arrow to save it. These stay
                            here while the workshop keeps this job open — save anything you want
                            to keep.
                        </p>
                    </section>
                )}

                {row.shop_phone && (
                    <a
                        href={`tel:${row.shop_phone}`}
                        className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-slate-900 border border-slate-800 font-bold hover:bg-slate-800 transition-colors"
                    >
                        <Phone size={17} /> Call the workshop
                    </a>
                )}

                <p className="text-center text-[11px] text-slate-600 mt-8">
                    Job opened {new Date(row.created_at).toLocaleDateString('en-GB', {
                        day: '2-digit', month: 'short', year: 'numeric',
                    })}
                </p>
            </div>
        </div>
    );
};
