import { useState, useEffect } from 'react';
import { Save, RefreshCcw, Trash2, Edit2, Check, X, Shield, Plus, RotateCcw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export const Settings = () => {
    const { profile } = useAuth();
    const isAdmin = profile?.role === 'admin';
    const [activeTab, setActiveTab] = useState<'general' | 'users' | 'ai'>('general');
    const [aiApiKey, setAiApiKey] = useState('');
    const [aiLoading, setAiLoading] = useState(false);

    // Tenant Settings State
    const [tenantName, setTenantName] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');
    const [terms, setTerms] = useState('');
    const [brandColor, setBrandColor] = useState('#06b6d4');
    const [defaultLaborRate, setDefaultLaborRate] = useState('2500');
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(true);

    // Users Settings State
    const [users, setUsers] = useState<any[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ full_name: '', role: '' });

    const fetchTenantData = async () => {
        if (!profile?.tenant_id) return;
        setLoading(true);
        try {
            const { data } = await supabase
                .from('tenants')
                .select('*')
                .eq('id', profile.tenant_id)
                .single();
            
            if (data) {
                setTenantName(data.name);
                setLogoUrl(data.logo_url || '');
                setAddress(data.address || '');
                setPhone(data.phone || '');
                setTerms(data.terms_and_conditions || '');
                setBrandColor(data.brand_color || '#06b6d4');
                setAiApiKey(data.ai_api_key || '');
                setDefaultLaborRate(data.default_labor_rate?.toString() || '2500');
            }
        } catch (error) {
            console.error('Error fetching tenant:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        if (!isAdmin) return;
        setUsersLoading(true);
        try {
            const { data } = await supabase
                .from('profiles')
                .select('*')
                .order('updated_at', { ascending: false });
            if (data) setUsers(data);
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setUsersLoading(false);
        }
    };

    useEffect(() => {
        fetchTenantData();
        if (isAdmin) fetchUsers();
    }, [isAdmin, profile?.tenant_id]);

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploading(true);
            if (!e.target.files || e.target.files.length === 0) return;

            const file = e.target.files[0];
            const fileExt = file.name.split('.').pop();
            const filePath = `${profile?.tenant_id}/${Math.random()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('logos')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('logos')
                .getPublicUrl(filePath);

            const { error: updateError } = await supabase
                .from('tenants')
                .update({ logo_url: publicUrl })
                .eq('id', profile?.tenant_id);

            if (updateError) throw updateError;

            setLogoUrl(publicUrl);
            alert("Logo updated! Please refresh the page.");
        } catch (error: any) {
            alert(error.message);
        } finally {
            setUploading(false);
        }
    };

    const checkColorContrast = (hex: string) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        
        // Use HSP (Highly Sensitive Poo) color model for brightness
        const brightness = Math.sqrt(
            0.299 * (r * r) +
            0.587 * (g * g) +
            0.114 * (b * b)
        );

        if (brightness < 60) return "TOO_DARK";
        if (brightness > 240) return "TOO_LIGHT";
        return "OK";
    };

    const handleSaveTenant = async (e: React.FormEvent) => {
        e.preventDefault();

        const contrast = checkColorContrast(brandColor);
        if (contrast === "TOO_DARK") {
            alert("This color is too dark. It will be invisible on our dark theme. Please pick a brighter shade.");
            return;
        }
        if (contrast === "TOO_LIGHT") {
            alert("This color is too bright. It will make white text unreadable. Please pick a slightly darker shade.");
            return;
        }

        const { error } = await supabase
            .from('tenants')
            .update({ 
                name: tenantName,
                address: address,
                phone: phone,
                terms_and_conditions: terms,
                brand_color: brandColor,
                default_labor_rate: parseFloat(defaultLaborRate)
            })
            .eq('id', profile?.tenant_id);

        if (error) alert("Error saving settings: " + error.message);
        else alert("Shop settings updated! Theme and details will sync across all terminals.");
    };

    const startEditUser = (user: any) => {
        setEditingUserId(user.id);
        setEditForm({ full_name: user.full_name || '', role: user.role || 'technician' });
    };

    const cancelEditUser = () => {
        setEditingUserId(null);
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
        if (!confirm(`Are you sure you want to remove ${name}?`)) return;
        const { error } = await supabase.from('profiles').delete().eq('id', id);
        if (error) {
            alert("Failed to delete user: " + error.message);
        } else {
            setUsers(prev => prev.filter(u => u.id !== id));
        }
    };

    const handleSaveAiKey = async () => {
        setAiLoading(true);
        try {
            const { error } = await supabase
                .from('tenants')
                .update({ ai_api_key: aiApiKey })
                .eq('id', profile?.tenant_id);
            
            if (error) throw error;
            alert("Workshop AI configuration updated!");
        } catch (error: any) {
            alert("Error saving AI key: " + error.message);
        } finally {
            setAiLoading(false);
        }
    };

    return (
        <div className="p-2 max-w-4xl mx-auto h-[calc(100vh-100px)] flex flex-col text-left">
             <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Shop Settings</h1>
                    <p className="text-slate-400">Manage your garage identity and team.</p>
                </div>
                <div className="flex gap-2">
                     <button 
                        onClick={() => { fetchTenantData(); if(isAdmin) fetchUsers(); }}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                        title="Refresh"
                     >
                        <RefreshCcw size={20} className={loading || usersLoading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            <div className="flex border-b border-slate-800 mb-6">
                <button 
                    onClick={() => setActiveTab('general')}
                    className={`px-6 py-3 font-bold text-sm transition-colors border-b-2`}
                    style={{ 
                        borderBottomColor: activeTab === 'general' ? brandColor : 'transparent',
                        color: activeTab === 'general' ? brandColor : undefined 
                    }}
                >
                    Identity & Logo
                </button>
                {isAdmin && (
                    <button 
                        onClick={() => setActiveTab('users')}
                        className={`px-6 py-3 font-bold text-sm transition-colors border-b-2`}
                        style={{ 
                            borderBottomColor: activeTab === 'users' ? brandColor : 'transparent',
                            color: activeTab === 'users' ? brandColor : undefined 
                        }}
                    >
                        Staff & Access
                    </button>
                )}
                {isAdmin && (
                    <button 
                        onClick={() => setActiveTab('ai')}
                        className={`px-6 py-3 font-bold text-sm transition-colors border-b-2`}
                        style={{ 
                            borderBottomColor: activeTab === 'ai' ? brandColor : 'transparent',
                            color: activeTab === 'ai' ? brandColor : undefined 
                        }}
                    >
                        AI & Intelligence
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
                {activeTab === 'general' && (
                    <div className="space-y-6">
                        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                            <h3 className="text-lg font-semibold text-white mb-6 border-b border-slate-800 pb-2">Business Branding</h3>
                            
                            <div className="flex flex-col md:flex-row gap-8 items-start">
                                <div className="space-y-4 flex-shrink-0">
                                    <label className="block text-sm text-slate-400">Shop Logo</label>
                                    <div className="w-32 h-32 rounded-2xl bg-slate-800 border-2 border-dashed border-slate-700 flex flex-col items-center justify-center relative overflow-hidden group">
                                        {logoUrl ? (
                                            <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                                        ) : (
                                            <div className="text-slate-500 flex flex-col items-center">
                                                <Plus size={24} />
                                                <span className="text-[10px] mt-1 uppercase font-bold tracking-widest">Logo</span>
                                            </div>
                                        )}
                                        <input 
                                            type="file" 
                                            accept="image/*"
                                            onChange={handleLogoUpload}
                                            disabled={uploading}
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                        />
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                            <span className="text-white text-xs font-bold">{uploading ? 'Processing...' : 'Change Logo'}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="pt-4 border-t border-slate-800/50">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Theme Color</label>
                                            <button 
                                                onClick={() => setBrandColor('#06b6d4')}
                                                className="text-[9px] font-bold text-slate-500 hover:text-white flex items-center gap-1 transition-colors uppercase"
                                                title="Reset to Cyan"
                                            >
                                                <RotateCcw size={10} /> Reset
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-3 bg-slate-800 p-2 rounded-xl border border-slate-700">
                                            <input 
                                                type="color" 
                                                value={brandColor}
                                                onChange={(e) => setBrandColor(e.target.value)}
                                                className="w-10 h-10 rounded-lg bg-transparent border-none cursor-pointer"
                                            />
                                            <span className="text-xs font-mono text-slate-400">{brandColor.toUpperCase()}</span>
                                        </div>
                                        <p className="text-[9px] text-slate-500 italic mt-2">Will sync to all terminals.</p>
                                    </div>
                                </div>

                                <form onSubmit={handleSaveTenant} className="flex-1 space-y-6 w-full">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Auto-Shop Name</label>
                                            <input 
                                                type="text" 
                                                required
                                                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 focus:outline-none font-bold"
                                                style={{ borderBottomColor: brandColor }}
                                                value={tenantName}
                                                onChange={e => setTenantName(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone Number</label>
                                            <input 
                                                type="text" 
                                                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 focus:outline-none font-mono"
                                                value={phone}
                                                onChange={e => setPhone(e.target.value)}
                                                placeholder="+94 ..."
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Shop Address</label>
                                        <textarea 
                                            rows={2}
                                            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 focus:outline-none text-sm"
                                            value={address}
                                            onChange={e => setAddress(e.target.value)}
                                            placeholder="Enter your garage physical address..."
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Terms & Conditions (Shown on Invoice)</label>
                                        <textarea 
                                            rows={4}
                                            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 focus:outline-none text-xs leading-relaxed"
                                            value={terms}
                                            onChange={e => setTerms(e.target.value)}
                                            placeholder="1. Warranty details... 2. Payment terms..."
                                        />
                                    </div>

                                    <button 
                                        type="submit" 
                                        className="px-8 py-3 text-white rounded-xl font-bold shadow-lg transition-all flex items-center gap-2 active:scale-95"
                                        style={{ backgroundColor: brandColor }}
                                    >
                                        <Save size={18} /> Save Shop Profile
                                    </button>
                                </form>
                            </div>
                        </div>

                        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                             <div className="flex items-center gap-2 text-brand mb-4">
                                <Shield size={16} />
                                <span className="text-xs font-bold uppercase tracking-wider">Operational Config</span>
                             </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                                    <label className="text-[10px] text-slate-500 uppercase font-bold mb-2 block">Default Labor Rate (LKR / hr)</label>
                                    <div className="flex items-center gap-3">
                                        <input 
                                            type="number"
                                            className="bg-transparent text-white font-mono text-xl focus:outline-none w-full"
                                            value={defaultLaborRate}
                                            onChange={e => setDefaultLaborRate(e.target.value)}
                                        />
                                        <button 
                                            onClick={handleSaveTenant}
                                            className="text-[10px] bg-brand/10 text-brand px-3 py-1 rounded-lg hover:bg-brand/20 transition-all font-bold"
                                        >
                                            UPDATE
                                        </button>
                                    </div>
                                </div>
                                <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800 opacity-50">
                                    <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Tax Configuration</div>
                                    <div className="text-white font-mono">0.00 % (Flat Rate)</div>
                                </div>
                             </div>
                        </div>
                    </div>
                )}

                {activeTab === 'users' && isAdmin && (
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-6 border-b border-slate-800">
                            <div>
                                <h3 className="text-lg font-semibold text-white">Staff Management</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] text-slate-500 uppercase font-black">Workshop ID:</span>
                                    <code className="text-[10px] bg-slate-950 px-2 py-0.5 rounded font-mono border border-slate-800" style={{ color: brandColor }}>{profile?.tenant_id}</code>
                                    <button 
                                        onClick={() => {
                                            if (profile?.tenant_id) {
                                                navigator.clipboard.writeText(profile.tenant_id);
                                                alert("Workshop ID copied to clipboard!");
                                            }
                                        }}
                                        className="p-1 hover:bg-slate-800 rounded transition-colors text-slate-500"
                                        title="Copy Workshop ID"
                                    >
                                        <span className="text-[9px] font-bold">COPY</span>
                                    </button>
                                </div>
                            </div>
                            <button 
                                onClick={() => alert(`HOW TO ADD STAFF:\n\n1. Copy your Workshop ID above.\n2. Ask your staff to visit the Register page.\n3. They should enter '0000' (or any dummy) if they see manual fields, but generally admins add from here (Internal invite coming soon).`)} 
                                className="text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95"
                                style={{ backgroundColor: brandColor }}
                            >
                                <Plus size={14} /> HOW TO ADD STAFF
                            </button>
                        </div>
                        
                        <div className="grid gap-3">
                            {users.map(user => (
                                <div key={user.id} className="bg-slate-800/40 border border-slate-700/50 p-4 rounded-xl flex items-center justify-between group">
                                    {editingUserId === user.id ? (
                                        <div className="flex-1 flex gap-3 items-center">
                                            <input 
                                                value={editForm.full_name} 
                                                onChange={e => setEditForm({...editForm, full_name: e.target.value})}
                                                className="bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm flex-1 focus:outline-none"
                                            />
                                            <select 
                                                value={editForm.role}
                                                onChange={e => setEditForm({...editForm, role: e.target.value as any})}
                                                className="bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm focus:outline-none"
                                            >
                                                <option value="technician">Technician</option>
                                                <option value="manager">Manager</option>
                                                <option value="admin">Admin</option>
                                                <option value="accountant">Accountant</option>
                                            </select>
                                            <button onClick={() => saveEditUser(user.id)} className="p-2 text-green-400 hover:bg-green-500/10 rounded-lg transition-colors"><Check size={18}/></button>
                                            <button onClick={cancelEditUser} className="p-2 text-slate-400 hover:bg-slate-700 rounded-lg transition-colors"><X size={18}/></button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold uppercase border border-slate-600">
                                                    {user.full_name?.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-white text-sm">{user.full_name}</div>
                                                    <div className="text-[10px] text-slate-500 flex items-center gap-1 uppercase tracking-widest font-black">
                                                        {user.role === 'admin' && <Shield size={10} style={{ color: brandColor }} />}
                                                        {user.role}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => startEditUser(user)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"><Edit2 size={16}/></button>
                                                <button onClick={() => deleteUser(user.id, user.full_name)} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"><Trash2 size={16}/></button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                 {activeTab === 'ai' && isAdmin && (
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 max-w-2xl">
                        <div className="flex items-center gap-4 mb-8">
                             <div className="w-16 h-16 rounded-2xl bg-brand-soft border border-brand/20 flex items-center justify-center">
                                 <Shield size={32} className="text-brand" />
                             </div>
                             <div>
                                 <h3 className="text-xl font-bold text-white leading-none mb-2">Neural Intelligence Engine</h3>
                                 <p className="text-sm text-slate-400">Power vehicle scanning and automated diagnostics.</p>
                             </div>
                        </div>

                        <div className="space-y-6">
                            <div className="p-6 bg-slate-950/50 rounded-2xl border border-slate-800">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">OpenRouter API Key</label>
                                <div className="flex gap-3">
                                    <input 
                                        type="password"
                                        placeholder="sk-or-v1-..."
                                        className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white font-mono focus:outline-none focus:border-brand"
                                        value={aiApiKey}
                                        onChange={(e) => setAiApiKey(e.target.value)}
                                    />
                                    <button 
                                        onClick={handleSaveAiKey}
                                        disabled={aiLoading}
                                        className="btn-brand px-6 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95 flex items-center gap-2"
                                    >
                                        <Save size={18} /> {aiLoading ? 'Saving...' : 'Apply Key'}
                                    </button>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-4 leading-relaxed italic">
                                    We use <strong>OpenRouter</strong> to provide high-performance vision models like Gemini 2.0. 
                                    Get your key at <a href="https://openrouter.ai" target="_blank" className="text-brand underline">openrouter.ai</a>.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
                                    <div className="text-[10px] font-black text-brand uppercase tracking-widest mb-1 italic">Active Model</div>
                                    <div className="text-white font-bold text-sm">Gemini 2.0 Flash</div>
                                    <div className="text-[9px] text-slate-500 mt-1 uppercase">Optimized for Speed</div>
                                </div>
                                <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
                                    <div className="text-[10px] font-black text-brand uppercase tracking-widest mb-1 italic">Backup Model</div>
                                    <div className="text-white font-bold text-sm">Gemini 2.0 Pro</div>
                                    <div className="text-[9px] text-slate-500 mt-1 uppercase">High Detail Vision</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
