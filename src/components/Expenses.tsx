import { useState, useEffect } from 'react';
import { Plus, Trash2, DollarSign, Briefcase } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Modal } from './Modal';
import type { JobCard } from '../types';

interface Expense {
    id: string;
    amount_lkr: number;
    description: string;
    category: string;
    date: string;
    job_id?: string;
    job_cards?: {
        vehicles: {
            license_plate: string;
        }
    }
}

export const Expenses = () => {
    const { user } = useAuth();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [activeJobs, setActiveJobs] = useState<JobCard[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    const [formData, setFormData] = useState({
        amount_lkr: '',
        description: '',
        category: 'Food',
        date: new Date().toISOString().split('T')[0],
        job_id: ''
    });

    const fetchExpenses = async () => {
        const { data } = await supabase
            .from('user_expenses')
            // @ts-ignore
            .select('*, job_cards(vehicles(license_plate))')
            .eq('user_id', user?.id)
            .order('date', { ascending: false });
            
        if (data) setExpenses(data as any);
    };

    const fetchActiveJobs = async () => {
        // Fetch jobs for dropdown (in progress or pending)
        const { data } = await supabase
            .from('job_cards')
            // @ts-ignore
            .select('*, vehicles(license_plate, make, model)')
            .in('status', ['pending', 'in_progress', 'waiting_parts'])
            .order('created_at', { ascending: false });
            
        if(data) setActiveJobs(data as JobCard[]);
    };

    useEffect(() => {
        if(user) {
            fetchExpenses();
            fetchActiveJobs();
        }
    }, [user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        const { error } = await supabase.from('user_expenses').insert([{
            user_id: user.id,
            amount_lkr: parseFloat(formData.amount_lkr),
            description: formData.description,
            category: formData.category,
            date: formData.date,
            job_id: formData.job_id || null
        }]);

        if (error) alert(error.message);
        else {
            setFormData({ amount_lkr: '', description: '', category: 'Food', date: new Date().toISOString().split('T')[0], job_id: '' });
            setIsModalOpen(false);
            fetchExpenses();
        }
    };

    const handleDelete = async (id: string) => {
        if(!confirm('Are you sure?')) return;
        const { error } = await supabase.from('user_expenses').delete().eq('id', id);
        if (error) alert(error.message);
        else fetchExpenses();
    };

    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount_lkr, 0);

    return (
        <div className="h-[calc(100vh-100px)] flex flex-col">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">My Expenses</h1>
                    <p className="text-slate-400">Track your personal and job-related spending.</p>
                </div>
                <div className="text-right">
                    <div className="text-sm text-slate-400">Total Spent</div>
                    <div className="text-3xl font-bold text-cyan-400 font-mono">LKR {totalExpenses.toLocaleString()}</div>
                </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl flex-1 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex justify-end">
                    <button onClick={() => setIsModalOpen(true)} className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2">
                        <Plus size={20} /> Add Expense
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 p-4 space-y-3">
                    {expenses.map(expense => (
                        <div key={expense.id} className="bg-slate-800/50 p-4 rounded-xl border border-slate-800 flex justify-between items-center hover:border-slate-700 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-full ${expense.category === 'Parts' ? 'bg-purple-900/30 text-purple-400' : 'bg-slate-700 text-slate-300'}`}>
                                    <DollarSign size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white">{expense.description}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs font-mono text-slate-500">{expense.date}</span>
                                        <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-400">{expense.category}</span>
                                        {expense.job_id && (
                                            <span className="text-xs bg-cyan-900/30 text-cyan-400 border border-cyan-900 px-2 py-0.5 rounded flex items-center gap-1">
                                                <Briefcase size={10} />
                                                {/* @ts-ignore */}
                                                {expense.job_cards?.vehicles?.license_plate || 'JOB Linked'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-6">
                                <span className="text-xl font-mono font-bold text-white">LKR {expense.amount_lkr.toLocaleString()}</span>
                                <button onClick={() => handleDelete(expense.id)} className="text-slate-600 hover:text-red-400 transition-colors">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {expenses.length === 0 && (
                        <div className="text-center text-slate-500 py-12">No expenses recorded yet.</div>
                    )}
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Expense">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs uppercase font-bold text-slate-500 mb-1 block">Description</label>
                        <input required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-slate-800 border-slate-700 rounded-lg p-3 text-white" placeholder="e.g. Lunch, Taxi, Spare Fuse" />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs uppercase font-bold text-slate-500 mb-1 block">Amount (LKR)</label>
                            <input type="number" required value={formData.amount_lkr} onChange={e => setFormData({...formData, amount_lkr: e.target.value})} className="w-full bg-slate-800 border-slate-700 rounded-lg p-3 text-white" />
                        </div>
                        <div>
                             <label className="text-xs uppercase font-bold text-slate-500 mb-1 block">Date</label>
                             <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-slate-800 border-slate-700 rounded-lg p-3 text-white" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs uppercase font-bold text-slate-500 mb-1 block">Category</label>
                            <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-slate-800 border-slate-700 rounded-lg p-3 text-white">
                                <option>Food</option>
                                <option>Transport</option>
                                <option>Parts (Urgent)</option>
                                <option>Tools</option>
                                <option>Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs uppercase font-bold text-slate-500 mb-1 block">Link to Job (Optional)</label>
                            <select value={formData.job_id} onChange={e => setFormData({...formData, job_id: e.target.value})} className="w-full bg-slate-800 border-slate-700 rounded-lg p-3 text-white text-sm">
                                <option value="">-- Personal --</option>
                                {activeJobs.map(job => (
                                    <option key={job.id} value={job.id}>
                                        {/* @ts-ignore */}
                                        {job.vehicles?.license_plate} - {job.vehicles?.model}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <button type="submit" className="w-full bg-cyan-600 text-white font-bold py-3 rounded-lg mt-4">Save Expense</button>
                </form>
            </Modal>
        </div>
    );
};

export default Expenses;
