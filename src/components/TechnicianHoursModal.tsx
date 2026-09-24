import React, { useState } from 'react';
import { 
  Trophy, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  TrendingUp, 
  Award, 
  AlertCircle, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  Car, 
  Wrench,
  RotateCcw
} from 'lucide-react';
import { Modal } from './Modal';
import { 
  type TechnicianMonthlyStats, 
  type AdminTechnicianStats, 
  TARGET_HOURS 
} from '../hooks/useTechnicianProgress';

interface TechnicianHoursModalProps {
  isOpen: boolean;
  onClose: () => void;
  isTechnician: boolean;
  techData: TechnicianMonthlyStats | null;
  adminTechData: AdminTechnicianStats | null;
  onSelectJob?: (jobId: string) => void;
}

export const TechnicianHoursModal: React.FC<TechnicianHoursModalProps> = ({
  isOpen,
  onClose,
  isTechnician,
  techData,
  adminTechData,
  onSelectJob,
}) => {
  const [expandedTechId, setExpandedTechId] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-2">
          <div className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-400 shrink-0">
            {isTechnician ? <Clock size={20} className="sm:w-5 sm:h-5" /> : <Trophy size={20} className="sm:w-5 sm:h-5" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-sm sm:text-lg md:text-xl font-bold text-white truncate">
                {isTechnician ? 'Hours & Milestones' : 'Technician Targets'}
              </span>
              <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                {techData?.monthName || adminTechData?.monthName || 'Current Month'}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 truncate mt-0.5">
              {TARGET_HOURS}h Monthly Target • Performance Tracker
            </p>
          </div>
        </div>
      }
      maxWidth="max-w-3xl"
    >
      <div className="space-y-4 sm:space-y-6 max-h-[75vh] overflow-y-auto pr-1">
        {/* Monthly Reset Notice Callout */}
        <div className="bg-slate-900/90 border border-amber-500/20 rounded-xl p-3 sm:p-3.5 flex items-start gap-2.5 sm:gap-3 bg-gradient-to-r from-amber-950/20 via-slate-900/80 to-slate-900/80">
          <RotateCcw size={16} className="text-amber-400 flex-shrink-0 mt-0.5 sm:w-[18px] sm:h-[18px]" />
          <div className="text-[11px] sm:text-xs text-slate-300 leading-relaxed">
            <span className="font-semibold text-amber-300">Strict Monthly Reset: </span>
            Tracked strictly for {techData?.monthName || adminTechData?.monthName}. Resets to <span className="font-mono font-bold text-white">0 hrs</span> on the 1st of every month.
          </div>
        </div>

        {/* TECHNICIAN VIEW */}
        {isTechnician && techData && (
          <>
            {/* Visual Milestone Progress Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl p-3.5 sm:p-5 shadow-inner">
              <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Award size={16} className="text-brand sm:w-[18px] sm:h-[18px]" />
                  <span className="text-xs sm:text-sm font-semibold text-white">Monthly Target</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xl sm:text-2xl font-mono font-bold text-white">
                    {techData.totalHoursCompleted}
                  </span>
                  <span className="text-slate-400 text-xs sm:text-sm font-mono">/ {TARGET_HOURS}h</span>
                  <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-bold font-mono ${
                    techData.progressPercent >= 100 
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                      : 'bg-brand/20 text-brand border border-brand/30'
                  }`}>
                    {techData.progressPercent}%
                  </span>
                </div>
              </div>

              {/* Progress Track */}
              <div className="relative w-full h-3 sm:h-4 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5 mb-2">
                <div 
                  className={`h-full rounded-full transition-all duration-700 ${
                    techData.progressPercent >= 100
                      ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 shadow-[0_0_12px_rgba(52,211,153,0.5)]'
                      : 'bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(2, techData.progressPercent))}%` }}
                />
              </div>

              {/* Milestones Indicator */}
              <div className="grid grid-cols-4 text-center text-[10px] sm:text-[11px] text-slate-400 pt-1 font-mono">
                <div className={techData.totalHoursCompleted >= 50 ? 'text-cyan-400 font-semibold' : ''}>
                  <div>50h</div>
                  <div className="text-[9px] text-slate-500 truncate">🥉 Bronze</div>
                </div>
                <div className={techData.totalHoursCompleted >= 100 ? 'text-blue-400 font-semibold' : ''}>
                  <div>100h</div>
                  <div className="text-[9px] text-slate-500 truncate">🥈 Silver</div>
                </div>
                <div className={techData.totalHoursCompleted >= 150 ? 'text-indigo-400 font-semibold' : ''}>
                  <div>150h</div>
                  <div className="text-[9px] text-slate-500 truncate">🥇 Gold</div>
                </div>
                <div className={`flex flex-col items-center ${
                  techData.totalHoursCompleted >= TARGET_HOURS ? 'text-amber-300 font-bold' : 'text-slate-500'
                }`}>
                  <div className="flex items-center gap-0.5">
                    <Trophy size={10} className={techData.totalHoursCompleted >= TARGET_HOURS ? 'text-amber-400' : ''} />
                    <span>200h</span>
                  </div>
                  <div className="text-[9px] text-slate-500 truncate">🏆 Champ</div>
                </div>
              </div>

              {/* Status Message */}
              <div className="mt-3 pt-2.5 sm:mt-4 sm:pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                {techData.totalHoursCompleted >= TARGET_HOURS ? (
                  <div className="flex items-center gap-2 text-emerald-400 font-medium text-[11px] sm:text-xs">
                    <Sparkles size={14} className="shrink-0" />
                    <span>Outstanding! You achieved Champion Tier (200h) this month! 🏆</span>
                  </div>
                ) : (
                  <div className="flex items-start gap-1.5 sm:gap-2 text-slate-300 text-[11px] sm:text-xs leading-relaxed">
                    <AlertCircle size={13} className="text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-amber-300 font-mono">{techData.hoursRemaining}h to reach</strong> Champion Tier ({TARGET_HOURS}h). {techData.smartPace.paceSubtext}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <div className="bg-slate-900/80 border border-slate-800 p-2.5 sm:p-3 rounded-xl">
                <div className="text-[10px] sm:text-xs text-slate-400 mb-0.5 flex items-center gap-1.5 truncate">
                  <Clock size={12} className="text-brand shrink-0" /> Credited Hours
                </div>
                <div className="text-lg sm:text-xl font-bold font-mono text-white">
                  {techData.totalHoursCompleted}h
                </div>
                <div className="text-[9px] sm:text-[10px] text-slate-500 mt-0.5 truncate">Tier: {techData.milestone.label}</div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 p-2.5 sm:p-3 rounded-xl">
                <div className="text-[10px] sm:text-xs text-slate-400 mb-0.5 flex items-center gap-1.5 truncate">
                  <CheckCircle2 size={12} className="text-emerald-400 shrink-0" /> Completed
                </div>
                <div className="text-lg sm:text-xl font-bold font-mono text-emerald-400">
                  {techData.completedCount}
                </div>
                <div className="text-[9px] sm:text-[10px] text-slate-500 mt-0.5 truncate">Finished jobs</div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 p-2.5 sm:p-3 rounded-xl">
                <div className="text-[10px] sm:text-xs text-slate-400 mb-0.5 flex items-center gap-1.5 truncate">
                  <Wrench size={12} className="text-blue-400 shrink-0" /> Active Floor
                </div>
                <div className="text-lg sm:text-xl font-bold font-mono text-blue-400">
                  {techData.activeCount}
                </div>
                <div className="text-[9px] sm:text-[10px] text-slate-500 mt-0.5 truncate">{techData.pipelineHours}h waiting</div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 p-2.5 sm:p-3 rounded-xl">
                <div className="text-[10px] sm:text-xs text-slate-400 mb-0.5 flex items-center gap-1.5 truncate">
                  <TrendingUp size={12} className="text-amber-400 shrink-0" /> Daily Pace
                </div>
                <div className="text-sm sm:text-base md:text-lg font-bold font-mono text-amber-300 truncate">
                  {techData.smartPace.paceValue}
                </div>
                <div className="text-[9px] sm:text-[10px] text-slate-500 mt-0.5 truncate">{techData.smartPace.workingDaysLeft} workdays left</div>
              </div>
            </div>

            {/* List of Credited Completed Jobs */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Car size={16} className="text-brand" />
                  <span>Credited Jobs Completed in {techData.monthName}</span>
                </h4>
                <span className="text-xs text-slate-400">
                  {techData.completedJobs.length} {techData.completedJobs.length === 1 ? 'job' : 'jobs'}
                </span>
              </div>

              {techData.completedJobs.length === 0 ? (
                <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-8 text-center">
                  <Clock size={32} className="text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No completed jobs yet for this month.</p>
                  <p className="text-xs text-slate-500 mt-1">
                    When you complete assigned repairs, your hours are automatically credited here toward your monthly milestones!
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {techData.completedJobs.map((job: any) => (
                    <div 
                      key={job.id}
                      onClick={() => onSelectJob && onSelectJob(job.id)}
                      className={`p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-between gap-3 ${
                        onSelectJob ? 'cursor-pointer' : ''
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
                        <div className="text-[10px] sm:text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
                          <Calendar size={11} />
                          <span>
                            Completed: {job.completed_at ? new Date(job.completed_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            }) : 'N/A'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[11px] sm:text-xs font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          +{job.creditedHours}h
                        </span>
                        <div className="text-[9px] sm:text-[10px] text-slate-500 mt-0.5">Credited</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ADMIN VIEW */}
        {!isTechnician && adminTechData && (
          <div className="space-y-4">
            <p className="text-xs text-slate-400">
              Track technician progress toward their {TARGET_HOURS}h monthly milestones and peak capacity. Hours reset automatically at the end of {adminTechData.monthName}.
            </p>

            {adminTechData.techSummaries.length === 0 ? (
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center">
                <Trophy size={32} className="text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No technician activity recorded for {adminTechData.monthName} yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {adminTechData.techSummaries.map((tech) => {
                  const isExpanded = expandedTechId === tech.staffId;
                  return (
                    <div 
                      key={tech.staffId}
                      className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden transition-all"
                    >
                      <div 
                        onClick={() => setExpandedTechId(isExpanded ? null : tech.staffId)}
                        className="p-4 cursor-pointer hover:bg-slate-850 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="font-bold text-white text-base">{tech.name}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                              {tech.milestone.badge} {tech.milestone.tier}
                            </span>
                            {tech.isTargetMet ? (
                              <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                <Trophy size={11} /> Champion Met 🏆
                              </span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-800 text-slate-400">
                                {tech.smartPace.paceDisplay} • {tech.hoursRemaining}h to 200h
                              </span>
                            )}
                          </div>

                          {/* Progress bar */}
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                              <div 
                                className={`h-full rounded-full ${
                                  tech.isTargetMet 
                                    ? 'bg-gradient-to-r from-emerald-500 to-amber-400' 
                                    : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(3, tech.progressPercent))}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono font-bold text-white">
                              {tech.progressPercent}%
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                          <div className="text-left sm:text-right">
                            <div className="text-base font-mono font-bold text-white">
                              {tech.totalHours} <span className="text-xs text-slate-400 font-normal">/ {TARGET_HOURS}h</span>
                            </div>
                            <div className="text-xs text-slate-400">
                              {tech.completedCount} completed jobs
                            </div>
                          </div>
                          <div className="text-slate-400 hover:text-white">
                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Job List for this Technician */}
                      {isExpanded && tech.completedJobs && tech.completedJobs.length > 0 && (
                        <div className="bg-slate-950/60 p-4 border-t border-slate-800/80 space-y-2">
                          <div className="text-xs font-semibold text-slate-300 mb-2">
                            Jobs Completed by {tech.name} this month:
                          </div>
                          {tech.completedJobs.map((job: any) => (
                            <div 
                              key={job.id}
                              onClick={() => onSelectJob && onSelectJob(job.id)}
                              className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/60 flex items-center justify-between text-xs hover:border-slate-700 cursor-pointer"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className="font-mono text-[11px] font-semibold text-brand">
                                  {job.vehicles?.license_plate || 'No Plate'}
                                </span>
                                <span className="text-slate-300 truncate">
                                  {job.vehicles?.make} {job.vehicles?.model}
                                </span>
                              </div>
                              <span className="font-mono font-bold text-emerald-400 flex-shrink-0">
                                +{job.creditedHours}h
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
