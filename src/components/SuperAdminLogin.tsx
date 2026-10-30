import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, AlertCircle, User, ShieldCheck, ArrowRight, RefreshCw } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const SuperAdminLogin: React.FC = () => {
    const navigate = useNavigate();
    const { profile, isSuperAdmin, loading: authLoading } = useAuth();
    const [loading, setLoading] = useState(false);
    const [loginInput, setLoginInput] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);

    // If already logged in as super admin, redirect directly
    useEffect(() => {
        if (!authLoading && profile && isSuperAdmin) {
            navigate('/super-admin', { replace: true });
        }
    }, [authLoading, profile, isSuperAdmin, navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        let isTimedOut = false;
        const timeoutId = setTimeout(() => {
            isTimedOut = true;
            setError("Authentication timed out. Database might be waking up. Please try again.");
            setLoading(false);
        }, 15000);

        try {
            let emailToUse = loginInput.trim();

            // 1. Resolve username if not an email
            if (!emailToUse.includes('@')) {
                console.log('[SuperAdminLogin] Resolving username:', emailToUse);
                const { data: resolvedEmail, error: rpcError } = await supabase.rpc('get_email_by_username', {
                    input_username: emailToUse
                });

                if (isTimedOut) return;

                if (rpcError || !resolvedEmail) {
                    setError("Username not recognized. Please verify your credentials.");
                    setLoading(false);
                    clearTimeout(timeoutId);
                    return;
                }
                emailToUse = resolvedEmail;
            }

            if (isTimedOut) return;

            // 2. Sign in with Supabase
            const { data: authData, error: loginError } = await supabase.auth.signInWithPassword({
                email: emailToUse,
                password,
            });

            if (isTimedOut) return;

            if (loginError) {
                if (loginError.message === 'Invalid login credentials') {
                    setError("Invalid password or credentials. Please try again.");
                } else {
                    setError(loginError.message);
                }
                setLoading(false);
                clearTimeout(timeoutId);
                return;
            }

            if (!authData.session) {
                setError("Login failed. No session created.");
                setLoading(false);
                clearTimeout(timeoutId);
                return;
            }

            // 3. Verify that this user is indeed a Super Admin
            const { data: prof, error: profError } = await supabase
                .from('profiles')
                .select('id, is_super_admin, role, full_name')
                .eq('id', authData.session.user.id)
                .maybeSingle();

            if (profError || !prof) {
                await supabase.auth.signOut();
                setError("Could not verify administrative privileges. Profile missing.");
                setLoading(false);
                clearTimeout(timeoutId);
                return;
            }

            if (!prof.is_super_admin && prof.role !== 'super_admin') {
                // Not authorized for Super Admin portal
                await supabase.auth.signOut();
                setError("Access Denied: This account is not authorized as a Platform Super Admin. Please use the standard workshop login.");
                setLoading(false);
                clearTimeout(timeoutId);
                return;
            }

            // Success -> Direct straight to Super Admin Dashboard
            console.log('[SuperAdminLogin] Super Admin verified. Redirecting to /super-admin');
            navigate('/super-admin', { replace: true });

        } catch (err: any) {
            if (!isTimedOut) {
                console.error('[SuperAdminLogin] Catch error:', err);
                setError("A connection error occurred. Please try again.");
            }
        } finally {
            clearTimeout(timeoutId);
            if (!isTimedOut) setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col justify-between p-4 selection:bg-cyan-500 selection:text-slate-950 relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="pt-8 text-center relative z-10">
                {/* Logo & Platform Tag */}
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold mb-4">
                    <ShieldCheck size={14} className="text-cyan-400" />
                    <span>AutoPulse Platform Console</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                    <span>AUTO</span><span className="text-cyan-400">PULSE</span>
                </h1>
                <p className="text-slate-400 text-xs mt-1 font-mono tracking-wider uppercase">
                    Platform Master Access
                </p>
            </div>

            <div className="w-full max-w-md mx-auto my-auto relative z-10">
                <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-7 sm:p-8 shadow-2xl backdrop-blur-xl">
                    <div className="mb-6">
                        <h2 className="text-xl font-bold text-white tracking-tight">Super Admin Login</h2>
                        <p className="text-xs text-slate-400 mt-1">
                            Sign in with your master administrator credentials to access platform controls.
                        </p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-3.5 rounded-xl text-xs flex items-start gap-2.5 animate-fade-in leading-relaxed">
                                <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                                Master Username or Email
                            </label>
                            <div className="relative">
                                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    value={loginInput}
                                    onChange={(e) => setLoginInput(e.target.value)}
                                    placeholder="nilan or superadmin@domain.com"
                                    className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                                Master Password
                            </label>
                            <div className="relative">
                                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••••••"
                                    className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-cyan-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                        >
                            {loading ? (
                                <>
                                    <RefreshCw size={15} className="animate-spin" />
                                    <span>Verifying Master Credentials...</span>
                                </>
                            ) : (
                                <>
                                    <span>Access Super Admin Portal</span>
                                    <ArrowRight size={15} />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
                        <Link 
                            to="/login"
                            className="text-xs text-slate-400 hover:text-cyan-400 transition-colors inline-flex items-center gap-1.5 font-medium"
                        >
                            <span>Return to Workshop Staff Login</span>
                            <ArrowRight size={13} />
                        </Link>
                    </div>
                </div>
            </div>

            <div className="pb-4 text-center text-[11px] text-slate-600 relative z-10 font-mono">
                AutoPulse OS • Super Admin Portal
            </div>
        </div>
    );
};

export default SuperAdminLogin;
