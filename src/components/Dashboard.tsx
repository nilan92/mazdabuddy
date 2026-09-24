import { createPortal } from 'react-dom';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Briefcase, DollarSign, Users, Activity, RefreshCcw, Quote, X, CheckCircle2, Trophy, Target, TrendingUp, Clock, Flame, Calendar, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';

// --- UI Components ---
const StatCard = ({ title, value, subtext, icon: Icon, colorClass, onClick }: any) => (
  <div
    onClick={onClick}
    className={`bg-slate-900/50 backdrop-blur border border-slate-800 p-4 rounded-2xl relative overflow-hidden group ${onClick ? 'cursor-pointer hover:bg-slate-800/80 transition-all active:scale-[0.98]' : ''}`}
  >
    <div className={`absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity ${colorClass}`}>
      <Icon size={48} />
    </div>
    <div className="flex items-center gap-3 mb-2">
      <div className={`p-2 rounded-xl bg-slate-800 ${colorClass}`}>
        <Icon size={20} />
      </div>
      <h3 className="text-slate-400 font-medium text-sm">{title}</h3>
    </div>
    <div className="text-2xl font-bold text-white mb-1">{value}</div>
    <div className="text-xs text-slate-500">{subtext}</div>
  </div>
);

const SkeletonCard = () => (
    <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl animate-pulse h-32">
        <div className="h-8 w-8 bg-slate-800 rounded-lg mb-4"></div>
        <div className="h-8 w-24 bg-slate-800 rounded mb-2"></div>
        <div className="h-4 w-16 bg-slate-800 rounded"></div>
    </div>
);

import { useTechnicianProgress, type AdminTechnicianSummary } from '../hooks/useTechnicianProgress';
import { StaffPerformanceModal } from './StaffPerformanceModal';

