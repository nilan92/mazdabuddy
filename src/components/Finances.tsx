import { useState, useEffect, useCallback } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Clock, Search, Plus, Filter, Trash2, PieChart } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Modal } from './Modal';
import { useAuth } from '../context/AuthContext';

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
    const [expenseForm, setExpenseForm] = useState({
        amount: '',
        description: '',
        category: 'parts',
        date: new Date().toISOString().split('T')[0]
    });

    const fetchFinances = useCallback(async (signal?: AbortSignal) => {
        setLoading(true);
        try {
            // 1. Fetch Completed Jobs for Revenue
            const { data: jobs } = await supabase
                .from('job_cards')
                .select('estimated_cost_lkr')
                .eq('status', 'completed')
                .abortSignal(signal!);
            
            const revenue = jobs?.reduce((sum, j) => sum + (j.estimated_cost_lkr || 0), 0) || 0;

            // 2. Fetch Expenses
            const { data: expData } = await supabase
                .from('user_expenses')
                .select('*, profiles(full_name)')
                .order('date', { ascending: false })
                .abortSignal(signal!);
            
            const totalExpenses = expData?.reduce((sum, e) => sum + (e.amount_lkr || 0), 0) || 0;

            setStats({
                revenue,
                expenses: totalExpenses,
                profit: revenue - totalExpenses
            });
            setExpenses(expData || []);

        } catch (error: any) {
            if (error.name !== 'AbortError') console.error(error);
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        fetchFinances(controller.signal);
        return () => controller.abort();
    }, [fetchFinances]);

    const handleAddExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        const { error } = await supabase.from('user_expenses').insert({
            user_id: profile?.id,
            amount_lkr: parseFloat(expenseForm.amount),
            description: expenseForm.description,
            category: expenseForm.category,
            date: expenseForm.date
        });

        if (error) alert(error.message);
        else {
            setIsExpenseModalOpen(false);
            setExpenseForm({ amount: '', description: '', category: 'parts', date: new Date().toISOString().split('T')[0] });
            fetchFinances();
        }
    };

    const handleDeleteExpense = async (id: string) => {
        if (!confirm("Delete this expense?")) return;
        const { error } = await supabase.from('user_expenses').delete().eq('id', id);
        if (error) alert(error.message);
        else fetchFinances();
    };

    return (
        <div className="p-2 space-y-8 h-[calc(100vh-100px)] flex flex-col overflow-y-auto">
            {loading && (
                <div className="fixed top-20 right-8 z-50">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
                </div>
            )}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Financial Overview</h1>
                    <p className="text-slate-400">Track revenue, expenses, and profitability.</p>
                </div>
                <button 
                    onClick={() => setIsExpenseModalOpen(true)}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                >
                    <Plus size={20} /> Add Expense
                </button>
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
            <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
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
                                    <td className="px-6 py-4 font-medium text-white">{exp.description}</td>
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
                    <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20">
                        Confirm Expense
                    </button>
                </form>
            </Modal>
        </div>
    );
};
