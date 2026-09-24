import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export type AchievementTier = 'Starter' | 'Bronze' | 'Silver' | 'Gold' | 'Champion';

export interface MilestoneTierInfo {
  tier: AchievementTier;
  label: string;
  badge: string;
  colorClass: string;
  borderClass: string;
  bgClass: string;
  nextTierName: string | null;
  hoursToNextTier: number;
  nextTierTarget: number;
}

export interface SmartPaceInfo {
  paceDisplay: string;
  paceValue: string;
  paceUnit: string;
  paceSubtext: string;
  paceStatus: 'achieved' | 'on_track' | 'overtime' | 'stretch';
  isHighStretch: boolean;
  workingDaysLeft: number;
  workingDaysPassed: number;
  totalWorkingDays: number;
  currentVelocity: number; // actual hours per working day so far
  standardShiftRemainingCapacity: number; // 8h * workdays left
}

export interface TechnicianMonthlyStats {
  isTech: true;
  targetHours: number;
  totalHoursCompleted: number;
  pipelineHours: number;
  progressPercent: number;
  hoursRemaining: number;
  completedCount: number;
  activeCount: number;
  avgHoursPerJob: string;
  daysLeft: number;
  monthName: string;
  year: number;
  milestone: MilestoneTierInfo;
  smartPace: SmartPaceInfo;
  weeklyStats: { label: string; range: string; hours: number; jobs: number }[];
  completedJobs: any[];
  activeJobs: any[];
}

export interface AdminTechnicianSummary {
  staffId: string;
  name: string;
  totalHours: number;
  completedCount: number;
  activeCount: number;
  pipelineHours: number;
  targetHours: number;
  progressPercent: number;
  hoursRemaining: number;
  isTargetMet: boolean;
  milestone: MilestoneTierInfo;
  smartPace: SmartPaceInfo;
  weeklyStats: { label: string; range: string; hours: number; jobs: number }[];
  completedJobs: any[];
  activeJobs: any[];
}

export interface AdminTechnicianStats {
  isTech: false;
  monthName: string;
  year: number;
  targetHours: number;
  techSummaries: AdminTechnicianSummary[];
  teamStats: {
    totalTeamHours: number;
    totalCompletedJobs: number;
    activeTechCount: number;
    avgHoursPerTech: number;
    teamAttainmentPercent: number;
    topPerformer: AdminTechnicianSummary | null;
  };
}

export type TechProgressData = TechnicianMonthlyStats | AdminTechnicianStats;

export const TARGET_HOURS = 200; // Monthly Target for Master Technician Tier

// Milestone thresholds
export const MILESTONES = [
  { tier: 'Starter' as AchievementTier, minHours: 0, target: 50, label: 'Starter', badge: '🌱 Starter' },
  { tier: 'Bronze' as AchievementTier, minHours: 50, target: 100, label: 'Bronze Tier', badge: '🥉 Bronze' },
  { tier: 'Silver' as AchievementTier, minHours: 100, target: 150, label: 'Silver Tier', badge: '🥈 Silver' },
  { tier: 'Gold' as AchievementTier, minHours: 150, target: 200, label: 'Gold Tier', badge: '🥇 Gold' },
  { tier: 'Champion' as AchievementTier, minHours: 200, target: 200, label: 'Champion Tier', badge: '🏆 Champion' },
];

