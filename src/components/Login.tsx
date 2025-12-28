import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, AlertCircle, User } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

export const Login = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [loginInput, setLoginInput] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        let isTimedOut = false;
        const timeoutId = setTimeout(() => {
            isTimedOut = true;
            setError("Authentication is taking longer than usual (15s+). This usually means a connection issue with the database. Please refresh or try again.");
            setLoading(false);
        }, 15000);

        try {
            let emailToUse = loginInput.trim();

            // 1. Detect if input is username (no @ symbol)
            if (!emailToUse.includes('@')) {
                console.log('[Login] Resolving username:', emailToUse);
                const { data, error: funcError } = await supabase.rpc('get_email_by_username', { input_username: emailToUse });
                
                if (isTimedOut) return;

                if (funcError) {
                    console.error('[RPC Error]', funcError);
                    setError(`Database Error: ${funcError.message}`);
                    setLoading(false);
                    clearTimeout(timeoutId);
                    return;
                }
                
                if (!data) {
                    setError("Username not found. Please check your spelling.");
                    setLoading(false);
                    clearTimeout(timeoutId);
                    return;
                }
                emailToUse = data;
                console.log('[Login] Resolved to email:', emailToUse);
            }

            if (isTimedOut) return;

            const { error: loginError } = await supabase.auth.signInWithPassword({
                email: emailToUse,
                password,
            });

            if (isTimedOut) return;

            if (loginError) {
                setError(loginError.message);
            } else {
                console.log('[Login] Success! Redirecting...');
                navigate('/');
            }
        } catch (err: any) {
            if (!isTimedOut) {
                console.error('[Login Catch]', err);
                setError("A network error prevented login. Please check your internet.");
            }
        } finally {
            clearTimeout(timeoutId);
            if (!isTimedOut) setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/#/`
            }
        });
        if (error) setError(error.message);
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-black text-white mb-2 whitespace-nowrap tracking-tight">
                        <span className="text-brand">AUTO</span>PULSE
                    </h1>
                    <p className="text-slate-400 font-medium tracking-wide">Your shop's heartbeat.</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl shadow-black/50">
                    <form onSubmit={handleLogin} className="space-y-5">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-3 rounded-lg flex items-center gap-2 text-sm">
                                <AlertCircle size={16} />
                                {error}
                            </div>
                        )}
                        
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-widest">Email or Username</label>
                            <div className="relative">
                                <div className="absolute left-3 top-3.5 text-slate-500">
                                    <User size={18} />
                                </div>
                                <input 
                                    type="text" 
                                    required
                                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-3 pl-10 focus:border-brand focus:outline-none transition-all"
                                    placeholder="username or email@example.com"
                                    value={loginInput}
                                    onChange={e => setLoginInput(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">Password</label>
                                <Link to="/forgot-password" title="Forgot Password" className="text-xs text-brand hover:filter hover:brightness-110 font-bold">FORGOT?</Link>
                            </div>
                            <div className="relative">
                                <div className="absolute left-3 top-3.5 text-slate-500">
                                    <Lock size={18} />
                                </div>
                                <input 
                                    type="password" 
                                    required
                                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-3 pl-10 focus:border-brand focus:outline-none transition-all"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={loading}
                            className="group relative w-full btn-brand font-bold py-3.5 rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 flex items-center justify-center gap-2"
                        >
                            {loading ? 'AUTHENTICATING...' : 'SIGN IN'}
                        </button>

                        <div className="relative py-2">
                             <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
                             <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-[0.2em]"><span className="bg-slate-900 px-3 text-slate-500">OR CONTINUE WITH</span></div>
                        </div>

                        <button 
                            type="button"
                            onClick={handleGoogleLogin}
                            className="w-full bg-white hover:bg-slate-100 text-slate-900 font-bold py-3.5 rounded-xl transition-all shadow-xl flex items-center justify-center gap-3 active:scale-95"
                        >
                            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" className="w-5 h-5" />
                            GOOGLE LOGIN
                        </button>

                        <div className="text-center pt-6 border-t border-slate-800">
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-2">New to AutoPulse?</p>
                            <Link to="/register" className="inline-block text-brand hover:filter hover:brightness-110 font-black text-sm tracking-tight">INITIALIZE WORKSHOP PORTAL</Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
