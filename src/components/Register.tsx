import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, Mail, User, AlertCircle, ArrowLeft, Building2, Eye, EyeOff } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

export const Register = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        fullName: '',
        username: '',
        shopName: new URLSearchParams(window.location.hash.split('?')[1]).get('workshop_name') || '',
        inviteToken: new URLSearchParams(window.location.hash.split('?')[1]).get('invite') || '',
    });
    const isInvite = !!formData.inviteToken;
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (!isInvite && !formData.shopName) throw new Error("Please enter your Shop Name.");
            if (formData.password !== formData.confirmPassword) throw new Error("Passwords do not match.");

            // 1. Sign Up User
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        full_name: formData.fullName,
                    },
                    emailRedirectTo: window.location.origin + import.meta.env.BASE_URL
                }
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error("Connection error during signup.");

            const userId = authData.user.id;

            // Membership is assigned server-side. The browser used to write its
            // own tenant_id, which meant anyone holding a workshop id could join
            // one; that write is now rejected outright.
            const { error: joinError } = isInvite
                ? await supabase.rpc('redeem_invite', { p_token: formData.inviteToken })
                : await supabase.rpc('create_workshop', { p_name: formData.shopName.trim() });

            if (joinError) throw joinError;

            // Display details are not part of joining, and failing here must not
            // undo a successful join.
            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    full_name: formData.fullName,
                    username: formData.username.toLowerCase()
                })
                .eq('id', userId);

            if (profileError) console.warn('Could not save name/username:', profileError.message);

            alert(isInvite ? "Joined Workshop! Please sign in." : "Workshop Registered! Welcome to AutoPulse. Please sign in.");
            navigate('/login');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleRegister = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + import.meta.env.BASE_URL + '#/',
                queryParams: { prompt: 'select_account' },
            }
        });
        if (error) setError(error.message);
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                     <h1 className="text-4xl font-black text-white mb-2 tracking-tight">
                        <span className="text-cyan-400">AUTO</span>PULSE
                    </h1>
                    <p className="text-slate-400 font-medium tracking-wide">Start your journey.</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl shadow-black/50">
                    <div className="mb-6 flex justify-between items-center">
                        <Link to="/login" className="text-slate-500 hover:text-white flex items-center gap-2 text-sm"><ArrowLeft size={14}/> Back to Login</Link>
                        <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase tracking-widest ${isInvite ? 'bg-emerald-500/10 text-emerald-500' : 'bg-cyan-500/10 text-cyan-500'}`}>
                            {isInvite ? 'Staff Invite' : 'Administrator'}
                        </span>
                    </div>

                    <button 
                        type="button"
                        onClick={handleGoogleRegister}
                        className="w-full bg-white hover:bg-slate-100 text-slate-900 font-bold py-3.5 rounded-xl transition-all shadow-xl flex items-center justify-center gap-3 active:scale-95 mb-6"
                    >
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" className="w-5 h-5" />
                        SIGN UP WITH GOOGLE
                    </button>

                    <div className="relative mb-6">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
                        <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-[0.2em]"><span className="bg-slate-900 px-3 text-slate-500">OR WITH EMAIL</span></div>
                    </div>

                    <form onSubmit={handleRegister} className="space-y-4">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-3 rounded-lg flex items-center gap-2 text-sm">
                                <AlertCircle size={16} />
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                {isInvite ? 'Joining Workshop' : 'Workshop / Garage Name'}
                            </label>
                            {isInvite ? (
                                // The invitee cannot read the workshop's name before
                                // joining — RLS hides it — so don't show an empty box.
                                <div className="flex items-center gap-2 text-sm text-slate-300 bg-slate-950 border border-slate-700 rounded-lg p-2.5">
                                    <Building2 size={16} className="text-cyan-400 flex-shrink-0" />
                                    You've been invited to join an existing workshop.
                                </div>
                            ) : (
                            <div className="relative">
                                <Building2 size={16} className="absolute left-3 top-3 text-slate-500" />
                                <input 
                                    required 
                                    type="text" 
                                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg p-2.5 pl-10 focus:border-cyan-500 focus:outline-none" 
                                    value={formData.shopName} 
                                    onChange={e => setFormData({...formData, shopName: e.target.value})} 
                                    placeholder="Elite Auto Care" 
                                />
                            </div>
                            )}
                        </div>
                        
                        <div className="pt-2 border-t border-slate-800 my-4"></div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Owner Name</label>
                                <div className="relative">
                                    <User size={16} className="absolute left-3 top-3 text-slate-500" />
                                    <input required type="text" className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg p-2.5 pl-10 focus:border-cyan-500 focus:outline-none" 
                                        value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} placeholder="John Doe" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Username</label>
                                <div className="relative">
                                    <User size={16} className="absolute left-3 top-3 text-slate-500 opacity-50" />
                                    <input required type="text" className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg p-2.5 pl-10 focus:border-cyan-500 focus:outline-none" 
                                        value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} placeholder="johndoe123" />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                            <div className="relative">
                                <Mail size={16} className="absolute left-3 top-3 text-slate-500" />
                                <input required type="email" className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg p-2.5 pl-10 focus:border-cyan-500 focus:outline-none" 
                                    value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="john@example.com" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password</label>
                            <div className="relative">
                                <Lock size={16} className="absolute left-3 top-3 text-slate-500" />
                                <input required type={showPassword ? "text" : "password"} className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg p-2.5 pl-10 pr-10 focus:border-cyan-500 focus:outline-none" 
                                    value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="••••••••" minLength={6} />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-slate-500 hover:text-white">
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Confirm Password</label>
                            <div className="relative">
                                <Lock size={16} className="absolute left-3 top-3 text-slate-500" />
                                <input required type={showConfirmPassword ? "text" : "password"} className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg p-2.5 pl-10 pr-10 focus:border-cyan-500 focus:outline-none" 
                                    value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} placeholder="Re-enter password" minLength={6} />
                                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-2.5 text-slate-500 hover:text-white">
                                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <button type="submit" disabled={loading} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50 mt-4 active:scale-95 uppercase tracking-widest">
                            {loading ? 'Processing...' : 'Initialize Portal'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};