export const getMilestoneInfo = (hours: number, target: number = TARGET_HOURS): MilestoneTierInfo => {
  if (hours >= target) {
    return {
      tier: 'Champion',
      label: 'Champion Tier',
      badge: '🏆 Champion',
      colorClass: 'text-amber-300',
      borderClass: 'border-amber-400/50',
      bgClass: 'bg-amber-400/10',
      nextTierName: null,
      hoursToNextTier: 0,
      nextTierTarget: target,
    };
  }
  if (hours >= 150) {
    return {
      tier: 'Gold',
      label: 'Gold Tier',
      badge: '🥇 Gold',
      colorClass: 'text-yellow-300',
      borderClass: 'border-yellow-400/40',
      bgClass: 'bg-yellow-400/10',
      nextTierName: 'Champion (200h)',
      hoursToNextTier: Number((target - hours).toFixed(1)),
      nextTierTarget: target,
    };
  }
  if (hours >= 100) {
    return {
      tier: 'Silver',
      label: 'Silver Tier',
      badge: '🥈 Silver',
      colorClass: 'text-slate-200',
      borderClass: 'border-slate-300/40',
      bgClass: 'bg-slate-300/10',
      nextTierName: 'Gold (150h)',
      hoursToNextTier: Number((150 - hours).toFixed(1)),
      nextTierTarget: 150,
    };
  }
  if (hours >= 50) {
    return {
      tier: 'Bronze',
      label: 'Bronze Tier',
      badge: '🥉 Bronze',
      colorClass: 'text-amber-400',
      borderClass: 'border-amber-600/40',
      bgClass: 'bg-amber-600/10',
      nextTierName: 'Silver (100h)',
      hoursToNextTier: Number((100 - hours).toFixed(1)),
      nextTierTarget: 100,
    };
  }
  return {
    tier: 'Starter',
    label: 'Starter Tier',
    badge: '🌱 Starter',
    colorClass: 'text-cyan-400',
    borderClass: 'border-cyan-500/40',
    bgClass: 'bg-cyan-500/10',
    nextTierName: 'Bronze (50h)',
    hoursToNextTier: Number((50 - hours).toFixed(1)),
    nextTierTarget: 50,
  };
};

/**
 * Calculates shop working days (Monday - Saturday, closed on Sundays)
 */
export const calculateShopWorkingDays = (currentYear: number, currentMonth: number, currentDay: number, daysInMonth: number) => {
  let totalWorkingDays = 0;
  let workingDaysPassed = 0;
  let workingDaysLeft = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(currentYear, currentMonth, d);
    const dayOfWeek = date.getDay(); // 0 = Sunday
    if (dayOfWeek !== 0) { // Workshop operates Mon - Sat
      totalWorkingDays++;
      if (d < currentDay) {
        workingDaysPassed++;
      } else {
        workingDaysLeft++;
      }
    }
  }

  return {
    totalWorkingDays,
    workingDaysPassed: Math.max(1, workingDaysPassed),
    workingDaysLeft: Math.max(0, workingDaysLeft),
  };
};

/**
 * Smarter math calculation for realistic daily pace, work capacity, and milestone focus.
 * Avoids ridiculous divisions like "30.8 hours / day".
 */
