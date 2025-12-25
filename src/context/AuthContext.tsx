import { createContext, useContext, useEffect, useState, useRef } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isConfigured } from '../lib/supabase';
import { AlertCircle, RefreshCw } from 'lucide-react';
import type { UserProfile } from '../types';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    profile: UserProfile | null;
    loading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    profile: null,
    loading: true,
    signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const timeoutRef = useRef<any>(null);

    const initializeAuth = async () => {
        if (!isConfigured) {
            setLoading(false);
            return;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
            if (loading) {
                console.warn('[Auth] Initialization timed out. Forcing finish.');
                setLoading(false);
                setError("Connection took too long. Using fallback connection path...");
            }
        }, 10000); // 10 second safety

        try {
            const { data: { session: initialSession }, error: initError } = await supabase.auth.getSession();
            
            if (initError) throw initError;

            setSession(initialSession);
            setUser(initialSession?.user ?? null);

            if (initialSession?.user) {
                await fetchProfile(initialSession.user.id);
            } else {
                setLoading(false);
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                console.error('[Auth Init Error]', err);
                setError(err.message || "Failed to connect to authentication service.");
            }
            setLoading(false);
        } finally {
            clearTimeout(timeoutId);
        }
    };

    useEffect(() => {
        initializeAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                await fetchProfile(session.user.id);
            } else {
                setProfile(null);
                setLoading(false);
            }
        });

        return () => {
            subscription.unsubscribe();
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    const fetchProfile = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                // @ts-ignore
                .select('*, tenants(*)')
                .eq('id', userId)
                .single();
            
            if (error || !data) {
                console.log('[Auth] Profile not found, using fallback.');
                // Fallback for missing profile
                const fallbackProfile: UserProfile = { 
                    id: userId, 
                    full_name: 'Staff Member', 
                    role: 'admin', 
                    tenant_id: '00000000-0000-0000-0000-000000000000',
                    tenants: {
                        id: '00000000-0000-0000-0000-000000000000',
                        name: 'AutoPulse Central',
                        created_at: new Date().toISOString()
                    }
                };
                setProfile(fallbackProfile);
            } else {
                setProfile(data as UserProfile);
            }
        } catch (e: any) {
            console.error('[fetchProfile error]', e);
        } finally {
            setLoading(false);
        }
    };

    const signOut = async () => {
        try {
            await supabase.auth.signOut();
            setProfile(null);
            setSession(null);
            setUser(null);
        } catch (err) {
            console.error('[SignOut Error]', err);
            // Force local clear if Supabase fails
            setProfile(null);
            setSession(null);
            setUser(null);
        }
    };

    if (!isConfigured) {
        return (
             <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
                <div className="bg-red-500/10 border border-red-500/50 p-6 rounded-2xl max-w-md text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">Configuration Missing</h2>
                    <p className="text-slate-400 mb-4 font-medium leading-relaxed">
                        The application could not connect to the database. Check your environment variables.
                    </p>
                    <div className="text-left bg-slate-950 p-4 rounded-xl text-xs font-mono text-slate-500 border border-slate-800">
                        Required: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
                    </div>
                </div>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden">
                {/* Background Glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 blur-[120px] rounded-full"></div>
                
                <div className="relative flex flex-col items-center">
                    {error ? (
                        <div className="text-center animate-fade-in px-4">
                            <div className="w-16 h-16 bg-red-500/10 border border-red-500/50 rounded-2xl flex items-center justify-center text-red-500 mb-6 mx-auto">
                                <AlertCircle size={32} />
                            </div>
                            <h2 className="text-white font-bold text-xl mb-2">Connection Issue</h2>
                            <p className="text-slate-400 text-sm mb-6 max-w-xs">{error}</p>
                            <button 
                                onClick={() => {
                                    setError(null);
                                    setLoading(true);
                                    initializeAuth();
                                }}
                                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold transition-all border border-slate-700 active:scale-95"
                            >
                                Retry Connection
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="w-16 h-16 relative mb-8">
                                <div className="absolute inset-0 border-4 border-cyan-500/20 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-t-cyan-500 rounded-full animate-spin"></div>
                            </div>
                            
                            <div className="text-center">
                                <h2 className="text-white font-black text-2xl tracking-tighter mb-2 italic">MAZDABUDDY<span className="text-cyan-500 underline decoration-cyan-500/30">OS</span></h2>
                                <div className="flex items-center justify-center gap-2">
                                    <RefreshCw size={14} className="text-cyan-400 animate-[spin_3s_linear_infinite]" />
                                    <p className="text-cyan-500 font-mono text-xs uppercase tracking-[0.3em] font-bold">Synchronizing...</p>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="absolute bottom-12 text-[10px] text-slate-600 font-mono uppercase tracking-widest">
                    Initializing secure environment v2.4.0
                </div>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{ session, user, profile, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
