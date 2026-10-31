import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, BarChart3, MousePointerClick, Users, Building2, Menu, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { clickLabel, navLabel, screenLabel } from '../lib/usageLabels';

export interface UsageSummary {
    days: number;
    since: string;
    total_events: number;
    total_users: number;
    screens: { name: string; views: number; users: number }[];
    clicks: { name: string; clicks: number; users: number }[];
    nav: { name: string; taps: number; users: number; sidebar: number; bottom: number; more: number }[];
    daily: { day: string; users: number; events: number }[];
    users: { user_id: string; full_name: string; role: string | null; tenant_name: string | null; last_active: string; events: number; active_days: number }[];
    tenants: { tenant_id: string; tenant_name: string; events: number; users: number; last_active: string }[];
    businesses: { id: string; name: string }[];
}

const card = 'bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4';

function timeAgo(iso: string, now: number): string {
    const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs} h ago`;
    const days = Math.round(hrs / 24);
    return days === 1 ? 'yesterday' : `${days} days ago`;
}

function dayLabel(day: string): string {
    const d = new Date(`${day}T00:00:00`);
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

const Bars = ({ rows, color = 'bg-cyan-500', empty }: { rows: { label: string; value: number; sub?: string }[]; color?: string; empty: string }) => {
    const max = Math.max(1, ...rows.map(r => r.value));
    if (!rows.length) return <p className="text-xs text-slate-500 py-3">{empty}</p>;
    return (
        <ul className="space-y-2.5">
            {rows.map((r, i) => (
                <li key={`${r.label}-${i}`}>
                    <div className="flex items-baseline justify-between gap-3 text-xs">
                        <span className="text-slate-200 font-medium truncate">{r.label}</span>
                        <span className="text-slate-400 shrink-0 tabular-nums">
                            <strong className="text-white">{r.value.toLocaleString()}</strong>{r.sub ? <span className="ml-1.5 text-slate-500">{r.sub}</span> : null}
                        </span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(3, (r.value / max) * 100)}%` }} />
                    </div>
                </li>
            ))}
        </ul>
    );
};

const Section = ({ icon: Icon, title, hint, children }: { icon: typeof Users; title: string; hint?: string; children: React.ReactNode }) => (
    <section className={card}>
        <div className="flex items-center gap-2 mb-3">
            <Icon size={16} className="text-cyan-400" />
            <h3 className="text-sm font-bold text-white">{title}</h3>
            {hint && <span className="ml-auto text-[10px] text-slate-500">{hint}</span>}
        </div>
        {children}
    </section>
);