// --- Main Component ---
export const Dashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [showQuote, setShowQuote] = useState(false);
  const [currentQuote, setCurrentQuote] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<AdminTechnicianSummary | null>(null);

  const quotes = [
      "Process is the foundation of freedom. The tighter the system, the more creative you can be.",
      "Don't manage people, manage the flow. Let the system do the heavy lifting.",
      "Precision beats power. Timing beats speed.",
      "Efficiency isn't about working harder. It's about removing friction.",
      "A clean shop is a clean mind. Order creates opportunity."
  ];

  const handleEfficiencyClick = () => {
      const random = quotes[Math.floor(Math.random() * quotes.length)];
      setCurrentQuote(random);
      setShowQuote(true);
  };

  const { data: dashboardData, isLoading: loading, isFetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      // 1. FAST: Get aggregated stats from Server
      const { data: stats, error: statsError } = await supabase.rpc('get_dashboard_stats');
      
      if (statsError) {
          console.error('Stats Error:', statsError);
          // Return safe defaults if DB function is missing
          return { stats: null, recentJobs: [], lowStock: [] };
      }

      // 2. Fetch Recent Jobs (Limit 5)
      const { data: recent } = await supabase
        .from('job_cards')
        // @ts-ignore
        .select('*, vehicles(license_plate, make, model)')
        .order('created_at', { ascending: false })
        .limit(5);

      // 3. Fetch Low Stock List (Limit 5)
      const { data: lowStock } = await supabase
        .from('parts')
        .select('*')
        .lte('stock_quantity', 5)
        .limit(5);

      // 4. Calculate Real Shop Efficiency (Last 20 Completed Jobs)
      const { data: effJobs } = await supabase
        .from('job_cards')
        .select('estimated_hours, total_labor_time')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(20);

      let shopEfficiency: string = 'N/A';
      if (effJobs && effJobs.length > 0) {
          const validJobs = effJobs.filter((job: any) => {
              const est = Number(job.estimated_hours) || 0;
              return est > 0;
          });
          if (validJobs.length > 0) {
              const totalEff = validJobs.reduce((acc: number, job: any) => {
                  const est = Number(job.estimated_hours) || 0;
                  let rawActual = (job.total_labor_time || 0) / 60;
                  // If timer was never run, assume completed on target
                  if (rawActual <= 0) rawActual = est;
                  // Discard overnight timer accidents (>12h for single job)
                  const actual = (rawActual > 12 && est < 8) ? est * 1.05 : rawActual;
                  return acc + Math.min(Math.max((est / actual) * 100, 40), 200); // bound realistic 40% - 200%
              }, 0);
              shopEfficiency = `${Math.round(totalEff / validJobs.length)}%`;
          }
      }

      return {
          stats: {
            revenue: stats.monthly_revenue || 0,
            activeJobs: stats.active_jobs || 0,
            totalCustomers: stats.total_customers || 0,
            completedMonth: stats.completed_jobs_month || 0,
            efficiency: shopEfficiency,
          },
          recentJobs: recent || [],
          lowStock: lowStock || []
      };
    }
  });

  // Technician Monthly Progress & Milestones Hook
  const { isTechnician, techData, adminTechData } = useTechnicianProgress();

  const refreshDashboard = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['technician_progress'] });
  };

  const stats = dashboardData?.stats || { revenue: 0, activeJobs: 0, totalCustomers: 0, completedMonth: 0, efficiency: '0%' };
  const recentJobs = dashboardData?.recentJobs || [];
  const lowStock = dashboardData?.lowStock || [];

  const statCards = isTechnician ? [
    { 
      title: 'Hours Covered', 
      value: `${techData?.totalHoursCompleted ?? 0} / ${techData?.targetHours ?? 200}h`, 
      subtext: `${techData?.progressPercent ?? 0}% of monthly milestone target`, 
      icon: Clock, 
      colorClass: 'text-brand', 
      onClick: () => {} 
    },
    { 
      title: 'Completed This Month', 
      value: `${techData?.completedCount ?? stats.completedMonth} jobs`, 
      subtext: `${techData?.avgHoursPerJob ?? '0'} hrs avg / completed job`, 
      icon: CheckCircle2, 
      colorClass: 'text-emerald-400', 
      onClick: () => navigate('/jobs') 
    },
    { 
      title: 'Active Floor Jobs', 
      value: `${techData?.activeCount ?? stats.activeJobs} jobs`, 
      subtext: `${techData?.pipelineHours ?? 0} hrs in active pipeline`, 
      icon: Briefcase, 
      colorClass: 'text-cyan-400', 
      onClick: () => navigate('/jobs') 
    },
    { 
      title: 'Monthly Milestone', 
      value: techData?.milestone.badge || '🌱 Starter', 
      subtext: techData?.hoursRemaining === 0 
        ? 'Top tier achieved! (200h+)' 
        : `${techData?.milestone.hoursToNextTier ?? 0}h to ${techData?.milestone.nextTierName || 'Goal'}`, 
      icon: Trophy, 
      colorClass: 'text-amber-400', 
      onClick: () => {} 
    },
  ] : [
    { title: 'Monthly Revenue', value: `LKR ${(stats.revenue).toLocaleString()}`, subtext: 'Invoices this month', icon: DollarSign, colorClass: 'text-emerald-400', onClick: () => navigate('/finances') },
    { title: 'Active Jobs', value: stats.activeJobs, subtext: 'Currently on floor', icon: Briefcase, colorClass: 'text-brand', onClick: () => navigate('/jobs') },
    { title: 'Total Customers', value: stats.totalCustomers, subtext: 'Registered clients', icon: Users, colorClass: 'text-violet-400', onClick: () => navigate('/customers') },
    { title: 'Efficiency', value: stats.efficiency, subtext: stats.efficiency === 'N/A' ? 'No labor data yet' : 'Last 20 completed jobs', icon: Activity, colorClass: 'text-amber-400', onClick: handleEfficiencyClick },
  ];

  return (
    <div className="p-2 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-slate-400">Welcome back, {profile?.full_name?.split(' ')[0] || 'Member'}. Here's what's happening today.</p>
        </div>
        <div className="flex items-center gap-3">
             <button 
                onClick={refreshDashboard}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all active:scale-95"
                title="Refresh Dashboard"
            >
                <RefreshCcw size={20} className={(loading || isFetching) ? 'animate-spin' : ''} />
            </button>
             <button 
                onClick={() => navigate('/scan')}
                className="px-4 py-2.5 btn-brand rounded-xl font-bold shadow-lg active:scale-95">
            Scanning Tool
          </button>
          <button 
                onClick={() => navigate('/jobs?action=new')}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all active:scale-95">
            + New Job
          </button>
        </div>
      </div>

      {/* STATS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {loading ? (
            <>
                <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
            </>
        ) : (
            <>
                {statCards.map((card, i) => (
                  <motion.div key={card.title}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.07, ease: [0.25, 0.1, 0.25, 1] }}
                  >
                    <StatCard {...card} />
                  </motion.div>
                ))}
            </>
        )}
      </div>

      {showQuote && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowQuote(false)}>
              <div className="bg-slate-900 border border-slate-700 p-6 sm:p-8 rounded-3xl max-w-md w-full relative shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setShowQuote(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors">
                      <X size={24} />
                  </button>
                  <div className="flex flex-col items-center text-center">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 bg-brand/10 rounded-2xl flex items-center justify-center text-brand mb-5 sm:mb-6 border border-brand/20 shrink-0">
                          <Quote size={32} />
                      </div>
                      <h3 className="text-lg sm:text-xl font-bold text-white mb-4 leading-relaxed">"{currentQuote}"</h3>
                      <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">- Management Era</p>
                  </div>
              </div>
          </div>,
          document.body
      )}

      {/* ── TECHNICIAN MONTHLY PROGRESS & MILESTONES CARD ── */}
      {isTechnician && techData && (
        <div className="bg-gradient-to-b from-slate-900/90 to-slate-900/40 border border-slate-800/80 rounded-3xl p-5 md:p-8 relative overflow-hidden shadow-2xl backdrop-blur-xl space-y-6">
          <div className="absolute -top-32 -right-32 w-80 h-80 bg-brand/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand/15 text-brand border border-brand/30 flex items-center gap-1.5">
                  <Flame size={12} className="text-amber-400 animate-pulse" />
                  Monthly Performance Target
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {techData.monthName}
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-2.5">
                <span>{techData.totalHoursCompleted}</span>
                <span className="text-slate-500 text-base md:text-lg font-normal">/ {techData.targetHours} Hours Covered</span>
              </h2>
              <p className="text-xs md:text-sm text-slate-400 mt-1">
                Every repair you complete credits hours to your profile. Cover <span className="text-amber-300 font-bold">{techData.targetHours} hrs</span> to reach the Champion Tier!
              </p>
            </div>

            <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
              {techData.hoursRemaining === 0 ? (
                <div className="px-4 py-2 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/10">
                  <Trophy size={18} className="text-amber-400 animate-bounce" />
                  <span>TARGET ACHIEVED!</span>
                </div>
              ) : (
                <div className="px-4 py-2 rounded-2xl bg-slate-800/80 border border-slate-700/80 text-white font-bold text-sm flex items-center gap-2">
                  <Target size={16} className="text-brand" />
                  <span>
                    {techData.milestone.nextTierName ? (
                      <><strong className="text-brand">{techData.milestone.hoursToNextTier} hrs</strong> to {techData.milestone.nextTierName}</>
                    ) : (
                      <><strong className="text-brand">{techData.hoursRemaining} hrs</strong> to 200h Tier</>
                    )}
                  </span>
                </div>
              )}
              <span className="text-[11px] text-slate-500 font-medium">
                {techData.smartPace.workingDaysLeft} workdays remaining this month
              </span>
            </div>
          </div>

          {/* Visual Progress Bar with Milestones */}
          <div className="space-y-2 relative z-10">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-slate-400 flex items-center gap-1.5">
                <TrendingUp size={13} className="text-brand" />
                Progress towards 200 hrs goal
              </span>
              <span className="text-brand font-mono font-bold text-sm">
                {techData.progressPercent}% Completed ({techData.milestone.badge})
              </span>
            </div>

            <div className="h-6 bg-slate-950/80 rounded-2xl p-1 border border-slate-800/90 relative overflow-hidden shadow-inner">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, Math.max(3, techData.progressPercent))}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className="h-full rounded-xl bg-gradient-to-r from-sky-500 via-brand to-emerald-400 relative flex items-center justify-end pr-2 text-[10px] font-black text-slate-950 shadow-md shadow-brand/20"
              >
                {techData.progressPercent >= 10 && `${techData.progressPercent}%`}
              </motion.div>
            </div>

            {/* Checkpoint Milestones */}
            <div className="grid grid-cols-4 text-center pt-1 text-[10px] text-slate-500 font-semibold border-t border-slate-800/60 mt-2">
              <div className={techData.totalHoursCompleted >= 50 ? 'text-amber-400' : ''}>
                <div className="font-bold">50 hrs</div>
                <div className="text-[9px] text-slate-600">🥉 Bronze (25%)</div>
              </div>
              <div className={techData.totalHoursCompleted >= 100 ? 'text-slate-200' : ''}>
                <div className="font-bold">100 hrs</div>
                <div className="text-[9px] text-slate-600">🥈 Silver (50%)</div>
              </div>
              <div className={techData.totalHoursCompleted >= 150 ? 'text-yellow-300' : ''}>
                <div className="font-bold">150 hrs</div>
                <div className="text-[9px] text-slate-600">🥇 Gold (75%)</div>
              </div>
              <div className={techData.totalHoursCompleted >= 200 ? 'text-emerald-400 font-black' : ''}>
                <div className="font-bold flex items-center justify-center gap-1">
                  <Trophy size={11} className={techData.totalHoursCompleted >= 200 ? 'text-amber-400' : ''} />
                  200 hrs
                </div>
                <div className="text-[9px] text-slate-600">🏆 Champion (100%)</div>
              </div>
            </div>
          </div>

          {/* Two-Column Visual Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2 relative z-10">
            {/* Weekly Momentum Chart (7 cols) */}
            <div className="lg:col-span-7 bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 md:p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-brand/10 text-brand">
                    <Calendar size={15} />
                  </div>
                  <h3 className="text-xs md:text-sm font-bold text-white uppercase tracking-wider">
                    Weekly Hours Momentum
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  {techData.monthName}
                </span>
              </div>

              {/* Bars */}
              <div className="grid grid-cols-4 gap-3 items-end h-36 pt-6 pb-2 px-2">
                {(() => {
                  const maxHours = Math.max(10, ...techData.weeklyStats.map((w: any) => w.hours));
                  return techData.weeklyStats.map((week: any, idx: number) => {
                    const heightPercent = Math.max(12, Math.round((week.hours / maxHours) * 100));
                    const isCurrentWeek = idx === Math.min(3, Math.floor((new Date().getDate() - 1) / 7));
                    return (
                      <div key={week.label} className="flex flex-col items-center h-full justify-end group">
                        <span className="text-[10px] font-mono font-bold text-white mb-1.5 group-hover:text-brand transition-colors">
                          {week.hours > 0 ? `${week.hours}h` : '0h'}
                        </span>
                        <div className="w-full max-w-[42px] bg-slate-900 rounded-t-xl overflow-hidden relative border border-slate-800 flex-1 flex items-end">
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${heightPercent}%` }}
                            transition={{ duration: 0.6, delay: idx * 0.1 }}
                            className={`w-full rounded-t-lg transition-all ${
                              week.hours > 0
                                ? isCurrentWeek
                                  ? 'bg-gradient-to-t from-brand to-amber-300 shadow-md shadow-brand/20'
                                  : 'bg-gradient-to-t from-sky-600 to-cyan-400'
                                : 'bg-slate-800'
                            }`}
                          />
                        </div>
                        <div className="text-center mt-2">
                          <div className={`text-[10px] font-bold ${isCurrentWeek ? 'text-brand' : 'text-slate-400'}`}>
                            {week.label}
                          </div>
                          <div className="text-[9px] text-slate-500 font-mono">
                            {week.jobs} {week.jobs === 1 ? 'job' : 'jobs'}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Performance Insights (5 cols) */}
            <div className="lg:col-span-5 flex flex-col justify-between gap-3">
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <TrendingUp size={13} /> Workday Pace & Capacity
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Velocity: {techData.smartPace.currentVelocity}h/day
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-white">{techData.smartPace.paceValue}</span>
                  <span className="text-xs text-slate-400">{techData.smartPace.paceUnit}</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  {techData.smartPace.paceSubtext}
                </div>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                  <Briefcase size={13} className="text-cyan-400" /> In-Progress Pipeline
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-white">{techData.pipelineHours}</span>
                  <span className="text-xs text-slate-400">hours waiting</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Across {techData.activeCount} active assigned jobs currently in the workshop.
                </div>
              </div>
            </div>
          </div>

          {/* Credited Jobs Feed (This Month) */}
          <div className="pt-2 border-t border-slate-800/80 relative z-10">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-400" />
                Jobs Credited to Your Profile ({techData.completedJobs.length})
              </h3>
              <span className="text-[11px] text-slate-500 font-mono">
                {techData.totalHoursCompleted} hrs earned
              </span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {techData.completedJobs.map((job: any) => (
                <div
                  key={job.id}
                  onClick={() => navigate('/jobs', { state: { openJobId: job.id } })}
                  className="bg-slate-950/50 hover:bg-slate-800/60 border border-slate-800/60 hover:border-slate-700/80 p-3 rounded-xl flex items-center justify-between cursor-pointer transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 group-hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center shrink-0">
                      {job.vehicles?.make?.substring(0, 2).toUpperCase() || 'MZ'}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs md:text-sm font-semibold text-white group-hover:text-brand transition-colors truncate">
                        {job.vehicles?.make} {job.vehicles?.model}
                        <span className="ml-2 font-mono text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                          {job.vehicles?.license_plate}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        Completed {new Date(job.completed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        {job.description ? ` • ${job.description}` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-black font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      +{job.creditedHours} hrs
                    </span>
                    <ChevronRight size={14} className="text-slate-600 group-hover:text-slate-300 transition-colors" />
                  </div>
                </div>
              ))}
              {techData.completedJobs.length === 0 && (
                <div className="text-center py-6 text-slate-500 text-xs italic">
                  No jobs completed yet this month. When you complete an assigned job, credited hours will appear here!
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── ADMIN: TECHNICIAN PERFORMANCE & MILESTONES ── */}
      {!isTechnician && adminTechData && adminTechData.techSummaries && adminTechData.techSummaries.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Trophy size={18} className="text-amber-400" />
                <h3 className="text-base font-bold text-white">Technician Monthly Milestones ({adminTechData.monthName})</h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Monthly performance target: <strong className="text-amber-300">{adminTechData.targetHours} hours</strong> per technician. Click any technician to view full dossier.
              </p>
            </div>
            <button
              onClick={() => navigate('/performance')}
              className="text-xs font-semibold text-brand hover:underline flex items-center gap-1 self-start sm:self-auto"
            >
              <span>Open Team Performance Tab</span>
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
            {adminTechData.techSummaries.map((tech) => (
              <div 
                key={tech.staffId} 
                onClick={() => setSelectedStaff(tech)}
                className="bg-slate-950/60 hover:bg-slate-850/80 border border-slate-800/80 hover:border-slate-700 p-4 rounded-xl space-y-3 cursor-pointer transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-white text-sm group-hover:text-brand transition-colors flex items-center gap-2">
                    <span>{tech.name}</span>
                    <span className="text-[10px] text-slate-500 font-normal">({tech.completedCount} jobs)</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${tech.milestone.bgClass} ${tech.milestone.colorClass} ${tech.milestone.borderClass}`}>
                    {tech.milestone.badge}
                  </span>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono mb-1.5">
                    <span className="text-slate-400">{tech.totalHours} / {tech.targetHours} hrs</span>
                    <span className="text-brand font-bold">{tech.progressPercent}%</span>
                  </div>
                  <div className="h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        tech.isTargetMet 
                          ? 'bg-gradient-to-r from-emerald-400 to-amber-300' 
                          : 'bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(3, tech.progressPercent))}%` }}
                    />
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-900">
                  <span>Velocity: <strong className="text-emerald-400 font-mono">{tech.smartPace.currentVelocity}h/day</strong></span>
                  <span className="text-brand group-hover:underline flex items-center gap-0.5">
                    View Dossier <ChevronRight size={12} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BOTTOM SECTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Recent Activity</h3>
          {loading ? (
             <div className="space-y-4">
                 {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-800/50 rounded-xl animate-pulse"/>)}
             </div>
          ) : (
            <div className="space-y-4">
                {recentJobs.map((job: any) => (
                    <div 
                        key={job.id} 
                        onClick={() => navigate('/jobs', { state: { openJobId: job.id } })}
                        className="bg-slate-800/50 p-4 rounded-xl flex items-center justify-between cursor-pointer hover:bg-slate-700 transition-colors group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-slate-700 group-hover:bg-slate-600 transition-colors flex items-center justify-center font-bold text-slate-300">
                                {job.vehicles?.make?.substring(0,2).toUpperCase() || 'MZ'}
                            </div>
                            <div>
                                <h4 className="text-white font-medium group-hover:text-cyan-400 transition-colors">{job.vehicles?.make} {job.vehicles?.model} ({job.vehicles?.license_plate})</h4>
                                <p className="text-xs text-slate-400 line-clamp-1">{job.description}</p>
                            </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${job.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-brand-soft text-brand'}`}>
                            {job.status.replace('_', ' ')}
                        </span>
                    </div>
                ))}
                {recentJobs.length === 0 && <div className="text-slate-500 text-center py-4">No recent activity</div>}
            </div>
          )}
        </div>

        {/* Low Stock */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-6">Low Stock Alert</h3>
            {loading ? (
                 <div className="space-y-4">
                     {[1,2,3].map(i => <div key={i} className="h-12 bg-slate-800/50 rounded-lg animate-pulse"/>)}
                 </div>
            ) : (
            <div className="space-y-3">
                     {lowStock.map((part: any) => (
                       <div
                           key={part.id}
                           onClick={isTechnician ? undefined : () => navigate('/inventory')}
                           className={`flex items-center justify-between p-3 rounded-lg border border-slate-800 bg-slate-800/30 ${isTechnician ? '' : 'cursor-pointer hover:bg-slate-800'} transition-colors group`}
                       >
                          <div className="min-w-0">
                              <div className="text-sm font-medium text-slate-200 group-hover:text-cyan-400 transition-colors truncate">{part.name}</div>
                              <div className="text-xs text-slate-500">{part.part_number || 'No part #'}</div>
                          </div>
                          <div className={`text-sm font-bold flex-shrink-0 ml-2 ${part.stock_quantity === 0 ? 'text-red-400' : 'text-amber-400'}`}>
                              {part.stock_quantity === 0 ? 'Out of stock' : `${part.stock_quantity} left`}
                          </div>
                       </div>
                     ))}
                     {lowStock.length === 0 && <div className="text-slate-500 text-center py-4">Inventory looks good!</div>}
            </div>
            )}
        </div>
      </div>

      {/* Staff Performance Dossier Modal */}
      <StaffPerformanceModal
        isOpen={!!selectedStaff}
        onClose={() => setSelectedStaff(null)}
        staff={selectedStaff}
        monthName={adminTechData?.monthName || 'Current Month'}
        onSelectJob={(jobId) => navigate('/jobs', { state: { openJobId: jobId } })}
      />
    </div>
  );
};