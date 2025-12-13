import { useState, useEffect } from 'react';
import { Briefcase, DollarSign, Users, Activity } from 'lucide-react';
import { supabase } from '../lib/supabase';

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

import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Dashboard = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    revenue: 0,
    activeJobs: 0,
    customers: 0,
    efficiency: '94%' // Mocked for now
  });
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
          // 1. Fetch Stats & Efficiency
          const { data: jobs } = await supabase.from('job_cards').select('id, estimated_hours, status, estimated_cost_lkr').abortSignal(controller.signal);
          if (controller.signal.aborted) return;
          
          const { count: customerCount } = await supabase.from('customers').select('*', { count: 'exact', head: true }).abortSignal(controller.signal);
          if (controller.signal.aborted) return;
      
      // Calculate Revenue & Active
      const totalRevenue = jobs?.filter(j => j.status === 'completed').reduce((acc, curr) => acc + (curr.estimated_cost_lkr || 0), 0) || 0;
      const activeJobCount = jobs?.filter(j => j.status !== 'completed').length || 0;

      // Calculate Efficiency (Global)
      // Note: In real app, might want to limit to last 30 days
      const { data: allLabor } = await supabase.from('job_labor').select('hours').abortSignal(controller.signal);
      const totalActualHours = allLabor?.reduce((sum, l) => sum + l.hours, 0) || 0;
      
      // Approximate Total Estimated (simplistic: sum of ALL jobs est hours)
      // Ideally we only compare closed jobs or sum labour purely for jobs that have labor
      // For now, let's take sum of estimates for jobs that have started
      const totalEstHours = jobs?.reduce((sum, j) => sum + (j.estimated_hours || 0), 0) || 0;

      let efficiencyPct = 100;
      if (totalEstHours > 0 && totalActualHours > 0) {
          efficiencyPct = Math.round((totalEstHours / totalActualHours) * 100);
      } else if (totalEstHours === 0 && totalActualHours > 0) {
          efficiencyPct = 0; // Worked but no estimate?
      }

      setStats(prev => ({ 
          ...prev, 
          revenue: totalRevenue, 
          activeJobs: activeJobCount, 
          customers: customerCount || 0,
          efficiency: `${efficiencyPct}%` 
      }));

      // 2. Fetch Recent Jobs
      const { data: recent } = await supabase
        .from('job_cards')
        // @ts-ignore
        .select('*, vehicles(license_plate, make, model)')
        .order('created_at', { ascending: false })
        .limit(5)
        .abortSignal(controller.signal);
      
      if (controller.signal.aborted) return;
      
      if (recent) setRecentJobs(recent);

          // 3. Fetch Low Stock
          const { data: lowStockParts } = await supabase
            .from('parts')
            .select('*')
            .lte('stock_quantity', 5)
            .limit(5)
            .abortSignal(controller.signal);
    
          if (controller.signal.aborted) return;
    
          if (lowStockParts) setLowStock(lowStockParts);
          
      } catch (error: any) {
          if (error.name !== 'AbortError') {
             console.error('Error loading dashboard:', error);
          }
      } finally {
          if (!controller.signal.aborted) {
              setLoading(false);
          }
      }
    };

    fetchDashboardData();
    
    return () => {
        controller.abort();
    };
  }, []);

  const SkeletonCard = () => (
      <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl animate-pulse h-32">
          <div className="h-8 w-8 bg-slate-800 rounded-lg mb-4"></div>
          <div className="h-8 w-24 bg-slate-800 rounded mb-2"></div>
          <div className="h-4 w-16 bg-slate-800 rounded"></div>
      </div>
  );

  return (
    <div className="p-2 space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-slate-400">Welcome back, {profile?.full_name?.split(' ')[0] || 'Technician'}. Here's what's happening today.</p>
        </div>
        <div className="flex gap-3">
             <button 
                onClick={() => navigate('/scan')}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-cyan-500/20">
            Scanning Tool
          </button>
          <button 
                onClick={() => navigate('/jobs')}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors">
            + New Job
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {loading ? (
            <>
                <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
            </>
        ) : (
            <>
                <StatCard 
                  title="Total Revenue" 
                  value={`LKR ${stats.revenue.toLocaleString()}`} 
                  subtext="Lifetime Revenue" 
                  icon={DollarSign} 
                  color="text-emerald-400"
                />
                <StatCard 
                  title="Active Jobs" 
                  value={stats.activeJobs} 
                  subtext="Jobs in progress or waiting" 
                  icon={Briefcase} 
                  color="text-cyan-400"
                />
                <StatCard 
                  title="Total Customers" 
                  value={stats.customers} 
                  subtext="Registered in system" 
                  icon={Users} 
                  color="text-violet-400"
                />
                <StatCard 
                  title="Global Efficiency" 
                  value={stats.efficiency} 
                  subtext={parseInt(stats.efficiency) > 100 ? "Excellent (Under Budget)" : parseInt(stats.efficiency) < 80 ? "Attention Needed" : "On Track"} 
                  icon={Activity} 
                  color="text-amber-400"
                />
            </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Recent Activity</h3>
          {loading ? (
             <div className="space-y-4">
                 {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-800/50 rounded-xl animate-pulse"/>)}
             </div>
          ) : (
            <div className="space-y-4">
                {recentJobs.map((job) => (
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
                        <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${job.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-cyan-500/10 text-cyan-400'}`}>
                            {job.status.replace('_', ' ')}
                        </span>
                    </div>
                ))}
                {recentJobs.length === 0 && <div className="text-slate-500 text-center py-4">No recent activity</div>}
            </div>
          )}
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-6">Low Stock Alert</h3>
            {loading ? (
                 <div className="space-y-4">
                     {[1,2,3].map(i => <div key={i} className="h-12 bg-slate-800/50 rounded-lg animate-pulse"/>)}
                 </div>
            ) : (
                <div className="space-y-3">
                     {lowStock.map((part) => (
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
