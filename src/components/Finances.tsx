import { useState, useEffect, useCallback } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Clock, Search, Plus, Filter, Trash2, PieChart, Briefcase, FileText, Download, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Modal } from './Modal';
import { useAuth } from '../context/AuthContext';
import jsPDF from 'jspdf';

export const Finances = () => {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        revenue: 0,
        expenses: 0,
        profit: 0
    });
    const [expenses, setExpenses] = useState<any[]>([]);
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [activeJobs, setActiveJobs] = useState<any[]>([]);
    const [expenseForm, setExpenseForm] = useState({
        amount: '',
        description: '',
        category: 'parts',
        date: new Date().toISOString().split('T')[0],
        job_id: ''
    });

    // Report Generation State
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [reportType, setReportType] = useState<'monthly' | 'annual' | 'custom'>('monthly');
    const [reportDateRange, setReportDateRange] = useState({
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });
    const [generatingReport, setGeneratingReport] = useState(false);
    const [allJobs, setAllJobs] = useState<any[]>([]);

    const fetchFinances = useCallback(async (signal?: AbortSignal) => {
        setLoading(true);
        try {
            // 1. Fetch Completed Jobs for Revenue
            const { data: jobs, error: jobsErr } = await supabase
                .from('job_cards')
                .select('id, estimated_cost_lkr, created_at, completed_at')
                .eq('status', 'completed')
                .abortSignal(signal!);
            
            if (jobsErr) throw jobsErr;
            const revenue = jobs?.reduce((sum, j) => sum + (Number(j.estimated_cost_lkr) || 0), 0) || 0;
            
            // Store all jobs for report generation
            setAllJobs(jobs || []);

            // 2. Fetch Manual Expenses
            const { data: manualExp, error: manualErr } = await supabase
                .from('user_expenses')
                // Use explicit join syntax to avoid ambiguity
                .select('*, profiles!user_id(full_name), job_cards(vehicles(license_plate))')
                .order('date', { ascending: false })
                .abortSignal(signal!);
            
            if (manualErr) throw manualErr;

            // 3. Fetch Job Parts Costs (completed jobs only)
            const { data: jobParts, error: partsErr } = await supabase
                .from('job_parts')
                .select('*, parts(cost_lkr, name), job_cards!inner(status, vehicles(license_plate))')
                .eq('job_cards.status', 'completed');
            
            if (partsErr) console.warn('[Finances] Parts cost fetch error:', partsErr);

            // 4. Fetch Job Labor Costs
            const { data: jobLabor, error: laborErr } = await supabase
                .from('job_labor')
                .select('*, job_cards!inner(status, vehicles(license_plate))')
                .eq('job_cards.status', 'completed');

            if (laborErr) console.warn('[Finances] Labor cost fetch error:', laborErr);

            // Fetch tenant settings to get accurate labor cost
            const { data: settings } = await supabase.from('tenants').select('default_labor_rate').single();

            const laborCostBasis = settings?.default_labor_rate ? Number(settings.default_labor_rate) : 1500;
            // Process integrated expenses
            const integratedJobExp = [
                ...(jobParts || []).map(jp => ({
                    id: `jp-${jp.id}`,
                    date: jp.created_at,
                    description: `Part: ${jp.parts?.name || jp.custom_name || 'Item'}`,
                    category: 'parts',
                    amount_lkr: (Number(jp.parts?.cost_lkr) || 0) * (jp.quantity || 1),
                    profiles: { full_name: 'Job System' },
                    job_cards: jp.job_cards,
                    is_automatic: true
                })),
                ...(jobLabor || []).map(jl => ({
                    id: `jl-${jl.id}`,
                    date: jl.created_at,
                    description: `Labor: ${jl.description || 'Service'}`,
                    category: 'labor',
                    // FIX: Use defined cost basis, not hardcoded 1000
                    amount_lkr: (Number(jl.hours) || 0) * laborCostBasis, 
                    profiles: { full_name: jl.mechanic_name || 'Technician' },
                    job_cards: jl.job_cards,
                    is_automatic: true
                }))
            ];

            const allExpenses = [
                ...(manualExp || []).map(e => ({ ...e, is_automatic: false })),
                ...integratedJobExp
            ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            const totalExpenses = allExpenses.reduce((sum, e) => sum + (Number(e.amount_lkr) || 0), 0);

            setStats({
                revenue,
                expenses: totalExpenses,
                profit: revenue - totalExpenses
            });
            setExpenses(allExpenses);

        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error('[Finances Fetch Error]', error);
                alert("Financial Sync Failed: " + error.message);
            }
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, []);

    const fetchActiveJobs = useCallback(async () => {
        const { data } = await supabase
            .from('job_cards')
            // @ts-ignore
            .select('*, vehicles(license_plate, make, model)')
            .in('status', ['pending', 'in_progress', 'waiting_parts'])
            .order('created_at', { ascending: false });
        // @ts-ignore
        setActiveJobs(data || []);
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        fetchFinances(controller.signal);
        fetchActiveJobs();
        return () => controller.abort();
    }, [fetchFinances]);

    const [submitting, setSubmitting] = useState(false);

    const handleAddExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        const { error } = await supabase.from('user_expenses').insert({
            user_id: profile?.id,
            tenant_id: profile?.tenant_id,
            amount_lkr: parseFloat(expenseForm.amount),
            description: expenseForm.description,
            category: expenseForm.category,
            date: expenseForm.date,
            job_id: expenseForm.job_id || null
        });

        if (error) alert("Error: " + error.message);
        else {
            setIsExpenseModalOpen(false);
            setExpenseForm({ amount: '', description: '', category: 'parts', date: new Date().toISOString().split('T')[0], job_id: '' });
            fetchFinances();
        }
        setSubmitting(false);
    };

    const handleDeleteExpense = async (id: string) => {
        if (!confirm("Delete this expense?")) return;
        const { error } = await supabase.from('user_expenses').delete().eq('id', id);
        if (error) alert(error.message);
        else fetchFinances();
    };

    // Report Generation Functions
    const handleReportTypeChange = (type: 'monthly' | 'annual' | 'custom') => {
        setReportType(type);
        const now = new Date();
        
        if (type === 'monthly') {
            // Current month
            const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            setReportDateRange({
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0]
            });
        } else if (type === 'annual') {
            // Current year
            const startDate = new Date(now.getFullYear(), 0, 1);
            const endDate = new Date(now.getFullYear(), 11, 31);
            setReportDateRange({
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0]
            });
        }
        // For custom, user will set dates manually
    };

    const getFilteredReportData = () => {
        const start = new Date(reportDateRange.startDate);
        const end = new Date(reportDateRange.endDate);
        end.setHours(23, 59, 59, 999); // Include full end date

        // Filter jobs by date
        const filteredJobs = allJobs.filter(job => {
            const jobDate = new Date(job.completed_at || job.created_at);
            return jobDate >= start && jobDate <= end;
        });

        // Filter expenses by date
        const filteredExpenses = expenses.filter(exp => {
            const expDate = new Date(exp.date);
            return expDate >= start && expDate <= end;
        });

        const revenue = filteredJobs.reduce((sum, j) => sum + (Number(j.estimated_cost_lkr) || 0), 0);
        const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (Number(e.amount_lkr) || 0), 0);
        const profit = revenue - totalExpenses;

        // Category breakdown
        const categoryBreakdown: Record<string, number> = {};
        filteredExpenses.forEach(exp => {
            const category = exp.category || 'other';
            categoryBreakdown[category] = (categoryBreakdown[category] || 0) + Number(exp.amount_lkr);
        });

        return {
            revenue,
            expenses: totalExpenses,
            profit,
            jobCount: filteredJobs.length,
            expenseCount: filteredExpenses.length,
            categoryBreakdown,
            filteredExpenses
        };
    };

    const generatePDFReport = async () => {
        setGeneratingReport(true);
        
        try {
            // Fetch Tenant Logo manually just for report
            let logoUrl = '';
            if (profile?.tenant_id) {
                const { data } = await supabase.from('tenants').select('logo_url').eq('id', profile.tenant_id).single();
                logoUrl = data?.logo_url || '';
            }

            const reportData = getFilteredReportData();
            const doc = new jsPDF();
            
            // Logo
            if (logoUrl) {
                try {
                     const imgProps = doc.getImageProperties(logoUrl);
                     const ratio = imgProps.height / imgProps.width;
                     const width = 25;
                     const height = width * ratio;
                     doc.addImage(logoUrl, 'PNG', 20, 15, width, height);
                } catch (e) { console.warn("Logo error", e); }
            }

            // Header
            doc.setFontSize(20);
            doc.setFont('helvetica', 'bold');
            doc.text('AutoPulse OS', 105, 20, { align: 'center' });
            
            doc.setFontSize(14);
            doc.text('Financial Report', 105, 30, { align: 'center' });
            
            // Report Period
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            const periodText = reportType === 'monthly' ? 'Monthly Report' : 
                              reportType === 'annual' ? 'Annual Report' : 'Custom Period Report';
            doc.text(`${periodText}: ${reportDateRange.startDate} to ${reportDateRange.endDate}`, 105, 38, { align: 'center' });
            doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 105, 44, { align: 'center' });
            
            // Summary Section
            let yPos = 60;
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Financial Summary', 20, yPos);
            
            yPos += 10;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            
            // Summary boxes
            doc.setDrawColor(34, 197, 94); // Green
            doc.setFillColor(240, 253, 244);
            doc.rect(20, yPos, 55, 25, 'FD');
            doc.setFont('helvetica', 'bold');
            doc.text('Total Revenue', 25, yPos + 8);
            doc.setFontSize(14);
            doc.text(`LKR ${reportData.revenue.toLocaleString()}`, 25, yPos + 18);
            
            doc.setDrawColor(239, 68, 68); // Red
            doc.setFillColor(254, 242, 242);
            doc.rect(80, yPos, 55, 25, 'FD');
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('Total Expenses', 85, yPos + 8);
            doc.setFontSize(14);
            doc.text(`LKR ${reportData.expenses.toLocaleString()}`, 85, yPos + 18);
            
            const profitColor: [number, number, number] = reportData.profit >= 0 ? [34, 197, 94] : [239, 68, 68];
            doc.setDrawColor(...profitColor);
            doc.setFillColor(reportData.profit >= 0 ? 240 : 254, reportData.profit >= 0 ? 253 : 242, reportData.profit >= 0 ? 244 : 242);
            doc.rect(140, yPos, 55, 25, 'FD');
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('Net Profit', 145, yPos + 8);
            doc.setFontSize(14);
            doc.text(`LKR ${reportData.profit.toLocaleString()}`, 145, yPos + 18);
            
            // Statistics
            yPos += 35;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Completed Jobs: ${reportData.jobCount}`, 20, yPos);
            doc.text(`Total Expenses Recorded: ${reportData.expenseCount}`, 20, yPos + 6);
            
            // Category Breakdown
            yPos += 20;
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Expense Breakdown by Category', 20, yPos);
            
            yPos += 8;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            
            Object.entries(reportData.categoryBreakdown).forEach(([category, amount]) => {
                doc.text(`${category.charAt(0).toUpperCase() + category.slice(1)}: LKR ${amount.toLocaleString()}`, 25, yPos);
                yPos += 6;
            });
            
            // Detailed Expenses Table
            yPos += 10;
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }
            
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Detailed Expense Log', 20, yPos);
            
            yPos += 8;
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text('Date', 20, yPos);
            doc.text('Description', 45, yPos);
            doc.text('Category', 120, yPos);
            doc.text('Amount (LKR)', 160, yPos);
            
            yPos += 2;
            doc.setDrawColor(200, 200, 200);
            doc.line(20, yPos, 195, yPos);
            
            yPos += 5;
            doc.setFont('helvetica', 'normal');
            
            reportData.filteredExpenses.forEach((exp) => { // Limit to 30 for PDF
                if (yPos > 280) {
                    doc.addPage();
                    yPos = 20;
                }
                
                doc.text(new Date(exp.date).toLocaleDateString(), 20, yPos);
                const desc = exp.description.length > 35 ? exp.description.substring(0, 32) + '...' : exp.description;
                doc.text(desc, 45, yPos);
                doc.text(exp.category, 120, yPos);
                doc.text(exp.amount_lkr.toLocaleString(), 160, yPos);
                yPos += 6;
            });
            
            if (reportData.filteredExpenses.length > 30) {
                yPos += 5;
                doc.setFont('helvetica', 'italic');
                doc.text(`... and ${reportData.filteredExpenses.length - 30} more expenses`, 20, yPos);
            }
            
            // Footer
            const pageCount = doc.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(150, 150, 150);
                doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
                doc.text('AutoPulse OS - Workshop Management System', 105, 285, { align: 'center' });
            }
            
            // Save PDF
            const fileName = `Financial_Report_${reportType}_${reportDateRange.startDate}_to_${reportDateRange.endDate}.pdf`;
            doc.save(fileName);
            
            alert('Report generated successfully!');
        } catch (error) {
            console.error('PDF Generation Error:', error);
            alert('Failed to generate PDF report. Please try again.');
        } finally {
            setGeneratingReport(false);
        }
    };

    return (
        <div className="p-2 space-y-8 h-[calc(100vh-100px)] flex flex-col overflow-y-auto">
            {loading && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-900/90 border border-cyan-500/20 px-4 py-2 rounded-full backdrop-blur shadow-xl animate-fade-in">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-cyan-500 border-t-transparent"></div>
                    <span className="text-cyan-400 text-xs font-bold uppercase tracking-widest">Updating Finances...</span>
                </div>
            )}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Financial Overview</h1>
                    <p className="text-slate-400">Track revenue, expenses, and profitability.</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={() => setIsReportModalOpen(true)}
                        className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-cyan-500/20 transition-all active:scale-95"
                    >
                        <FileText size={20} /> Generate Report
                    </button>
                    <button 
                        onClick={() => setIsExpenseModalOpen(true)}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                    >
                        <Plus size={20} /> Add Expense
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 text-emerald-500/10"><TrendingUp size={64}/></div>
                    <div className="flex items-center gap-3 text-slate-400 mb-4">
                        <DollarSign size={20} className="text-emerald-400" />
                        <span className="text-sm font-medium uppercase tracking-wider">Total Revenue</span>
                    </div>
                    <div className="text-3xl font-black text-white font-mono">LKR {stats.revenue.toLocaleString()}</div>
                    <div className="mt-2 text-xs text-emerald-400 flex items-center gap-1">
                        <TrendingUp size={12}/> Based on completed jobs
                    </div>
                </div>

                <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 text-rose-500/10"><TrendingDown size={64}/></div>
                    <div className="flex items-center gap-3 text-slate-400 mb-4">
                        <TrendingDown size={20} className="text-rose-400" />
                        <span className="text-sm font-medium uppercase tracking-wider">Total Expenses</span>
                    </div>
                    <div className="text-3xl font-black text-white font-mono">LKR {stats.expenses.toLocaleString()}</div>
                    <div className="mt-2 text-xs text-rose-400 flex items-center gap-1">
                        <TrendingDown size={12}/> Shop overheads & parts
                    </div>
                </div>

                <div className={`bg-slate-900/50 border p-6 rounded-2xl relative overflow-hidden transition-colors ${stats.profit >= 0 ? 'border-emerald-500/20' : 'border-rose-500/20'}`}>
                    <div className="absolute top-0 right-0 p-4 text-white/5"><PieChart size={64}/></div>
                    <div className="flex items-center gap-3 text-slate-400 mb-4">
                        <TrendingUp size={20} className={stats.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'} />
                        <span className="text-sm font-medium uppercase tracking-wider">Net Profit</span>
                    </div>
                    <div className={`text-3xl font-black font-mono ${stats.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        LKR {stats.profit.toLocaleString()}
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                        {stats.profit >= 0 ? 'Profitable operation' : 'Negative margin'}
                    </div>
                </div>
            </div>

            {/* Expenses Table */}
            <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-2xl flex flex-col">
                <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Clock size={20} className="text-cyan-400" /> Expense Log
                    </h3>
                    <div className="flex items-center gap-2">
                         <div className="relative">
                            <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
                            <input type="text" placeholder="Search expenses..." className="bg-slate-800 border border-slate-700 rounded-lg py-2 pl-9 pr-4 text-xs text-white focus:outline-none focus:border-cyan-500 w-full md:w-64" />
                         </div>
                         <button className="p-2 bg-slate-800 text-slate-400 rounded-lg hover:text-white transition-colors border border-slate-700">
                            <Filter size={18} />
                         </button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-950/50 text-slate-400 uppercase text-[10px] font-bold tracking-widest">
                            <tr>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Description</th>
                                <th className="px-6 py-4">Category</th>
                                <th className="px-6 py-4">Logged By</th>
                                <th className="px-6 py-4 text-right">Amount (LKR)</th>
                                <th className="px-6 py-4 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {expenses.map((exp) => (
                                <tr key={exp.id} className="hover:bg-slate-800/30 transition-colors group">
                                    <td className="px-6 py-4 text-slate-400">{new Date(exp.date).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 font-medium text-white">
                                        {exp.description}
                                        {exp.job_id && (
                                            <div className="flex items-center gap-1 mt-1">
                                                <span className="text-[10px] bg-cyan-900/30 text-cyan-400 border border-cyan-900/50 px-1.5 py-0.5 rounded flex items-center w-fit">
                                                    <Briefcase size={10} className="mr-1" />
                                                    {/* @ts-ignore */}
                                                    {exp.job_cards?.vehicles?.license_plate || 'Linked Job'}
                                                </span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                                            exp.category === 'parts' ? 'bg-purple-500/10 text-purple-400' :
                                            exp.category === 'utility' ? 'bg-blue-500/10 text-blue-400' :
                                            'bg-slate-700 text-slate-300'
                                        }`}>
                                            {exp.category}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500">{exp.profiles?.full_name || 'System'}</td>
                                    <td className="px-6 py-4 text-right font-mono font-bold text-white">{exp.amount_lkr.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-center">
                                        <button 
                                            onClick={() => handleDeleteExpense(exp.id)}
                                            className="text-slate-600 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {expenses.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-10 text-center text-slate-500 italic">No expenses recorded yet.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Expense Modal */}
            <Modal isOpen={isExpenseModalOpen} onClose={() => setIsExpenseModalOpen(false)} title="Record New Expense">
                <form onSubmit={handleAddExpense} className="space-y-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Description</label>
                        <input 
                            required 
                            type="text" 
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none"
                            placeholder="e.g. Shop Electricity Bill"
                            value={expenseForm.description}
                            onChange={(e) => setExpenseForm({...expenseForm, description: e.target.value})}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Amount (LKR)</label>
                            <input 
                                required 
                                type="number" 
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none font-mono"
                                value={expenseForm.amount}
                                onChange={(e) => setExpenseForm({...expenseForm, amount: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Date</label>
                            <input 
                                required 
                                type="date" 
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none"
                                value={expenseForm.date}
                                onChange={(e) => setExpenseForm({...expenseForm, date: e.target.value})}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Category</label>
                        <select 
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none"
                            value={expenseForm.category}
                            onChange={(e) => setExpenseForm({...expenseForm, category: e.target.value})}
                        >
                            <option value="parts">Parts Purchase</option>
                            <option value="utility">Utilities & Rent</option>
                            <option value="marketing">Marketing</option>
                            <option value="salary">Salaries</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Link to Job (Optional)</label>
                        <select 
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none text-sm"
                            value={expenseForm.job_id}
                            onChange={(e) => setExpenseForm({...expenseForm, job_id: e.target.value})}
                        >
                            <option value="">-- General Expense --</option>
                            {activeJobs.map((job) => (
                                <option key={job.id} value={job.id}>
                                    {job.vehicles?.license_plate} - {job.vehicles?.make} {job.vehicles?.model}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button type="submit" disabled={submitting} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2">
                        {submitting ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white"></div>
                                RECORDING...
                            </>
                        ) : 'Confirm Expense'}
                    </button>
                </form>
            </Modal>

            {/* Report Generation Modal */}
            <Modal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} title="Generate Financial Report">
                <div className="space-y-6">
                    {/* Report Type Selection */}
                    <div>
                        <label className="block text-sm text-slate-400 mb-3 font-medium">Report Type</label>
                        <div className="grid grid-cols-3 gap-3">
                            <button
                                type="button"
                                onClick={() => handleReportTypeChange('monthly')}
                                className={`p-4 rounded-xl border-2 transition-all ${
                                    reportType === 'monthly'
                                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                                        : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                                }`}
                            >
                                <Calendar size={20} className="mx-auto mb-2" />
                                <div className="text-xs font-bold">Monthly</div>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleReportTypeChange('annual')}
                                className={`p-4 rounded-xl border-2 transition-all ${
                                    reportType === 'annual'
                                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                                        : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                                }`}
                            >
                                <TrendingUp size={20} className="mx-auto mb-2" />
                                <div className="text-xs font-bold">Annual</div>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleReportTypeChange('custom')}
                                className={`p-4 rounded-xl border-2 transition-all ${
                                    reportType === 'custom'
                                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                                        : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                                }`}
                            >
                                <Filter size={20} className="mx-auto mb-2" />
                                <div className="text-xs font-bold">Custom</div>
                            </button>
                        </div>
                    </div>

                    {/* Date Range Selection */}
                    {reportType === 'custom' ? (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Start Date</label>
                                <input
                                    type="date"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none"
                                    value={reportDateRange.startDate}
                                    onChange={(e) => setReportDateRange({ ...reportDateRange, startDate: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">End Date</label>
                                <input
                                    type="date"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none"
                                    value={reportDateRange.endDate}
                                    onChange={(e) => setReportDateRange({ ...reportDateRange, endDate: e.target.value })}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                             <div className="grid grid-cols-2 gap-4">
                                {reportType === 'monthly' && (
                                     <div>
                                        <label className="block text-sm text-slate-400 mb-1">Month</label>
                                        <select 
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none appearance-none"
                                            value={new Date(reportDateRange.startDate).getMonth()}
                                            onChange={(e) => {
                                                const year = new Date(reportDateRange.startDate).getFullYear();
                                                const month = parseInt(e.target.value);
                                                const start = new Date(year, month, 1);
                                                const end = new Date(year, month + 1, 0);
                                                setReportDateRange({
                                                    startDate: start.toISOString().split('T')[0],
                                                    endDate: end.toISOString().split('T')[0]
                                                });
                                            }}
                                        >
                                            {Array.from({ length: 12 }, (_, i) => (
                                                <option key={i} value={i}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>
                                            ))}
                                        </select>
                                     </div>
                                )}
                                <div className={reportType === 'annual' ? 'col-span-2' : ''}>
                                    <label className="block text-sm text-slate-400 mb-1">Year</label>
                                    <select 
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none appearance-none"
                                        value={new Date(reportDateRange.startDate).getFullYear()}
                                        onChange={(e) => {
                                            const year = parseInt(e.target.value);
                                            let start, end;
                                            if (reportType === 'monthly') {
                                                const month = new Date(reportDateRange.startDate).getMonth();
                                                start = new Date(year, month, 1);
                                                end = new Date(year, month + 1, 0);
                                            } else {
                                                start = new Date(year, 0, 1);
                                                end = new Date(year, 11, 31);
                                            }
                                            setReportDateRange({
                                                startDate: start.toISOString().split('T')[0],
                                                endDate: end.toISOString().split('T')[0]
                                            });
                                        }}
                                    >
                                        {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                                            <option key={year} value={year}>{year}</option>
                                        ))}
                                    </select>
                                </div>
                             </div>
                        </div>
                    )}

                    {/* Report Preview */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                        <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                            <PieChart size={16} className="text-cyan-400" />
                            Report Preview
                        </h4>
                        {(() => {
                            const previewData = getFilteredReportData();
                            return (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-slate-950 rounded-lg p-3 border border-emerald-500/20">
                                            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Revenue</div>
                                            <div className="text-emerald-400 font-bold font-mono text-sm">
                                                LKR {previewData.revenue.toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="bg-slate-950 rounded-lg p-3 border border-rose-500/20">
                                            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Expenses</div>
                                            <div className="text-rose-400 font-bold font-mono text-sm">
                                                LKR {previewData.expenses.toLocaleString()}
                                            </div>
                                        </div>
                                        <div className={`bg-slate-950 rounded-lg p-3 border ${previewData.profit >= 0 ? 'border-emerald-500/20' : 'border-rose-500/20'}`}>
                                            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Profit</div>
                                            <div className={`font-bold font-mono text-sm ${previewData.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                LKR {previewData.profit.toLocaleString()}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-xs text-slate-400 flex items-center justify-between">
                                        <span>{previewData.jobCount} completed jobs</span>
                                        <span>{previewData.expenseCount} expense records</span>
                                    </div>

                                    {/* Category Breakdown */}
                                    {Object.keys(previewData.categoryBreakdown).length > 0 && (
                                        <div className="border-t border-slate-800 pt-3 mt-3">
                                            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Expense Categories</div>
                                            <div className="space-y-1">
                                                {Object.entries(previewData.categoryBreakdown).map(([category, amount]) => (
                                                    <div key={category} className="flex items-center justify-between text-xs">
                                                        <span className="text-slate-400 capitalize">{category}</span>
                                                        <span className="text-white font-mono">LKR {amount.toLocaleString()}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>

                    {/* Generate Button */}
                    <button
                        onClick={generatePDFReport}
                        disabled={generatingReport}
                        className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {generatingReport ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white"></div>
                                GENERATING PDF...
                            </>
                        ) : (
                            <>
                                <Download size={20} />
                                Download PDF Report
                            </>
                        )}
                    </button>

                    <p className="text-xs text-slate-500 text-center">
                        Report will include summary, category breakdown, and detailed expense log
                    </p>
                </div>
            </Modal>
        </div>
    );
};
