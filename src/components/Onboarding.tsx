import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Building2, ArrowRight, LogOut } from 'lucide-react';

export const Onboarding = () => {
    const { user, signOut } = useAuth();
    const [shopName, setShopName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleCreateShop = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setLoading(true);
        setError(null);

        try {
            if (!shopName.trim()) throw new Error("Please enter a shop name.");

            // 1. Create Tenant
            const { data: tenant, error: tenantError } = await supabase
                .from('tenants')
                .insert({ name: shopName })
                .select()
                .single();

            if (tenantError) throw tenantError;

            // 2. Link Profile to Tenant
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ 
                    tenant_id: tenant.id,
                    role: 'admin',
                    full_name: user.user_metadata.full_name || 'Admin', 
                    // Ensure username is unique if possible, or let trigger handle it? 
                    // For now, simpler is better. We assume profile exists from trigger or previous partial signup.
                })
                .eq('id', user.id);

            if (profileError) throw profileError;

            // 3. Force reload to refresh AuthContext
            window.location.href = '/'; 

        } catch (err: any) {
            console.error("Onboarding Error:", err);
            setError(err.message || "Failed to create workshop.");
            setLoading(false);
        }
    };

    if (!user) return null; // Should be handled by AuthGuard really

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-black text-white mb-2 tracking-tight">
                        <span className="text-cyan-400">AUTO</span>PULSE
                    </h1>
                    <p className="text-slate-400 font-medium text-lg">Finalize your setup</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
                    <div className="flex items-center gap-4 mb-6 bg-cyan-500/10 p-4 rounded-xl border border-cyan-500/20">
                        <div className="bg-cyan-500 rounded-full p-2 text-slate-900">
                            <Building2 size={24} />
                        </div>
                        <div>
                            <h3 className="text-white font-bold">Create Workspace</h3>
                            <p className="text-cyan-200 text-xs">Your data needs a home.</p>
                        </div>
                    </div>

                    <form onSubmit={handleCreateShop} className="space-y-6">
                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-200 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                Workshop / Garage Name
                            </label>
                            <input 
                                autoFocus
                                type="text" 
                                required
                                value={shopName}
                                onChange={(e) => setShopName(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-4 focus:border-cyan-500 focus:outline-none text-lg placeholder-slate-600 transition-colors"
                                placeholder="e.g. Nilan's Auto"
                            />
                        </div>

                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 text-sm tracking-widest uppercase disabled:opacity-50 disabled:cursor-wait"
                        >
                            {loading ? 'Setting up...' : 'Start using AutoPulse'}
                            {!loading && <ArrowRight size={18} />}
                        </button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-slate-800 text-center">
                        <p className="text-slate-500 text-xs mb-3">Signed in as {user.email}</p>
                        <button 
                            onClick={() => signOut()}
                            className="text-slate-400 hover:text-white text-xs flex items-center justify-center gap-1 mx-auto transition-colors"
                        >
                            <LogOut size={12} />
                            Log Out
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
