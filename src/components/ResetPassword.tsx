import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const ResetPassword = () => {
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error: resetError } = await supabase.auth.updateUser({
                password: password
            });

            if (resetError) throw resetError;
            setSuccess(true);
            setTimeout(() => navigate('/login'), 3000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-black text-white mb-2 tracking-tight">
                        <span className="text-cyan-400">AUTO</span>PULSE
                    </h1>
                    <p className="text-slate-400 font-medium">Set New Password</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl shadow-black/50">
                    {success ? (
                        <div className="text-center space-y-4 animate-fade-in">
                            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-500">
                                <CheckCircle size={32} />
                            </div>
                            <h2 className="text-xl font-bold text-white">Password Updated!</h2>
                            <p className="text-slate-400 text-sm">
                                Your password has been successfully reset. Redirecting you to login...
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleReset} className="space-y-6">
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-3 rounded-lg flex items-center gap-2 text-sm">
                                    <AlertCircle size={16} />
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-widest">New Password</label>
                                <div className="relative">
                                    <Lock size={16} className="absolute left-3 top-3.5 text-slate-500" />
                                    <input 
                                        required 
                                        type={showPassword ? 'text' : 'password'}
                                        className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-3 pl-10 pr-10 focus:border-cyan-500 focus:outline-none transition-all" 
                                        value={password} 
                                        onChange={e => setPassword(e.target.value)} 
                                        placeholder="••••••••" 
                                        minLength={6}
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-3.5 text-slate-500 hover:text-white transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-2 italic px-1">At least 6 characters required.</p>
                            </div>

                            <button 
                                type="submit" 
                                disabled={loading} 
                                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50 active:scale-95"
                            >
                                {loading ? 'UPDATING...' : 'UPDATE PASSWORD'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};
