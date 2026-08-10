import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, Clock, Package, Wrench, Phone, AlertCircle } from 'lucide-react';
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
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!token) { setLoading(false); return; }
            const { data, error } = await supabase.rpc('get_job_status', { p_token: token });
            if (cancelled) return;
            if (error) console.warn('status lookup failed', error.message);
            setRow((data as StatusRow[] | null)?.[0] ?? null);
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
