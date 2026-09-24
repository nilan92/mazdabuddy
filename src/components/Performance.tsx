import { useState } from 'react';
import { 
  Trophy, 
  Clock, 
  Users, 
  TrendingUp, 
  Award, 
  Search, 
  RefreshCcw, 
  Wrench, 
  CheckCircle2, 
  ChevronRight
} from 'lucide-react';
import { 
  useTechnicianProgress, 
  type AdminTechnicianSummary, 
  TARGET_HOURS 
} from '../hooks/useTechnicianProgress';
import { StaffPerformanceModal } from './StaffPerformanceModal';
import { JobDetails } from './JobDetails';

export const Performance = () => {
  const { adminTechData, isLoading, refetch } = useTechnicianProgress();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTier, setSelectedTier] = useState<string>('all');
  const [selectedStaff, setSelectedStaff] = useState<AdminTechnicianSummary | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const teamStats = adminTechData?.teamStats || {
    totalTeamHours: 0,
    totalCompletedJobs: 0,
    activeTechCount: 0,
    avgHoursPerTech: 0,
    teamAttainmentPercent: 0,
    topPerformer: null,
  };

  const summaries = adminTechData?.techSummaries || [];

  const filteredSummaries = summaries.filter(tech => {
    const matchesSearch = tech.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTier = selectedTier === 'all' || tech.milestone.tier.toLowerCase() === selectedTier.toLowerCase();
    return matchesSearch && matchesTier;
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-400 shrink-0">
            <Award size={22} className="sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight truncate">
              Team Performance
            </h1>
            <p className="text-[11px] sm:text-xs md:text-sm text-slate-400 truncate">
              Monthly milestones & throughput for {adminTechData?.monthName || 'this month'}
            </p>
          </div>
        </div>

        <button 
          onClick={() => refetch()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all text-xs font-semibold shrink-0 active:scale-95"
          title="Refresh Performance Metrics"
        >
          <RefreshCcw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span className="hidden xs:inline">Refresh</span>
        </button>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-slate-900/60 border border-slate-800/80 p-3 sm:p-4 rounded-xl sm:rounded-2xl relative overflow-hidden group shadow-sm">
          <div className="absolute top-0 right-0 p-2 sm:p-3 opacity-10 group-hover:opacity-20 transition-opacity text-brand pointer-events-none">
            <Clock size={36} className="sm:w-12 sm:h-12" />
          </div>
          <div className="text-[11px] sm:text-xs text-slate-400 font-medium mb-0.5 sm:mb-1 flex items-center gap-1.5 truncate">
            <Clock size={12} className="text-brand shrink-0" /> Total Hours
          </div>
          <div className="text-lg sm:text-2xl font-bold font-mono text-white mb-0.5">
            {teamStats.totalTeamHours}h
          </div>
          <div className="text-[10px] sm:text-xs text-slate-500 truncate">
            {teamStats.totalCompletedJobs} jobs finished
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 p-3 sm:p-4 rounded-xl sm:rounded-2xl relative overflow-hidden group shadow-sm">
          <div className="absolute top-0 right-0 p-2 sm:p-3 opacity-10 group-hover:opacity-20 transition-opacity text-blue-400 pointer-events-none">
            <Users size={36} className="sm:w-12 sm:h-12" />
          </div>
          <div className="text-[11px] sm:text-xs text-slate-400 font-medium mb-0.5 sm:mb-1 flex items-center gap-1.5 truncate">
            <Users size={12} className="text-blue-400 shrink-0" /> Floor Staff
          </div>
          <div className="text-lg sm:text-2xl font-bold font-mono text-white mb-0.5">
            {teamStats.activeTechCount}
          </div>
          <div className="text-[10px] sm:text-xs text-slate-500 truncate">
            Active technicians
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 p-3 sm:p-4 rounded-xl sm:rounded-2xl relative overflow-hidden group shadow-sm">
          <div className="absolute top-0 right-0 p-2 sm:p-3 opacity-10 group-hover:opacity-20 transition-opacity text-emerald-400 pointer-events-none">
            <TrendingUp size={36} className="sm:w-12 sm:h-12" />
          </div>
          <div className="text-[11px] sm:text-xs text-slate-400 font-medium mb-0.5 sm:mb-1 flex items-center gap-1.5 truncate">
            <TrendingUp size={12} className="text-emerald-400 shrink-0" /> Avg per Tech
          </div>
          <div className="text-lg sm:text-2xl font-bold font-mono text-emerald-400 mb-0.5">
            {teamStats.avgHoursPerTech}h
          </div>
          <div className="text-[10px] sm:text-xs text-slate-500 truncate">
            {teamStats.teamAttainmentPercent}% of {TARGET_HOURS}h pace
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 p-3 sm:p-4 rounded-xl sm:rounded-2xl relative overflow-hidden group shadow-sm">
          <div className="absolute top-0 right-0 p-2 sm:p-3 opacity-10 group-hover:opacity-20 transition-opacity text-amber-400 pointer-events-none">
            <Trophy size={36} className="sm:w-12 sm:h-12" />
          </div>
          <div className="text-[11px] sm:text-xs text-slate-400 font-medium mb-0.5 sm:mb-1 flex items-center gap-1.5 truncate">
            <Trophy size={12} className="text-amber-400 shrink-0" /> Top Performer
          </div>
          <div className="text-sm sm:text-lg font-bold text-white mb-0.5 truncate">
            {teamStats.topPerformer?.name || 'In Progress'}
          </div>
          <div className="text-[10px] sm:text-xs text-amber-300 font-mono truncate">
            {teamStats.topPerformer ? `${teamStats.topPerformer.totalHours}h credited` : 'No data yet'}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-slate-900/40 p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-800">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search staff or technician..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-1.5 pl-8 pr-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand"
          />
        </div>

        {/* Tier filter pill buttons */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none -mx-1 px-1">
          {[
            { id: 'all', label: 'All' },
            { id: 'starter', label: 'Starter' },
            { id: 'bronze', label: '🥉 Bronze' },
            { id: 'silver', label: '🥈 Silver' },
            { id: 'gold', label: '🥇 Gold' },
            { id: 'champion', label: '🏆 Champion' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTier(tab.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                selectedTier === tab.id
                  ? 'bg-brand text-slate-950 shadow-md font-bold'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Staff Performance Cards Grid */}
      {filteredSummaries.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center">
          <Users size={36} className="text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white mb-1">No Staff Found</h3>
          <p className="text-xs text-slate-400">
            No technicians match your search or filter for {adminTechData?.monthName || 'this month'}.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSummaries.map((tech) => {
            const milestone = tech.milestone;
            const smartPace = tech.smartPace;

            return (
              <div
                key={tech.staffId}
                onClick={() => setSelectedStaff(tech)}
                className="bg-slate-900/70 hover:bg-slate-850 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 cursor-pointer transition-all duration-200 group flex flex-col justify-between shadow-lg relative overflow-hidden"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 flex items-center justify-center font-bold text-white text-base group-hover:border-brand/40 transition-colors">
                        {tech.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-base group-hover:text-brand transition-colors">
                          {tech.name}
                        </h3>
                        <span className="text-xs text-slate-400 font-medium">Technician</span>
                      </div>
                    </div>

                    <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold border ${milestone.bgClass} ${milestone.colorClass} ${milestone.borderClass}`}>
                      {milestone.badge}
                    </span>
                  </div>

                  {/* Progress Bar & Hours */}
                  <div className="space-y-1.5 mb-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Monthly Progress</span>
                      <div className="flex items-center gap-1 font-mono">
                        <span className="font-bold text-white text-sm">{tech.totalHours}</span>
                        <span className="text-slate-500">/ {TARGET_HOURS}h</span>
                        <span className="text-brand font-bold ml-1">({tech.progressPercent}%)</span>
                      </div>
                    </div>

                    <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
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

                  {/* Operational Stats Grid */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="bg-slate-950/60 border border-slate-800/60 p-2.5 rounded-xl">
                      <div className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1">
                        <CheckCircle2 size={11} className="text-emerald-400" /> Completed
                      </div>
                      <div className="text-base font-bold font-mono text-white mt-0.5">
                        {tech.completedCount} jobs
                      </div>
                    </div>

                    <div className="bg-slate-950/60 border border-slate-800/60 p-2.5 rounded-xl">
                      <div className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1">
                        <Wrench size={11} className="text-blue-400" /> Active Floor
                      </div>
                      <div className="text-base font-bold font-mono text-blue-300 mt-0.5">
                        {tech.activeCount} jobs ({tech.pipelineHours}h)
                      </div>
                    </div>
                  </div>

                  {/* Smart Daily Velocity & Guidance */}
                  <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2.5 mb-3 text-xs">
                    <div className="flex items-center justify-between text-slate-400 mb-0.5">
                      <span className="text-[11px]">Daily Velocity:</span>
                      <span className="font-mono font-bold text-emerald-400">{smartPace.currentVelocity}h / workday</span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {smartPace.paceDisplay} • {smartPace.workingDaysLeft} workdays left
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-brand font-semibold group-hover:translate-x-0.5 transition-transform">
                  <span>View Full Performance Dossier</span>
                  <ChevronRight size={16} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Staff Detail Dossier Modal */}
      <StaffPerformanceModal
        isOpen={!!selectedStaff}
        onClose={() => setSelectedStaff(null)}
        staff={selectedStaff}
        monthName={adminTechData?.monthName || 'Current Month'}
        onSelectJob={(jobId) => {
          setSelectedStaff(null);
          setSelectedJobId(jobId);
        }}
      />

      {/* Slide-over Job Details if clicked */}
      {selectedJobId && (
        <JobDetails
          jobId={selectedJobId}
          onClose={() => setSelectedJobId(null)}
          onUpdate={() => refetch()}
        />
      )}
    </div>
  );
};
