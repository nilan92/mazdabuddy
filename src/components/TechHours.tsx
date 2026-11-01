import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, ChevronLeft, ChevronRight, ChevronDown, Wrench, Banknote, Download, RefreshCcw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { downloadCSV } from '../lib/csv';
import { toISODate } from '../lib/fiscal';
import { buildTechHoursReport, monthBounds, recentMonths, type TechHoursJob, type TechHoursStaff } from '../lib/techHours.ts';
import { JobDetails } from './JobDetails';

const MONTHS_BACK = 24;
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

// Shown inside the Performance page (admins only) as the "Tech hours" view.
export const TechHours = ({ embedded = false }: { embedded?: boolean }) => {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const months = useMemo(() => recentMonths(new Date(), MONTHS_BACK), []);
  const [idx, setIdx] = useState(1); // last month
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const { year, month } = months[idx];
  const label = new Date(year, month, 1).toLocaleString('default', { month: 'long', year: 'numeric' });

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['tech_hours_history', profile?.tenant_id, year, month],
    enabled: isAdmin,
    staleTime: 60_000,
    queryFn: async () => {
      const { start, end } = monthBounds(year, month);
      const [staffRes, jobsRes] = await Promise.all([
        supabase.from('staff').select('id, name, profile_id, active').order('name'),
        supabase
          .from('job_cards')
          .select(`
            id, description, completed_at, assigned_staff_id, assigned_technician_id, is_outsourced,
            vehicles ( license_plate, make, model ),
            job_labor ( hours, quantity, hourly_rate_lkr, is_fixed, is_outsourced, discount_type, discount_value )
          `)
          .eq('status', 'completed')
          .gte('completed_at', start.toISOString())
          .lt('completed_at', end.toISOString())
          .limit(2000),
      ]);
      if (staffRes.error) throw staffRes.error;
      if (jobsRes.error) throw jobsRes.error;
      return buildTechHoursReport(
        (staffRes.data || []) as TechHoursStaff[],
        (jobsRes.data || []) as unknown as TechHoursJob[],
      );
    },
  });

  if (!isAdmin) return null;

  const rows = data?.rows || [];
  const totals = data?.totals || { jobCount: 0, hours: 0, fixedLines: 0, value: 0 };

  const exportCsv = () => {
    downloadCSV(`tech-hours-${year}-${String(month + 1).padStart(2, '0')}`, rows.flatMap(r =>
      r.jobs.map(j => ({
        Technician: r.name,
        Completed: toISODate(new Date(j.completedAt)),
        Vehicle: `${j.plate} ${j.vehicle}`.trim(),
        Job: j.description,
        'Billed hours': j.hours,
        'Fixed-price lines': j.fixedLines,
        'Labour value (LKR)': j.value,
      }))));
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-3">
        {embedded ? (
          <p className="text-xs sm:text-sm text-slate-400 min-w-0 truncate px-1">Completed jobs by technician · admin only</p>
        ) : (
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 text-brand shrink-0">
            <Clock size={22} className="sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight truncate">Tech Hours</h1>
            <p className="text-[11px] sm:text-xs md:text-sm text-slate-400 truncate">Completed jobs by technician · admin only</p>
          </div>
        </div>
        )}
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={() => refetch()} title="Refresh"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white active:scale-95">
            <RefreshCcw size={16} className={isFetching ? 'animate-spin' : ''} />
          </button>
          <button onClick={exportCsv} disabled={!rows.length} title="Export CSV"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white active:scale-95 disabled:opacity-40">
            <Download size={16} />
          </button>
        </div>
      </div>

      {/* Month picker */}
      <div className="flex items-center gap-2 bg-slate-900/40 p-2 rounded-xl sm:rounded-2xl border border-slate-800">
        <button onClick={() => { setIdx(i => Math.min(months.length - 1, i + 1)); setOpenKey(null); }}
          disabled={idx >= months.length - 1} aria-label="Previous month"
          className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 disabled:opacity-30 active:scale-95">
          <ChevronLeft size={18} />
        </button>
        <div className="relative flex-1">
          <select value={idx} onChange={e => { setIdx(Number(e.target.value)); setOpenKey(null); }}
            className="w-full appearance-none bg-slate-950 border border-slate-800 rounded-lg py-2 pl-3 pr-8 text-base font-semibold text-white text-center focus:outline-none focus:border-brand">
            {months.map((m, i) => (
              <option key={`${m.year}-${m.month}`} value={i}>
                {new Date(m.year, m.month, 1).toLocaleString('default', i < 2 ? { month: 'short', year: 'numeric' } : { month: 'long', year: 'numeric' })}
                {i === 0 ? ' (this month)' : i === 1 ? ' (last month)' : ''}
              </option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-2.5 top-3 text-slate-500 pointer-events-none" />
        </div>
        <button onClick={() => { setIdx(i => Math.max(0, i - 1)); setOpenKey(null); }}
          disabled={idx === 0} aria-label="Next month"
          className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 disabled:opacity-30 active:scale-95">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {[
          { icon: Clock, label: 'Hours', value: `${totals.hours}h`, cls: 'text-white' },
          { icon: Wrench, label: 'Jobs', value: String(totals.jobCount), cls: 'text-white' },
          { icon: Banknote, label: 'Labour', value: Math.round(totals.value).toLocaleString(), cls: 'text-emerald-400' },
        ].map(k => (
          <div key={k.label} className="bg-slate-900/60 border border-slate-800/80 p-3 sm:p-4 rounded-xl sm:rounded-2xl">
            <div className="text-[11px] sm:text-xs text-slate-400 font-medium mb-0.5 flex items-center gap-1.5 truncate">
              <k.icon size={12} className="text-brand shrink-0" /> {k.label}
            </div>
            <div className={`text-base sm:text-2xl font-bold font-mono truncate ${k.cls}`}>{isLoading ? '…' : k.value}</div>
          </div>
        ))}
      </div>

      {/* Per-technician table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl sm:rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[1fr_3rem_4rem_6.5rem] sm:grid-cols-[1fr_5rem_6rem_9rem] gap-2 px-3 sm:px-4 py-2 text-[10px] sm:text-xs uppercase tracking-wide text-slate-500 border-b border-slate-800">
          <span>Technician</span><span className="text-right">Jobs</span><span className="text-right">Hours</span><span className="text-right">Labour LKR</span>
        </div>

        {error ? (
          <div className="p-6 text-center text-sm text-red-400">Couldn't load {label}. Pull to refresh.</div>
        ) : isLoading ? (
          <div className="p-6 text-center text-sm text-slate-500">Loading {label}…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">No completed jobs in {label}.</div>
        ) : rows.map(r => {
          const open = openKey === r.key;
          return (
            <div key={r.key} className="border-b border-slate-800/70 last:border-b-0">
              <button onClick={() => setOpenKey(open ? null : r.key)}
                className={`w-full grid grid-cols-[1fr_3rem_4rem_6.5rem] sm:grid-cols-[1fr_5rem_6rem_9rem] gap-2 items-center px-3 sm:px-4 py-3 text-left active:bg-slate-800/60 ${open ? 'bg-slate-800/40' : ''}`}>
                <span className={`flex items-center gap-1.5 min-w-0 font-semibold text-sm ${r.unassigned ? 'text-slate-400 italic' : 'text-white'}`}>
                  <ChevronRight size={14} className={`shrink-0 text-slate-500 transition-transform ${open ? 'rotate-90' : ''}`} />
                  <span className="truncate">{r.name}</span>
                </span>
                <span className="text-right font-mono text-sm text-slate-300">{r.jobCount}</span>
                <span className="text-right font-mono text-sm text-white leading-tight">
                  {r.hours}h
                  {r.fixedLines > 0 && <span className="block text-[10px] text-amber-400">+{r.fixedLines} fixed</span>}
                </span>
                <span className="text-right font-mono text-sm text-emerald-400">{r.value.toLocaleString()}</span>
              </button>

              {open && (
                <div className="bg-slate-950/60 px-3 sm:px-4 py-2 space-y-1.5">
                  {r.jobs.map(j => (
                    <button key={j.id} onClick={() => setSelectedJobId(j.id)}
                      className="w-full flex items-start justify-between gap-3 p-2.5 rounded-lg bg-slate-900/70 border border-slate-800 text-left active:scale-[0.99]">
                      <div className="min-w-0">
                        <div className="text-xs font-mono font-bold text-white truncate">
                          {j.plate} <span className="font-sans font-normal text-slate-400">{j.vehicle}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">{j.description || 'No description'}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-mono text-white">
                          {j.hours}h{j.fixedLines > 0 && <span className="text-amber-400"> +{j.fixedLines} fixed</span>}
                        </div>
                        <div className="text-[11px] font-mono text-emerald-400">{j.value.toLocaleString()}</div>
                        <div className="text-[10px] text-slate-500">{fmtDay(j.completedAt)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {rows.length > 0 && !isLoading && (
          <div className="grid grid-cols-[1fr_3rem_4rem_6.5rem] sm:grid-cols-[1fr_5rem_6rem_9rem] gap-2 px-3 sm:px-4 py-3 bg-slate-950/80 border-t border-slate-700 font-bold">
            <span className="text-sm text-white pl-5">Total</span>
            <span className="text-right font-mono text-sm text-white">{totals.jobCount}</span>
            <span className="text-right font-mono text-sm text-white">{totals.hours}h</span>
            <span className="text-right font-mono text-sm text-emerald-400">{Math.round(totals.value).toLocaleString()}</span>
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-500 px-1">
        Hours = billed labour hours on completed jobs (by completion date). Fixed-price lines count in labour value, not hours. Sublet work excluded.
      </p>

      {selectedJobId && (
        <JobDetails jobId={selectedJobId} readOnly onClose={() => setSelectedJobId(null)} onUpdate={() => refetch()} />
      )}
    </div>
  );
};
