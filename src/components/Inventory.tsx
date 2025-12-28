import { useState } from 'react';
import { Search, Plus, AlertTriangle, Package, RefreshCcw, Edit, Trash2 } from 'lucide-react';
import type { Part } from '../types';
import { supabase } from '../lib/supabase';
import { Modal } from './Modal';
import { useAuth } from '../context/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export const Inventory = () => {
    const { profile } = useAuth();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPart, setEditingPart] = useState<Part | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        part_number: '',
        location: '',
        stock_quantity: 0,
        min_stock_level: 5,
        price_lkr: 0,
        cost_lkr: 0
    });

    const { data: parts = [], isLoading: loading } = useQuery({
        queryKey: ['parts'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('parts')
                .select('*')
                .order('name');
            if (error) throw error;
            return data as Part[];
        }
    });

    const refreshParts = () => queryClient.invalidateQueries({ queryKey: ['parts'] });

    const openAddModal = () => {
        setEditingPart(null);
        setFormData({
            name: '',
            part_number: '',
            location: '',
            stock_quantity: 0,
            min_stock_level: 5,
            price_lkr: 0,
            cost_lkr: 0
        });
        setIsModalOpen(true);
    };

    const openEditModal = (part: Part) => {
        setEditingPart(part);
        setFormData({
            name: part.name,
            part_number: part.part_number || '',
            location: part.location || '',
            stock_quantity: part.stock_quantity,
            min_stock_level: part.min_stock_level || 5,
            price_lkr: part.price_lkr,
            cost_lkr: part.cost_lkr
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this part?")) return;
        
        const { error } = await supabase.from('parts').delete().eq('id', id);
        if (error) alert(error.message);
        else refreshParts();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const payload = {
            ...formData,
            stock_quantity: Number(formData.stock_quantity),
            min_stock_level: Number(formData.min_stock_level),
            price_lkr: Number(formData.price_lkr),
            cost_lkr: Number(formData.cost_lkr)
        };

        let result;
        if (editingPart) {
            result = await supabase.from('parts').update(payload).eq('id', editingPart.id);
        } else {
            result = await supabase.from('parts').insert([{
                ...payload,
                tenant_id: profile?.tenant_id
            }]);
        }

        if (result.error) {
            alert("Error: " + result.error.message);
        } else {
            setIsModalOpen(false);
            refreshParts();
        }
    };

    const filteredInventory = parts.filter(part => 
        part.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (part.part_number && part.part_number.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="p-2">
             <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Inventory</h1>
                    <p className="text-slate-400">Track parts, stock levels, and pricing.</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={refreshParts}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                        title="Refresh"
                    >
                        <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button 
                        onClick={openAddModal}
                        className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-cyan-500/20">
                        <Plus size={20} />
                        Add Part
                    </button>
                </div>
            </div>

            <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                        <input 
                            type="text" 
                            placeholder="Search parts by name or number..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 text-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:border-cyan-500"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="text-white text-center py-20">Loading inventory...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-900/80 text-slate-400 text-xs uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Part Details</th>
                                    <th className="px-6 py-4 font-semibold">Location</th>
                                    <th className="px-6 py-4 font-semibold">Stock Level</th>
                                    <th className="px-6 py-4 font-semibold text-right">Price (LKR)</th>
                                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                                 </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {filteredInventory.map((part) => (
                                    <tr key={part.id} className="hover:bg-slate-800/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500">
                                                    <Package size={20} />
                                                </div>
                                                <div>
                                                    <div className="font-medium text-white">{part.name}</div>
                                                    <div className="text-xs text-slate-500 font-mono">{part.part_number}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-400 font-mono text-sm">
                                            {part.location || 'N/A'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className={`font-semibold ${part.stock_quantity <= (part.min_stock_level || 0) ? 'text-red-400' : 'text-emerald-400'}`}>
                                                    {part.stock_quantity}
                                                </span>
                                                {part.stock_quantity <= (part.min_stock_level || 0) && (
                                                    <AlertTriangle size={16} className="text-red-500" />
                                                )}
                                            </div>
                                            <div className="w-24 h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full ${part.stock_quantity <= (part.min_stock_level || 0) ? 'bg-red-500' : 'bg-emerald-500'}`} 
                                                    style={{ width: `${Math.min((part.stock_quantity / 20) * 100, 100)}%` }} 
                                                />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-slate-300">
                                            {part.price_lkr.toLocaleString()} LKR
                                            <div className="text-[10px] text-slate-600">Cost: {part.cost_lkr.toLocaleString()}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button 
                                                    onClick={() => openEditModal(part)}
                                                    className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-700 rounded transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(part.id)}
                                                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredInventory.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="text-center py-8 text-slate-500">
                                            No parts found. Click "Add Part" to create one.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ADD / EDIT MODAL */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingPart ? "Edit Part" : "Add New Part"}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Part Name *</label>
                        <input 
                            type="text" 
                            required
                            className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 focus:border-cyan-500 focus:outline-none"
                            value={formData.name}
                            onChange={e => setFormData({...formData, name: e.target.value})}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Part Number</label>
                            <input 
                                type="text" 
                                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 focus:border-cyan-500 focus:outline-none"
                                value={formData.part_number}
                                onChange={e => setFormData({...formData, part_number: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Bin/Shelf Location</label>
                            <input 
                                type="text" 
                                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 focus:border-cyan-500 focus:outline-none"
                                value={formData.location}
                                onChange={e => setFormData({...formData, location: e.target.value})}
                            />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Stock Quantity *</label>
                            <input 
                                type="number"
                                min="0" 
                                required
                                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 focus:border-cyan-500 focus:outline-none"
                                value={formData.stock_quantity}
                                onChange={e => setFormData({...formData, stock_quantity: Number(e.target.value)})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Min. Alert Level</label>
                            <input 
                                type="number"
                                min="0" 
                                required
                                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 focus:border-cyan-500 focus:outline-none"
                                value={formData.min_stock_level}
                                onChange={e => setFormData({...formData, min_stock_level: Number(e.target.value)})}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Cost Price (LKR) *</label>
                            <input 
                                type="number"
                                min="0" 
                                step="0.01"
                                required
                                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 focus:border-cyan-500 focus:outline-none"
                                value={formData.cost_lkr}
                                onChange={e => setFormData({...formData, cost_lkr: Number(e.target.value)})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Selling Price (LKR) *</label>
                            <input 
                                type="number"
                                min="0" 
                                step="0.01"
                                required
                                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 focus:border-cyan-500 focus:outline-none"
                                value={formData.price_lkr}
                                onChange={e => setFormData({...formData, price_lkr: Number(e.target.value)})}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                         <button 
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="px-4 py-2 text-slate-400 hover:text-white font-medium"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium shadow-lg shadow-cyan-500/20 transition-all"
                        >
                            {editingPart ? 'Update Part' : 'Add Part'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