export const calculateSmartPace = (
  hoursCompleted: number,
  targetHours: number,
  pipelineHours: number,
  workingDays: { totalWorkingDays: number; workingDaysPassed: number; workingDaysLeft: number },
  monthName: string,
  milestone: MilestoneTierInfo
): SmartPaceInfo => {
  const { totalWorkingDays, workingDaysPassed, workingDaysLeft } = workingDays;
  const hoursRemaining = Math.max(0, Number((targetHours - hoursCompleted).toFixed(1)));
  const currentVelocity = Number((hoursCompleted / workingDaysPassed).toFixed(1));
  const standardShiftRemainingCapacity = workingDaysLeft * 8.0;

  // 1. Goal already reached
  if (hoursRemaining <= 0) {
    return {
      paceDisplay: 'Target Met 🏆',
      paceValue: 'Goal Met',
      paceUnit: '',
      paceSubtext: 'Monthly milestone reached! Outstanding workshop productivity.',
      paceStatus: 'achieved',
      isHighStretch: false,
      workingDaysLeft,
      workingDaysPassed,
      totalWorkingDays,
      currentVelocity,
      standardShiftRemainingCapacity,
    };
  }

  // 2. Month-end reached
  if (workingDaysLeft === 0) {
    return {
      paceDisplay: 'Month Ended',
      paceValue: `${hoursCompleted}h`,
      paceUnit: 'final',
      paceSubtext: `${hoursCompleted}h covered across ${totalWorkingDays} shop workdays.`,
      paceStatus: 'stretch',
      isHighStretch: true,
      workingDaysLeft: 0,
      workingDaysPassed,
      totalWorkingDays,
      currentVelocity,
      standardShiftRemainingCapacity: 0,
    };
  }

  const rawPace = Number((hoursRemaining / workingDaysLeft).toFixed(1));

  // 3. Realistic pace within standard workday (<= 8.0h/day)
  if (rawPace <= 8.0) {
    return {
      paceDisplay: `${rawPace}h / workday`,
      paceValue: `${rawPace}h`,
      paceUnit: 'per workday',
      paceSubtext: `Maintain ~${rawPace}h daily across ${workingDaysLeft} remaining workdays (standard 8h shift).`,
      paceStatus: 'on_track',
      isHighStretch: false,
      workingDaysLeft,
      workingDaysPassed,
      totalWorkingDays,
      currentVelocity,
      standardShiftRemainingCapacity,
    };
  }

  // 4. Overtime pace (8.1h - 10.5h/day)
  if (rawPace <= 10.5) {
    return {
      paceDisplay: `${rawPace}h / workday`,
      paceValue: `${rawPace}h`,
      paceUnit: 'per workday (OT)',
      paceSubtext: `Achievable with ~${rawPace}h daily across ${workingDaysLeft} workdays including overtime.`,
      paceStatus: 'overtime',
      isHighStretch: false,
      workingDaysLeft,
      workingDaysPassed,
      totalWorkingDays,
      currentVelocity,
      standardShiftRemainingCapacity,
    };
  }

  // 5. High stretch (> 10.5h/day, e.g. 30h/day impossible scenario)
  // Instead of an impossible pace, guide them on realistic max shift and next milestone!
  const hoursToNext = milestone.hoursToNextTier;
  const paceToNext = workingDaysLeft > 0 ? Number((hoursToNext / workingDaysLeft).toFixed(1)) : 0;
  const nextTargetGuide = milestone.nextTierName 
    ? `Reach ${milestone.nextTierName} (${hoursToNext}h away, ~${paceToNext}h/day)`
    : `Maximize active floor pipeline (${pipelineHours}h)`;

  return {
    paceDisplay: `Peak Shift (~8–10h)`,
    paceValue: `~8–10h`,
    paceUnit: 'max capacity',
    paceSubtext: `${workingDaysLeft} workdays left in ${monthName}. Focus on active floor repairs (${pipelineHours}h) & ${nextTargetGuide}.`,
    paceStatus: 'stretch',
    isHighStretch: true,
    workingDaysLeft,
    workingDaysPassed,
    totalWorkingDays,
    currentVelocity,
    standardShiftRemainingCapacity,
  };
};

