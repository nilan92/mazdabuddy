import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

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
  paceNeeded: string;
  daysLeft: number;
  monthName: string;
  weeklyStats: { label: string; range: string; hours: number; jobs: number }[];
  completedJobs: any[];
  activeJobs: any[];
}

export interface AdminTechnicianSummary {
  staffId: string;
  name: string;
  totalHours: number;
  completedCount: number;
  targetHours: number;
  progressPercent: number;
  hoursRemaining: number;
  isTargetMet: boolean;
  completedJobs?: any[];
}

export interface AdminTechnicianStats {
  isTech: false;
  monthName: string;
  targetHours: number;
  techSummaries: AdminTechnicianSummary[];
}

export type TechProgressData = TechnicianMonthlyStats | AdminTechnicianStats;

export const TARGET_HOURS = 200; // Monthly Target for Technician Bonus

export const useTechnicianProgress = () => {
  const { profile } = useAuth();

  const query = useQuery<TechProgressData | null>({
    queryKey: ['technician_progress', profile?.id, profile?.role],
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
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const startOfMonth = new Date(currentYear, currentMonth, 1);
      const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      const currentDay = now.getDate();
      const daysLeft = Math.max(0, daysInMonth - currentDay);
      const monthName = now.toLocaleString('default', { month: 'long' });

      const getCreditedHours = (job: any) => {
        const laborSum = (job.job_labor || []).reduce((sum: number, l: any) => sum + (Number(l.hours) || 0), 0);
        const est = Number(job.estimated_hours) || 0;
        return laborSum > 0 ? laborSum : (est > 0 ? est : 0);
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
        const paceNeeded = daysLeft > 0 ? (hoursRemaining / daysLeft).toFixed(1) : '0';

        const weeklyStats = [
          { label: 'Week 1', range: 'Day 1–7', hours: 0, jobs: 0 },
          { label: 'Week 2', range: 'Day 8–14', hours: 0, jobs: 0 },
          { label: 'Week 3', range: 'Day 15–21', hours: 0, jobs: 0 },
          { label: 'Week 4', range: `Day 22–${daysInMonth}`, hours: 0, jobs: 0 },
        ];

        completedThisMonth.forEach((j: any) => {
          const day = new Date(j.completed_at).getDate();
          let idx = 3;
          if (day <= 7) idx = 0;
          else if (day <= 14) idx = 1;
          else if (day <= 21) idx = 2;
          weeklyStats[idx].hours = Number((weeklyStats[idx].hours + j.creditedHours).toFixed(1));
          weeklyStats[idx].jobs += 1;
        });

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
          paceNeeded,
          daysLeft,
          monthName,
          weeklyStats,
          completedJobs: completedThisMonth,
          activeJobs: activeAssignedJobs,
        };
      } else {
        const technicians = (staffList || []).filter(s => s.active);
        const techSummaries = technicians.map(tech => {
          const techJobsCompleted = (jobs || []).filter(j => {
            const isAssigned = j.assigned_staff_id === tech.id || (tech.profile_id && j.assigned_technician_id === tech.profile_id);
            if (!isAssigned || j.status !== 'completed' || !j.completed_at) return false;
            const d = new Date(j.completed_at);
            return d >= startOfMonth && d <= endOfMonth;
          }).map(j => ({ ...j, creditedHours: getCreditedHours(j) }))
            .sort((a: any, b: any) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());

          const totalHours = Number(techJobsCompleted.reduce((acc: number, j: any) => acc + j.creditedHours, 0).toFixed(1));
          const progress = Math.min(100, Math.round((totalHours / TARGET_HOURS) * 100));

          return {
            staffId: tech.id,
            name: tech.name,
            totalHours,
            completedCount: techJobsCompleted.length,
            targetHours: TARGET_HOURS,
            progressPercent: progress,
            hoursRemaining: Math.max(0, Number((TARGET_HOURS - totalHours).toFixed(1))),
            isTargetMet: totalHours >= TARGET_HOURS,
            completedJobs: techJobsCompleted,
          };
        }).filter(t => t.totalHours > 0 || t.completedCount > 0);

        return {
          isTech: false,
          monthName,
          targetHours: TARGET_HOURS,
          techSummaries,
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
