import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, Mail, User, AlertCircle, ArrowLeft } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

export const Register = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        fullName: '',
        username: ''
    });
    const [error, setError] = useState<string | null>(null);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // 1. Check if username is taken (optional but good UX)
        // We'll trust the database constraint for now to keep it simple or check via rpc if we had one.
        // Actually, let's just proceed.

        const { data, error: authError } = await supabase.auth.signUp({
            email: formData.email,
            password: formData.password,
            options: {
                data: {
                    full_name: formData.fullName,
                    // We can't set 'username' in profile here directly because the trigger uses raw_user_meta_data
                    // So we pass it in metadata
                    username: formData.username
                }
            }
        });

        if (authError) {
            setError(authError.message);
            setLoading(false);
            return;
        }

        if (data.user) {
            // The trigger in fix_profiles_sync.sql needs to be updated to handle username
            // OR we can manually update the profile now since we are logged in (usually)
            
            // Let's manually ensure profile is updated with username just in case trigger only did full_name
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ username: formData.username })
                .eq('id', data.user.id);

            if (profileError) {
                console.error("Profile update error", profileError);
                // Non-blocking, can continue
            }

            alert("Registration successful! Please sign in.");
            navigate('/login');
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl shadow-black/50">
                    <div className="mb-6">
                        <Link to="/login" className="text-slate-500 hover:text-white flex items-center gap-2 text-sm"><ArrowLeft size={14}/> Back to Login</Link>
                    </div>
                    <h2 className="text-2xl font-black text-white mb-6">Create Account</h2>

                    <form onSubmit={handleRegister} className="space-y-4">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-3 rounded-lg flex items-center gap-2 text-sm">
                                <AlertCircle size={16} />
                                {error}
                            </div>
                        )}
                        
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                            <div className="relative">
                                <User size={16} className="absolute left-3 top-3 text-slate-500" />
                                <input required type="text" className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg p-2.5 pl-10 focus:border-cyan-500 focus:outline-none" 
                                    value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} placeholder="John Doe" />
                            </div>
                        </div>

                         <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Username</label>
                            <div className="relative">
                                <div className="absolute left-3 top-3 text-slate-500 font-bold">@</div>
                                <input required type="text" className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg p-2.5 pl-10 focus:border-cyan-500 focus:outline-none" 
                                    value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} placeholder="johnd" />
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
                                <input required type="password" className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg p-2.5 pl-10 focus:border-cyan-500 focus:outline-none" 
                                    value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="••••••••" minLength={6} />
                            </div>
                        </div>

                        <button type="submit" disabled={loading} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-lg shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50 mt-4">
                            {loading ? 'Creating Account...' : 'Sign Up'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};