export const useTechnicianProgress = (overrideMonthDate?: Date) => {
  const { profile } = useAuth();

  const query = useQuery<TechProgressData | null>({
    queryKey: ['technician_progress', profile?.id, profile?.role, overrideMonthDate?.toISOString()],
    queryFn: async () => {
      if (!profile) return null;

      // 1. Get staff list
      const { data: staffList } = await supabase
        .from('staff')
        .select('id, name, profile_id, active')
        .order('name');

      const currentStaff = staffList?.find(s => s.profile_id === profile.id);
      const isTech = profile.role === 'technician';

      // 2. Fetch jobs with vehicles & labor
      let jobQuery = supabase
        .from('job_cards')
        .select(`
          id,
          status,
          estimated_hours,
          total_labor_time,
          completed_at,
          created_at,
          description,
          assigned_staff_id,
          assigned_technician_id,
          vehicles (
            license_plate,
            make,
            model
          ),
          job_labor (
            id,
            description,
            hours
          )
        `);

      if (isTech) {
        if (currentStaff?.id) {
          jobQuery = jobQuery.or(`assigned_staff_id.eq.${currentStaff.id},assigned_technician_id.eq.${profile.id}`);
        } else {
          jobQuery = jobQuery.eq('assigned_technician_id', profile.id);
        }
      }

      const { data: jobs, error } = await jobQuery;
      if (error) {
        console.error('Error fetching technician jobs:', error);
        return null;
      }

      // Calendar Month bounds for strict monthly reset
      const targetDate = overrideMonthDate || new Date();
      const currentYear = targetDate.getFullYear();
      const currentMonth = targetDate.getMonth();
      const startOfMonth = new Date(currentYear, currentMonth, 1);
      const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      const currentDay = overrideMonthDate ? daysInMonth : new Date().getDate();
      const daysLeft = Math.max(0, daysInMonth - currentDay);
      const monthName = targetDate.toLocaleString('default', { month: 'long' });

      // Calculate realistic shop working days (Mon-Sat, skipping Sundays)
      const workingDays = calculateShopWorkingDays(currentYear, currentMonth, currentDay, daysInMonth);

      const getCreditedHours = (job: any) => {
        const laborSum = (job.job_labor || []).reduce((sum: number, l: any) => sum + (Number(l.hours) || 0), 0);
        const est = Number(job.estimated_hours) || 0;
        return laborSum > 0 ? laborSum : (est > 0 ? est : 0);
      };

      const calculateWeeklyDistribution = (completedList: any[]) => {
        const weekly = [
          { label: 'Week 1', range: 'Day 1–7', hours: 0, jobs: 0 },
          { label: 'Week 2', range: 'Day 8–14', hours: 0, jobs: 0 },
          { label: 'Week 3', range: 'Day 15–21', hours: 0, jobs: 0 },
          { label: 'Week 4', range: `Day 22–${daysInMonth}`, hours: 0, jobs: 0 },
        ];
        completedList.forEach((j: any) => {
          const day = new Date(j.completed_at).getDate();
          let idx = 3;
          if (day <= 7) idx = 0;
          else if (day <= 14) idx = 1;
          else if (day <= 21) idx = 2;
          weekly[idx].hours = Number((weekly[idx].hours + j.creditedHours).toFixed(1));
          weekly[idx].jobs += 1;
        });
        return weekly;
      };

      if (isTech) {
        const completedThisMonth = (jobs || []).filter(j => {
          if (j.status !== 'completed' || !j.completed_at) return false;
          const d = new Date(j.completed_at);
          return d >= startOfMonth && d <= endOfMonth;
        }).map(j => ({
          ...j,
          creditedHours: getCreditedHours(j)
        })).sort((a: any, b: any) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());

        const activeAssignedJobs = (jobs || []).filter(j => 
          j.status !== 'completed' && j.status !== 'cancelled'
        ).map(j => ({
          ...j,
          creditedHours: getCreditedHours(j)
        }));

        const totalHoursCompleted = Number(completedThisMonth.reduce((acc: number, j: any) => acc + j.creditedHours, 0).toFixed(1));
        const pipelineHours = Number(activeAssignedJobs.reduce((acc: number, j: any) => acc + j.creditedHours, 0).toFixed(1));
        const progressPercent = Math.min(100, Math.round((totalHoursCompleted / TARGET_HOURS) * 100));
        const hoursRemaining = Math.max(0, Number((TARGET_HOURS - totalHoursCompleted).toFixed(1)));
        const avgHoursPerJob = completedThisMonth.length > 0 ? (totalHoursCompleted / completedThisMonth.length).toFixed(1) : '0';

        const milestone = getMilestoneInfo(totalHoursCompleted, TARGET_HOURS);
        const smartPace = calculateSmartPace(totalHoursCompleted, TARGET_HOURS, pipelineHours, workingDays, monthName, milestone);
        const weeklyStats = calculateWeeklyDistribution(completedThisMonth);

        return {
          isTech: true,
          targetHours: TARGET_HOURS,
          totalHoursCompleted,
          pipelineHours,
          progressPercent,
          hoursRemaining,
          completedCount: completedThisMonth.length,
          activeCount: activeAssignedJobs.length,
          avgHoursPerJob,
          daysLeft,
          monthName,
          year: currentYear,
          milestone,
          smartPace,
          weeklyStats,
          completedJobs: completedThisMonth,
          activeJobs: activeAssignedJobs,
        };
      } else {
        // ADMIN / MANAGER: Compute full metrics for all workshop technicians
        const technicians = (staffList || []).filter(s => s.active);
        let totalTeamHours = 0;
        let totalCompletedJobs = 0;

        const techSummaries: AdminTechnicianSummary[] = technicians.map(tech => {
          const techJobsCompleted = (jobs || []).filter(j => {
            const isAssigned = j.assigned_staff_id === tech.id || (tech.profile_id && j.assigned_technician_id === tech.profile_id);
            if (!isAssigned || j.status !== 'completed' || !j.completed_at) return false;
            const d = new Date(j.completed_at);
            return d >= startOfMonth && d <= endOfMonth;
          }).map(j => ({ ...j, creditedHours: getCreditedHours(j) }))
            .sort((a: any, b: any) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());

          const techActiveJobs = (jobs || []).filter(j => {
            const isAssigned = j.assigned_staff_id === tech.id || (tech.profile_id && j.assigned_technician_id === tech.profile_id);
            return isAssigned && j.status !== 'completed' && j.status !== 'cancelled';
          }).map(j => ({ ...j, creditedHours: getCreditedHours(j) }));

          const totalHours = Number(techJobsCompleted.reduce((acc: number, j: any) => acc + j.creditedHours, 0).toFixed(1));
          const pipelineHours = Number(techActiveJobs.reduce((acc: number, j: any) => acc + j.creditedHours, 0).toFixed(1));
          const progress = Math.min(100, Math.round((totalHours / TARGET_HOURS) * 100));
          const hoursRemaining = Math.max(0, Number((TARGET_HOURS - totalHours).toFixed(1)));
          const milestone = getMilestoneInfo(totalHours, TARGET_HOURS);
          const smartPace = calculateSmartPace(totalHours, TARGET_HOURS, pipelineHours, workingDays, monthName, milestone);
          const weeklyStats = calculateWeeklyDistribution(techJobsCompleted);

          totalTeamHours += totalHours;
          totalCompletedJobs += techJobsCompleted.length;

          return {
            staffId: tech.id,
            name: tech.name,
            totalHours,
            completedCount: techJobsCompleted.length,
            activeCount: techActiveJobs.length,
            pipelineHours,
            targetHours: TARGET_HOURS,
            progressPercent: progress,
            hoursRemaining,
            isTargetMet: totalHours >= TARGET_HOURS,
            milestone,
            smartPace,
            weeklyStats,
            completedJobs: techJobsCompleted,
            activeJobs: techActiveJobs,
          };
        }).filter(t => t.totalHours > 0 || t.completedCount > 0 || t.activeCount > 0);

        totalTeamHours = Number(totalTeamHours.toFixed(1));
        const activeTechCount = techSummaries.length;
        const avgHoursPerTech = activeTechCount > 0 ? Number((totalTeamHours / activeTechCount).toFixed(1)) : 0;
        const totalTeamTarget = Math.max(1, activeTechCount * TARGET_HOURS);
        const teamAttainmentPercent = Math.min(100, Math.round((totalTeamHours / totalTeamTarget) * 100));

        // Top performer
        const sortedTechs = [...techSummaries].sort((a, b) => b.totalHours - a.totalHours);
        const topPerformer = sortedTechs.length > 0 && sortedTechs[0].totalHours > 0 ? sortedTechs[0] : null;

        return {
          isTech: false,
          monthName,
          year: currentYear,
          targetHours: TARGET_HOURS,
          techSummaries,
          teamStats: {
            totalTeamHours,
            totalCompletedJobs,
            activeTechCount,
            avgHoursPerTech,
            teamAttainmentPercent,
            topPerformer,
          },
        };
      }
    },
    enabled: !!profile,
    staleTime: 30000,
  });

  const isTechnician = profile?.role === 'technician';
  const techData: TechnicianMonthlyStats | null = (query.data && query.data.isTech) ? query.data : null;
  const adminTechData: AdminTechnicianStats | null = (query.data && !query.data.isTech) ? query.data : null;

  return {
    ...query,
    techStatsData: query.data,
    isTechnician,
    techData,
    adminTechData,
  };
};
