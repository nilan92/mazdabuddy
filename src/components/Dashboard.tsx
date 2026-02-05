import { useNavigate } from 'react-router-dom';
import { Briefcase, DollarSign, Users, Activity, RefreshCcw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';

// --- UI Components ---
const StatCard = ({ title, value, subtext, icon: Icon, color }: any) => (
  <div className="bg-slate-900/50 backdrop-blur border border-slate-800 p-4 rounded-2xl relative overflow-hidden group">
    <div className={`absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity ${color}`}>
      <Icon size={48} />
    </div>
    <div className="flex items-center gap-3 mb-2">
      <div className={`p-2 rounded-xl ${color} bg-opacity-10 text-white`}>
        <Icon size={20} className={color.replace('bg-', 'text-')} />
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

// --- Main Component ---
export const Dashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();

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

      return {
          stats: {
            revenue: stats.monthly_revenue || 0,
            activeJobs: stats.active_jobs || 0,
            totalCustomers: stats.total_customers || 0, // <--- Correctly mapped
            completedMonth: stats.completed_jobs_month || 0,
            efficiency: '98%' 
          },
          recentJobs: recent || [],
          lowStock: lowStock || []
      };
    }
  });

  const refreshDashboard = () => queryClient.invalidateQueries({ queryKey: ['dashboard'] });

  const stats = dashboardData?.stats || { revenue: 0, activeJobs: 0, totalCustomers: 0, efficiency: '0%' };
  const recentJobs = dashboardData?.recentJobs || [];
  const lowStock = dashboardData?.lowStock || [];

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
                <StatCard 
                  title="Monthly Revenue" 
                  value={`LKR ${(stats.revenue).toLocaleString()}`} 
                  subtext="Invoices this month" 
                  icon={DollarSign} 
                  color="text-emerald-400"
                />
                <StatCard 
                  title="Active Jobs" 
                  value={stats.activeJobs} 
                  subtext="Currently on floor" 
                  icon={Briefcase} 
                  color="text-brand bg-brand-soft"
                />
                <StatCard 
                  title="Total Customers" 
                  value={stats.totalCustomers} 
                  subtext="Registered clients" 
                  icon={Users} 
                  color="text-violet-400"
                />
                <StatCard 
                  title="Efficiency" 
                  value={stats.efficiency} 
                  subtext="Shop performance" 
                  icon={Activity} 
                  color="text-amber-400"
                />
            </>
        )}
      </div>

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
                    <div key={job.id} className="bg-slate-800/50 p-4 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold text-slate-300">
                                {job.vehicles?.make?.substring(0,2).toUpperCase() || 'MZ'}
                            </div>
                            <div>
                                <h4 className="text-white font-medium">{job.vehicles?.make} {job.vehicles?.model} ({job.vehicles?.license_plate})</h4>
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
                       <div key={part.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-800 bg-slate-800/30">
                          <div>
                              <div className="text-sm font-medium text-slate-200">{part.name}</div>
                              <div className="text-xs text-slate-500">Part #: {part.part_number}</div>
                          </div>
                          <div className="text-red-400 text-sm font-bold">{part.stock_quantity} Left</div>
                       </div>
                     ))}
                     {lowStock.length === 0 && <div className="text-slate-500 text-center py-4">Inventory looks good!</div>}
            </div>
            )}
        </div>
      </div>
    </div>
  );
};