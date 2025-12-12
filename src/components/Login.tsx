import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, Mail, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Login = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setError(error.message);
        } else {
            navigate('/');
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-black text-white mb-2 whitespace-nowrap tracking-tight">
                        <span className="text-cyan-400">MAZDA</span>BUDDY
                    </h1>
                    <p className="text-slate-400">Staff Portal Access</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl shadow-black/50">
                    <form onSubmit={handleLogin} className="space-y-6">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-3 rounded-lg flex items-center gap-2 text-sm">
                                <AlertCircle size={16} />
                                {error}
                            </div>
                        )}
                        
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Email Address</label>
                            <div className="relative">
                                <div className="absolute left-3 top-3 text-slate-500">
                                    <Mail size={18} />
                                </div>
                                <input 
                                    type="email" 
                                    required
                                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg p-2.5 pl-10 focus:border-cyan-500 focus:outline-none"
                                    placeholder="technician@mazdabuddy.com"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Password</label>
                            <div className="relative">
                                <div className="absolute left-3 top-3 text-slate-500">
                                    <Lock size={18} />
                                </div>
                                <input 
                                    type="password" 
                                    required
                                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg p-2.5 pl-10 focus:border-cyan-500 focus:outline-none"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-bold py-3 rounded-lg shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Authenticating...' : 'Sign In'}
                        </button>
                    </form>
                </div>
                
                <p className="text-center text-slate-600 text-sm mt-8">
                    Authorized Personnel Only. <br/> Integrated with Supabase Auth.
                </p>
            </div>
        </div>
    );
};
