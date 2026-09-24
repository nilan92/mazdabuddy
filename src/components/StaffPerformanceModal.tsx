import React, { useState } from 'react';
import { 
  Trophy, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  TrendingUp, 
  Award, 
  Sparkles, 
  Wrench, 
  RotateCcw,
  Zap,
  ArrowUpRight
} from 'lucide-react';
import { Modal } from './Modal';
import { 
  type AdminTechnicianSummary, 
  TARGET_HOURS 
} from '../hooks/useTechnicianProgress';

interface StaffPerformanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: AdminTechnicianSummary | null;
  monthName: string;
  onSelectJob?: (jobId: string) => void;
}

export const StaffPerformanceModal: React.FC<StaffPerformanceModalProps> = ({
  isOpen,
  onClose,
  staff,
  monthName,
  onSelectJob,
}) => {
  const [activeTab, setActiveTab] = useState<'completed' | 'active' | 'momentum'>('completed');

  if (!isOpen || !staff) return null;

  const milestone = staff.milestone;
  const smartPace = staff.smartPace;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-2">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center font-bold text-cyan-300 text-base sm:text-lg shrink-0">
            {staff.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="text-base sm:text-lg md:text-xl font-bold text-white truncate">{staff.name}</span>
              <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-semibold border ${milestone.bgClass} ${milestone.colorClass} ${milestone.borderClass} shrink-0`}>
                {milestone.badge}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 truncate mt-0.5">
              Technician Dossier • {monthName}
            </p>
          </div>
        </div>
      }
      maxWidth="max-w-3xl"
    >
      <div className="space-y-4 sm:space-y-6 max-h-[75vh] overflow-y-auto pr-1">
        {/* Reset Notice Banner */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 sm:p-3 flex items-start gap-2.5 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-850">
          <RotateCcw size={15} className="text-cyan-400 flex-shrink-0 mt-0.5" />
          <div className="text-[11px] sm:text-xs text-slate-300 leading-relaxed">
            <span className="font-semibold text-cyan-300">Monthly Scope: </span>
            Tracked strictly for {monthName}. Resets to <span className="font-mono font-bold text-white">0 hrs</span> on the 1st of every month.
          </div>
        </div>

        {/* Milestone Progress Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl p-3.5 sm:p-5 shadow-inner">
          <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Award size={16} className="text-brand sm:w-[18px] sm:h-[18px]" />
              <span className="text-xs sm:text-sm font-semibold text-white">Target Progress</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-xl sm:text-2xl font-bold text-white">
                {staff.totalHours}
              </span>
              <span className="text-slate-400 text-xs sm:text-sm">/ {TARGET_HOURS}h</span>
              <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-bold ${
                staff.progressPercent >= 100
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-brand/20 text-brand border border-brand/30'
              }`}>
                {staff.progressPercent}%
              </span>
            </div>
          </div>

          {/* Progress Track */}
          <div className="relative w-full h-3 sm:h-4 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5 mb-2">
            <div 
              className={`h-full rounded-full transition-all duration-700 ${
                staff.progressPercent >= 100
                  ? 'bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.5)]'
                  : 'bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(3, staff.progressPercent))}%` }}
            />
          </div>

          {/* Milestone Tiers */}
          <div className="grid grid-cols-4 text-center text-[10px] sm:text-[11px] text-slate-400 pt-1 font-mono">
            <div className={staff.totalHours >= 50 ? 'text-amber-400 font-semibold' : ''}>
              <div>50h</div>
              <div className="text-[9px] text-slate-500 truncate">🥉 Bronze</div>
            </div>
            <div className={staff.totalHours >= 100 ? 'text-slate-200 font-semibold' : ''}>
              <div>100h</div>
              <div className="text-[9px] text-slate-500 truncate">🥈 Silver</div>
            </div>
            <div className={staff.totalHours >= 150 ? 'text-yellow-300 font-semibold' : ''}>
              <div>150h</div>
              <div className="text-[9px] text-slate-500 truncate">🥇 Gold</div>
            </div>
            <div className={`flex flex-col items-center ${
              staff.totalHours >= TARGET_HOURS ? 'text-amber-300 font-bold' : 'text-slate-500'
            }`}>
              <div className="flex items-center gap-0.5">
                <Trophy size={10} className={staff.totalHours >= TARGET_HOURS ? 'text-amber-400' : ''} />
                <span>200h</span>
              </div>
              <div className="text-[9px] text-slate-500 truncate">🏆 Champ</div>
            </div>
          </div>

          {/* Dynamic Achievement Guidance */}
          <div className="mt-3 pt-2.5 sm:mt-4 sm:pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            {staff.totalHours >= TARGET_HOURS ? (
              <div className="flex items-center gap-2 text-emerald-400 font-medium text-[11px] sm:text-xs">
                <Sparkles size={14} className="shrink-0" />
                <span>Top tier achieved! Master Technician / Champion for {monthName}!</span>
              </div>
            ) : (
              <div className="flex items-start gap-1.5 sm:gap-2 text-slate-300 text-[11px] sm:text-xs leading-relaxed">
                <Zap size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <span>
                  {milestone.nextTierName ? (
                    <>Only <strong className="text-amber-300 font-mono">{milestone.hoursToNextTier} hrs</strong> to unlock <strong>{milestone.nextTierName}</strong> tier.</>
                  ) : (
                    <><strong className="text-amber-300 font-mono">{staff.hoursRemaining} hrs</strong> remaining to reach 200h Champion level.</>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Smarter Math Capacity & Velocity Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <div className="bg-slate-900/80 border border-slate-800 p-2.5 sm:p-3 rounded-xl">
            <div className="text-[10px] sm:text-xs text-slate-400 mb-0.5 flex items-center gap-1.5 truncate">
              <Clock size={12} className="text-brand shrink-0" /> Credited Hours
            </div>
            <div className="text-lg sm:text-xl font-bold font-mono text-white">
              {staff.totalHours}h
            </div>
            <div className="text-[9px] sm:text-[10px] text-slate-500 mt-0.5 truncate">{staff.completedCount} finished jobs</div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-2.5 sm:p-3 rounded-xl">
            <div className="text-[10px] sm:text-xs text-slate-400 mb-0.5 flex items-center gap-1.5 truncate">
              <Wrench size={12} className="text-blue-400 shrink-0" /> Active Floor
            </div>
            <div className="text-lg sm:text-xl font-bold font-mono text-blue-400">
              {staff.activeCount} jobs
            </div>
            <div className="text-[9px] sm:text-[10px] text-slate-500 mt-0.5 truncate">{staff.pipelineHours}h waiting</div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-2.5 sm:p-3 rounded-xl">
            <div className="text-[10px] sm:text-xs text-slate-400 mb-0.5 flex items-center gap-1.5 truncate">
              <TrendingUp size={12} className="text-emerald-400 shrink-0" /> Velocity
            </div>
            <div className="text-lg sm:text-xl font-bold font-mono text-emerald-300">
              {smartPace.currentVelocity}h
            </div>
            <div className="text-[9px] sm:text-[10px] text-slate-500 mt-0.5 truncate">Per workday passed</div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-2.5 sm:p-3 rounded-xl">
            <div className="text-[10px] sm:text-xs text-slate-400 mb-0.5 flex items-center gap-1.5 truncate">
              <Calendar size={12} className="text-amber-400 shrink-0" /> Work Capacity
            </div>
            <div className="text-sm sm:text-base md:text-lg font-bold font-mono text-amber-300 truncate">
              {smartPace.paceValue}
            </div>
            <div className="text-[9px] sm:text-[10px] text-slate-500 mt-0.5 truncate">{smartPace.workingDaysLeft} workdays left</div>
          </div>
        </div>

        {/* Smart Pace Context Card */}
        <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 flex items-start gap-2.5">
          <div className="p-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 flex-shrink-0 mt-0.5">
            <TrendingUp size={14} />
          </div>
          <div className="text-[11px] sm:text-xs text-slate-300 leading-relaxed">
            <span className="font-semibold text-white">Daily Pace Insight: </span>
            {smartPace.paceSubtext}
          </div>
        </div>

        {/* Navigation Tabs - Horizontally scrollable on mobile */}
        <div className="flex border-b border-slate-800 overflow-x-auto scrollbar-none -mx-1 px-1">
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-3 sm:px-4 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'completed'
                ? 'border-brand text-brand'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <CheckCircle2 size={13} />
            Completed ({staff.completedJobs?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`px-3 sm:px-4 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'active'
                ? 'border-blue-400 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Wrench size={13} />
            Active Floor ({staff.activeJobs?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('momentum')}
            className={`px-3 sm:px-4 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'momentum'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Calendar size={13} />
            Momentum
          </button>
        </div>

        {/* Tab 1: Completed Jobs */}
        {activeTab === 'completed' && (
          <div className="space-y-2">
            {!staff.completedJobs || staff.completedJobs.length === 0 ? (
              <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-8 text-center text-slate-400 text-sm">
                No repairs completed in {monthName} yet.
              </div>
            ) : (
              staff.completedJobs.map((job: any) => (
                <div
                  key={job.id}
                  onClick={() => onSelectJob && onSelectJob(job.id)}
                  className={`p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-between gap-3 ${
                    onSelectJob ? 'cursor-pointer group' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-[11px] sm:text-xs font-semibold px-2 py-0.5 rounded bg-brand/10 text-brand border border-brand/20 shrink-0">
                        {job.vehicles?.license_plate || 'No Plate'}
                      </span>
                      <span className="text-xs sm:text-sm font-medium text-white truncate">
                        {job.vehicles?.make} {job.vehicles?.model}
                      </span>
                    </div>
                    <div className="text-[11px] sm:text-xs text-slate-400 truncate">
                      {job.description || 'General Service / Repair'}
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-slate-500 mt-1">
                      Completed: {job.completed_at ? new Date(job.completed_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      }) : 'N/A'}
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex items-center gap-2 sm:gap-3">
                    <div>
                      <span className="inline-flex items-center px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[11px] sm:text-xs font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        +{job.creditedHours}h
                      </span>
                      <div className="text-[9px] sm:text-[10px] text-slate-500 mt-0.5">Credited</div>
                    </div>
                    {onSelectJob && (
                      <ArrowUpRight size={15} className="text-slate-500 group-hover:text-white transition-colors shrink-0" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 2: Active Floor Jobs */}
        {activeTab === 'active' && (
          <div className="space-y-2">
            {!staff.activeJobs || staff.activeJobs.length === 0 ? (
              <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-8 text-center text-slate-400 text-sm">
                No active repairs currently assigned on the shop floor.
              </div>
            ) : (
              staff.activeJobs.map((job: any) => (
                <div
                  key={job.id}
                  onClick={() => onSelectJob && onSelectJob(job.id)}
                  className={`p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-between gap-3 ${
                    onSelectJob ? 'cursor-pointer group' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {job.vehicles?.license_plate || 'No Plate'}
                      </span>
                      <span className="text-sm font-medium text-white truncate">
                        {job.vehicles?.make} {job.vehicles?.model}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 uppercase font-mono">
                        {job.status?.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 truncate">
                      {job.description || 'Diagnosis & Repair in Progress'}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0 flex items-center gap-3">
                    <div>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                        ~{job.creditedHours} hrs
                      </span>
                      <div className="text-[10px] text-slate-500 mt-0.5">Est. Pipeline</div>
                    </div>
                    {onSelectJob && (
                      <ArrowUpRight size={16} className="text-slate-500 group-hover:text-white transition-colors" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 3: Weekly Momentum */}
        {activeTab === 'momentum' && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              4-Week Output Momentum ({monthName})
            </h4>
            <div className="grid grid-cols-4 gap-3 items-end h-40 pt-6">
              {staff.weeklyStats.map((week, idx) => {
                const maxWeek = Math.max(1, ...staff.weeklyStats.map(w => w.hours));
                const heightPct = Math.min(100, Math.max(8, Math.round((week.hours / maxWeek) * 100)));
                return (
                  <div key={idx} className="flex flex-col items-center h-full justify-end group">
                    <div className="text-xs font-mono font-bold text-white mb-1.5 opacity-90 group-hover:text-brand transition-colors">
                      {week.hours}h
                    </div>
                    <div className="w-full bg-slate-950 rounded-xl p-1 h-28 flex items-end border border-slate-800">
                      <div 
                        className="w-full bg-gradient-to-t from-cyan-600 to-blue-400 rounded-lg transition-all duration-500 group-hover:brightness-125"
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <div className="text-xs font-semibold text-slate-300 mt-2">{week.label}</div>
                    <div className="text-[10px] text-slate-500">{week.jobs} {week.jobs === 1 ? 'job' : 'jobs'}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
