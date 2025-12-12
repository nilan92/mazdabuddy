import { useState, useEffect } from 'react';
import { Save, RefreshCcw, User, Trash2, Edit2, Check, X, Shield, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export const Settings = () => {
    const { profile } = useAuth();
    const isAdmin = profile?.role === 'admin';
    const [activeTab, setActiveTab] = useState<'general' | 'users'>('general');

    // General Settings State
    const [settings, setSettings] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    // Users Settings State
    const [users, setUsers] = useState<any[]>([]);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ full_name: '', role: '' });
    const [usersLoading, setUsersLoading] = useState(false);

    const fetchSettings = async () => {
        setLoading(true);
        const { data } = await supabase.from('shop_settings').select('*');
        if (data) {
            const map: Record<string, string> = {};
            data.forEach(item => map[item.key] = item.value);
            setSettings(map);
        }
        setLoading(false);
    };

    const fetchUsers = async () => {
        if (!isAdmin) return;
        setUsersLoading(true);
        const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: true });
        if (data) setUsers(data);
        setUsersLoading(false);
    };

    useEffect(() => {
        fetchSettings();
        if (isAdmin) fetchUsers();
    }, [isAdmin]);

    // General Settings Handlers
    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        const upserts = Object.keys(settings).map(key => ({ key, value: settings[key] }));
        const { error } = await supabase.from('shop_settings').upsert(upserts, { onConflict: 'key' });
        if (error) alert("Error saving settings: " + error.message);
        else alert("Settings saved successfully!");
    };

    const handleSettingChange = (key: string, value: string) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    // User Management Handlers
    const startEditUser = (user: any) => {
        setEditingUserId(user.id);
        setEditForm({ full_name: user.full_name || '', role: user.role || 'technician' });
    };

    const cancelEditUser = () => {
        setEditingUserId(null);
        setEditForm({ full_name: '', role: '' });
    };

    const saveEditUser = async (id: string) => {
        const { error } = await supabase.from('profiles').update(editForm).eq('id', id);
        if (error) {
            alert("Failed to update user: " + error.message);
        } else {
            setUsers(prev => prev.map(u => u.id === id ? { ...u, ...editForm } : u));
            setEditingUserId(null);
        }
    };

    const deleteUser = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to remove ${name}? This will revoke their access.`)) return;
        const { error } = await supabase.from('profiles').delete().eq('id', id);
        if (error) {
            alert("Failed to delete user: " + error.message);
        } else {
            setUsers(prev => prev.filter(u => u.id !== id));
        }
    };

    return (
        <div className="p-2 max-w-4xl mx-auto h-[calc(100vh-100px)] flex flex-col">
             <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
                    <p className="text-slate-400">Configure your shop and manage team.</p>
                </div>
                <div className="flex gap-2">
                     <button 
                        onClick={() => { fetchSettings(); if(isAdmin) fetchUsers(); }}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                        title="Refresh"
                     >
                        <RefreshCcw size={20} className={loading || usersLoading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-800 mb-6">
                <button 
                    onClick={() => setActiveTab('general')}
                    className={`px-6 py-3 font-bold text-sm transition-colors border-b-2 ${activeTab === 'general' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-500 hover:text-white'}`}
                >
                    General
                </button>
                {isAdmin && (
                    <button 
                        onClick={() => setActiveTab('users')}
                        className={`px-6 py-3 font-bold text-sm transition-colors border-b-2 ${activeTab === 'users' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-500 hover:text-white'}`}
                    >
                        Users & Roles
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto">
                {activeTab === 'general' && (
                    <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-2xl p-6">
                        <form onSubmit={handleSaveSettings} className="space-y-6">
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-white border-b border-slate-800 pb-2">Shop Information</h3>
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Shop Name</label>
                                    <input 
                                        type="text" 
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 focus:border-cyan-500 focus:outline-none"
                                        value={settings['shop_name'] || ''}
                                        onChange={e => handleSettingChange('shop_name', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Address</label>
                                    <textarea
                                        rows={3}
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 focus:border-cyan-500 focus:outline-none"
                                        value={settings['shop_address'] || ''}
                                        onChange={e => handleSettingChange('shop_address', e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-white border-b border-slate-800 pb-2">Defaults</h3>
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Default Labor Rate (LKR / Hour)</label>
                                    <input 
                                        type="number" 
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 focus:border-cyan-500 focus:outline-none font-mono"
                                        value={settings['default_labor_rate'] || ''}
                                        onChange={e => handleSettingChange('default_labor_rate', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Tax Rate (%) - Optional</label>
                                    <input 
                                        type="number" 
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 focus:border-cyan-500 focus:outline-none font-mono"
                                        value={settings['tax_rate'] || '0'}
                                        onChange={e => handleSettingChange('tax_rate', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">AI Service API Key (OpenRouter)</label>
                                    <input 
                                        type="password" 
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 focus:border-cyan-500 focus:outline-none font-mono"
                                        placeholder="sk-or-..."
                                        value={settings['ai_api_key'] || ''}
                                        onChange={e => handleSettingChange('ai_api_key', e.target.value)}
                                    />
                                    <p className="text-xs text-slate-500 mt-1">Optional: Required for AI features.</p>
                                </div>
                            </div>

                            <div className="pt-4">
                                <button type="submit" className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium shadow-lg shadow-cyan-500/20 transition-all flex justify-center items-center gap-2">
                                     <Save size={20} /> Save Configuration
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {activeTab === 'users' && isAdmin && (
                    <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-2xl p-6">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-white">Team Members</h3>
                                <button onClick={() => alert("To add a new user:\n\n1. Go to your Supabase Dashboard > Authentication.\n2. Click 'Add User'.\n3. Enter their email and password.\n\nThe system will now automatically create their profile based on the fix provided.")} className="bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                                    <Plus size={16} /> Add User
                                </button>
                            </div>
                            
                            <div className="grid gap-3">
                                {users.map(user => (
                                    <div key={user.id} className="bg-slate-800/40 border border-slate-700/50 p-4 rounded-xl flex items-center justify-between group hover:border-slate-600 transition-colors">
                                        {editingUserId === user.id ? (
                                            <div className="flex-1 flex gap-3 items-center">
                                                <input 
                                                    value={editForm.full_name} 
                                                    onChange={e => setEditForm({...editForm, full_name: e.target.value})}
                                                    className="bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm flex-1"
                                                    placeholder="Full Name"
                                                />
                                                <select 
                                                    value={editForm.role}
                                                    onChange={e => setEditForm({...editForm, role: e.target.value})}
                                                    className="bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm"
                                                >
                                                    <option value="technician">Technician</option>
                                                    <option value="manager">Manager</option>
                                                    <option value="admin">Admin</option>
                                                    <option value="accountant">Accountant</option>
                                                </select>
                                                <button onClick={() => saveEditUser(user.id)} className="p-2 bg-green-500/10 text-green-400 rounded hover:bg-green-500/20"><Check size={18}/></button>
                                                <button onClick={cancelEditUser} className="p-2 bg-slate-700/50 text-slate-400 rounded hover:bg-slate-700"><X size={18}/></button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold">
                                                        {user.full_name?.charAt(0) || <User size={20}/>}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-white">{user.full_name}</div>
                                                        <div className="text-xs text-slate-400 flex items-center gap-1">
                                                            {user.role === 'admin' && <Shield size={10} className="text-cyan-400" />}
                                                            <span className="uppercase tracking-wider">{user.role}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => startEditUser(user)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"><Edit2 size={18}/></button>
                                                    <button onClick={() => deleteUser(user.id, user.full_name)} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 size={18}/></button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                                {users.length === 0 && <p className="text-slate-500 text-center py-6">No users found.</p>}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