export const UsageReport = ({ data, now }: { data: UsageSummary; now: number }) => {
    const peakUsers = Math.max(1, ...data.daily.map(d => d.users));
    const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
                <div className={card}>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Active users</p>
                    <p className="text-2xl font-black text-white mt-1">{data.total_users}</p>
                </div>
                <div className={card}>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Screens opened</p>
                    <p className="text-2xl font-black text-white mt-1">{data.screens.reduce((s, r) => s + r.views, 0).toLocaleString()}</p>
                </div>
                <div className={card}>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Taps</p>
                    <p className="text-2xl font-black text-white mt-1">{(data.clicks.reduce((s, r) => s + r.clicks, 0) + data.nav.reduce((s, r) => s + r.taps, 0)).toLocaleString()}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Section icon={Users} title="Active users per day">
                    <ul className="space-y-1.5">
                        {[...data.daily].reverse().map(d => (
                            <li key={d.day} className="flex items-center gap-3 text-xs">
                                <span className="w-24 shrink-0 text-slate-400">{dayLabel(d.day)}</span>
                                <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                                    <div className="h-full rounded-full bg-emerald-500" style={{ width: d.users ? `${Math.max(4, (d.users / peakUsers) * 100)}%` : '0%' }} />
                                </div>
                                <span className="w-16 shrink-0 text-right tabular-nums text-slate-300"><strong className="text-white">{d.users}</strong> <span className="text-slate-500">users</span></span>
                            </li>
                        ))}
                    </ul>
                </Section>

                <Section icon={BarChart3} title="Most opened screens">
                    <Bars empty="No screens opened in this period." rows={data.screens.slice(0, 10).map(s => ({ label: screenLabel(s.name), value: s.views, sub: plural(s.users, 'user') }))} />
                </Section>

                <Section icon={Menu} title="Menu items by taps" hint="for reordering the menu">
                    <Bars color="bg-violet-500" empty="No menu taps yet." rows={data.nav.map(n => ({
                        label: navLabel(n.name),
                        value: n.taps,
                        sub: [n.bottom ? `bar ${n.bottom}` : '', n.more ? `More ${n.more}` : '', n.sidebar ? `side ${n.sidebar}` : ''].filter(Boolean).join(' · '),
                    }))} />
                </Section>

                <Section icon={MousePointerClick} title="Most used buttons">
                    <Bars color="bg-amber-500" empty="No button taps in this period." rows={data.clicks.slice(0, 12).map(c => ({ label: clickLabel(c.name), value: c.clicks, sub: plural(c.users, 'user') }))} />
                </Section>

                <Section icon={Clock} title="Last active">
                    {data.users.length === 0 ? <p className="text-xs text-slate-500 py-3">Nobody active in this period.</p> : (
                        <ul className="divide-y divide-slate-800/80">
                            {data.users.slice(0, 30).map(u => (
                                <li key={u.user_id} className="py-2 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-300 text-xs font-black shrink-0">
                                        {(u.full_name || '?').trim().charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm text-white font-semibold truncate">{u.full_name}<span className="ml-1.5 text-[10px] text-slate-500 font-normal capitalize">{u.role}</span></p>
                                        <p className="text-[11px] text-slate-400 truncate">{u.tenant_name || '—'}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-xs text-slate-200">{timeAgo(u.last_active, now)}</p>
                                        <p className="text-[10px] text-slate-500">{plural(u.active_days, 'day')} · {u.events} events</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </Section>

                <Section icon={Building2} title="Activity per business">
                    <Bars color="bg-sky-500" empty="No activity in this period." rows={data.tenants.map(t => ({ label: t.tenant_name, value: t.events, sub: plural(t.users, 'user') }))} />
                </Section>
            </div>
        </div>
    );
};

export const UsagePanel = () => {
    const [days, setDays] = useState<7 | 30>(7);
    const [tenant, setTenant] = useState<string>('all');
    const [data, setData] = useState<UsageSummary | null>(null);
    const [businesses, setBusinesses] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [notReady, setNotReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError(null);
            const { data: res, error: rpcError } = await supabase.rpc('get_usage_summary', {
                p_days: days,
                p_tenant: tenant === 'all' ? null : tenant,
            });
            if (cancelled) return;
            setNow(Date.now());
            if (rpcError) {
                if (rpcError.code === 'PGRST202' || rpcError.code === '42883' || rpcError.code === '42P01') setNotReady(true);
                else setError(rpcError.message);
                setData(null);
            } else {
                const summary = res as UsageSummary;
                setNotReady(false);
                setData(summary);
                if (summary?.businesses?.length) setBusinesses(summary.businesses);
            }
            setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [days, tenant, reloadKey]);

    const empty = useMemo(() => data && data.total_events === 0, [data]);

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <div className="inline-flex rounded-xl bg-slate-900/80 border border-slate-800 p-1 self-start">
                    {([7, 30] as const).map(d => (
                        <button key={d} onClick={() => setDays(d)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${days === d ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white'}`}>
                            {d} days
                        </button>
                    ))}
                </div>
                <select value={tenant} onChange={e => setTenant(e.target.value)}
                    className="flex-1 sm:flex-none sm:min-w-[240px] bg-slate-900/80 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-base sm:text-sm focus:outline-none focus:border-cyan-500/50">
                    <option value="all">All businesses</option>
                    {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <button onClick={() => setReloadKey(k => k + 1)} disabled={loading}
                    className="sm:ml-auto self-start px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700/60 flex items-center gap-2 disabled:opacity-50">
                    <RefreshCw size={14} className={loading ? 'animate-spin text-cyan-400' : ''} /> Refresh
                </button>
            </div>

            {notReady && (
                <div className={`${card} text-xs text-slate-300 flex items-start gap-3`}>
                    <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                    <span>Usage tracking isn't switched on yet: the database update (update_usage_tracking.sql) hasn't been applied.</span>
                </div>
            )}
            {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-red-300 text-xs flex items-center gap-3">
                    <AlertCircle size={16} className="shrink-0" /> <span>{error}</span>
                </div>
            )}
            {loading && !data && !notReady && <p className="text-xs text-slate-500 py-8 text-center">Loading usage…</p>}
            {empty && <p className="text-xs text-slate-500">No activity recorded in the last {days} days yet. Staff usage appears here as they use the app (your own super-admin browsing is not counted).</p>}
            {data && !empty && <UsageReport data={data} now={now} />}
        </div>
    );
};

export default UsagePanel;
