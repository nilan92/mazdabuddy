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
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-400">
            {isTechnician ? <Clock size={22} /> : <Trophy size={22} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-white">
                {isTechnician ? 'My Monthly Hours & Bonus' : 'Technician Bonus Targets'}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {techData?.monthName || adminTechData?.monthName || 'Current Month'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {TARGET_HOURS}h Monthly Target • Performance & Salary Bonus Tracker
            </p>
          </div>
        </div>
      }
      maxWidth="max-w-3xl"
    >
      <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
        {/* Monthly Reset Notice Callout */}
        <div className="bg-slate-900/90 border border-amber-500/20 rounded-xl p-3.5 flex items-start gap-3 bg-gradient-to-r from-amber-950/20 via-slate-900/80 to-slate-900/80">
          <RotateCcw size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300 leading-relaxed">
            <span className="font-semibold text-amber-300">Strict Monthly Reset: </span>
            Target hours are tracked strictly within the current calendar month ({techData?.monthName || adminTechData?.monthName}). 
            Hours reset automatically to <span className="font-mono font-bold text-white">0 hrs</span> on the 1st of every month at midnight.
          </div>
        </div>

        {/* TECHNICIAN VIEW */}
        {isTechnician && techData && (
          <>
            {/* Visual Milestone Progress Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-inner">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <Award size={18} className="text-brand" />
                  <span className="text-sm font-semibold text-white">Monthly Target Progress</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-mono font-bold text-white">
                    {techData.totalHoursCompleted}
                  </span>
                  <span className="text-slate-400 text-sm">/ {TARGET_HOURS} hrs</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold font-mono ${
                    techData.progressPercent >= 100 
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                      : 'bg-brand/20 text-brand border border-brand/30'
                  }`}>
                    {techData.progressPercent}%
                  </span>
                </div>
              </div>

              {/* Progress Track */}
              <div className="relative w-full h-4 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5 mb-2">
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
              <div className="grid grid-cols-4 text-center text-[11px] text-slate-400 pt-1 font-mono">
                <div className={techData.totalHoursCompleted >= 50 ? 'text-cyan-400 font-semibold' : ''}>
                  50h (25%)
                </div>
                <div className={techData.totalHoursCompleted >= 100 ? 'text-blue-400 font-semibold' : ''}>
                  100h (50%)
                </div>
                <div className={techData.totalHoursCompleted >= 150 ? 'text-indigo-400 font-semibold' : ''}>
                  150h (75%)
                </div>
                <div className={`flex items-center justify-end gap-1 ${
                  techData.totalHoursCompleted >= TARGET_HOURS ? 'text-amber-300 font-bold' : 'text-slate-500'
                }`}>
                  <Trophy size={12} className={techData.totalHoursCompleted >= TARGET_HOURS ? 'text-amber-400' : ''} />
                  <span>200h (Bonus)</span>
                </div>
              </div>

              {/* Status Message */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                {techData.totalHoursCompleted >= TARGET_HOURS ? (
                  <div className="flex items-center gap-2 text-emerald-400 font-medium">
                    <Sparkles size={15} />
                    <span>Congratulations! You reached the 200h monthly target and qualified for the bonus!</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-slate-300">
                    <AlertCircle size={14} className="text-amber-400 flex-shrink-0" />
                    <span>
                      <strong className="text-amber-300 font-mono">{techData.hoursRemaining} hrs</strong> needed in next {techData.daysLeft} days to qualify for the salary bonus.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl">
                <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
                  <Clock size={13} className="text-brand" /> Credited Hours
                </div>
                <div className="text-xl font-bold font-mono text-white">
                  {techData.totalHoursCompleted}h
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Covered this month</div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl">
                <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-400" /> Completed
                </div>
                <div className="text-xl font-bold font-mono text-emerald-400">
                  {techData.completedCount}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Finished jobs</div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl">
                <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
                  <Wrench size={13} className="text-blue-400" /> Active Floor
                </div>
                <div className="text-xl font-bold font-mono text-blue-400">
                  {techData.activeCount}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">{techData.pipelineHours}h in pipeline</div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl">
                <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
                  <TrendingUp size={13} className="text-amber-400" /> Daily Pace
                </div>
                <div className="text-xl font-bold font-mono text-amber-300">
                  {techData.paceNeeded}h
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Per remaining day</div>
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
                    When you complete assigned repairs, your hours are automatically credited here toward your 200h bonus!
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
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-brand/10 text-brand border border-brand/20">
                            {job.vehicles?.license_plate || 'No Plate'}
                          </span>
                          <span className="text-sm font-medium text-white truncate">
                            {job.vehicles?.make} {job.vehicles?.model}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          {job.description || 'General Service / Repair'}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
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

                      <div className="text-right flex-shrink-0">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          +{job.creditedHours} hrs
                        </span>
                        <div className="text-[10px] text-slate-500 mt-1">Credited</div>
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
              Track technician progress toward their {TARGET_HOURS}h monthly bonus target. Hours reset automatically at the end of {adminTechData.monthName}.
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
                            {tech.isTargetMet ? (
                              <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                <Trophy size={11} /> 200h Bonus Met
                              </span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-800 text-slate-400">
                                {tech.hoursRemaining}h remaining
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
