import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, AlertCircle, ArrowLeft, Send, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/#/reset-password`,
            });

            if (resetError) throw resetError;
            setSuccess(true);
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
                    <p className="text-slate-400 font-medium">Reset Your Password</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl shadow-black/50">
                    <div className="mb-6">
                        <Link to="/login" className="text-slate-500 hover:text-white flex items-center gap-2 text-sm">
                            <ArrowLeft size={14}/> Back to Login
                        </Link>
                    </div>

                    {success ? (
                        <div className="text-center space-y-4 animate-fade-in">
                            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-500">
                                <CheckCircle size={32} />
                            </div>
                            <h2 className="text-xl font-bold text-white">Check your email</h2>
                            <p className="text-slate-400 text-sm">
                                We've sent a password reset link to <strong className="text-slate-200">{email}</strong>. 
                                Please check your inbox and follow the instructions.
                            </p>
                            <Link to="/login" className="block w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-all">
                                Return to Login
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleReset} className="space-y-6">
                            <p className="text-sm text-slate-400 leading-relaxed">
                                Enter the email address associated with your account and we'll send you a link to reset your password.
                            </p>

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-3 rounded-lg flex items-center gap-2 text-sm">
                                    <AlertCircle size={16} />
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-widest">Email Address</label>
                                <div className="relative">
                                    <Mail size={16} className="absolute left-3 top-3.5 text-slate-500" />
                                    <input 
                                        required 
                                        type="email" 
                                        className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-3 pl-10 focus:border-cyan-500 focus:outline-none transition-all" 
                                        value={email} 
                                        onChange={e => setEmail(e.target.value)} 
                                        placeholder="your@email.com" 
                                    />
                                </div>
                            </div>

                            <button 
                                type="submit" 
                                disabled={loading} 
                                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
                            >
                                {loading ? 'SENDING...' : (
                                    <>
                                        <Send size={18} /> SEND RESET LINK
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};
