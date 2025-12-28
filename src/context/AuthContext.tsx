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
    error: string | null;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    profile: null,
    loading: true,
    error: null,
    signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isInactiveSignout, setIsInactiveSignout] = useState(false);
    const timeoutRef = useRef<any>(null);
    const lastActiveRef = useRef<number>(Date.now());

    const initializeAuth = async () => {
        if (!isConfigured) {
            setLoading(false);
            return;
        }

        setError(null);
        setLoading(true);

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
            console.error('[Auth Init Error]', err);
            setError(err.message || "Failed to connect to authentication service.");
            setLoading(false);
        }
    };

    // Inactivity Detection
    useEffect(() => {
        if (!session) return;

        const MAX_INACTIVE_TIME = 1000 * 60 * 60; // 60 minutes
        const checkInactivity = setInterval(() => {
            const now = Date.now();
            if (now - lastActiveRef.current > MAX_INACTIVE_TIME) {
                console.warn('[Auth] Inactivity limit reached. Signing out.');
                setIsInactiveSignout(true);
                signOut();
            }
        }, 1000 * 60); // Check every minute

        const handleActivity = () => {
            lastActiveRef.current = Date.now();
        };

        window.addEventListener('mousemove', handleActivity);
        window.addEventListener('keydown', handleActivity);
        window.addEventListener('mousedown', handleActivity);
        window.addEventListener('scroll', handleActivity);

        return () => {
            clearInterval(checkInactivity);
            window.removeEventListener('mousemove', handleActivity);
            window.removeEventListener('keydown', handleActivity);
            window.removeEventListener('mousedown', handleActivity);
            window.removeEventListener('scroll', handleActivity);
        };
    }, [session]);

    // Loading Watchdog - released ONLY on errors or success
    useEffect(() => {
        if (loading) {
            const watchdog = setTimeout(() => {
                if (loading && !error) {
                    console.warn('[Auth] Loading state stuck for >12s. Releasing with error.');
                    setError("Connection timed out. Please check your internet.");
                    setLoading(false);
                }
            }, 12000);
            return () => clearTimeout(watchdog);
        }
    }, [loading, error]);

    useEffect(() => {
        initializeAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log(`[Auth] State change: ${event}`);
            
            if (event === 'SIGNED_OUT') {
                setSession(null);
                setUser(null);
                setProfile(null);
                setLoading(false);
                setError(null);
            } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                setSession(session);
                setUser(session?.user ?? null);
                if (session?.user) {
                     await fetchProfile(session.user.id);
                } else {
                    setLoading(false);
                }
            }
        });

        // Visibility Watchdog
        let lastVisibleTime = Date.now();
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible') {
                const now = Date.now();
                const hiddenDuration = now - lastVisibleTime;
                
                if (hiddenDuration > 1000 * 60 * 30) {
                    console.log('[Auth] App backgrounded for too long. Re-syncing.');
                    initializeAuth();
                    return;
                }

                const { data: { session: currentSession } } = await supabase.auth.getSession();
                if (currentSession) {
                    setSession(currentSession);
                    setUser(currentSession.user);
                    await fetchProfile(currentSession.user.id);
                }
            } else {
                lastVisibleTime = Date.now();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            subscription.unsubscribe();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    const fetchProfile = async (userId: string) => {
        setLoading(true);
        setError(null);
        try {
            console.log('[Auth] Fetching profile for user:', userId);
            const { data, error: fetchError } = await supabase
                .from('profiles')
                // @ts-ignore
                .select('*, tenants(*)')
                .eq('id', userId)
                .single();
            
            if (fetchError) {
                console.error('[Auth] Profile fetch failed:', fetchError.message);
                
                // Special handling for common errors
                if (fetchError.code === 'PGRST116') {
                    setError("Profile record not found. Please contact your administrator.");
                } else if (fetchError.message?.includes('recursion')) {
                    setError("Database Security Error: Recursive policy detected. Please alert support.");
                } else {
                    setError(`Sync Error: ${fetchError.message}`);
                }
            } else if (!data) {
                setError("Profile synchronization was successful but returned no data.");
            } else {
                console.log('[Auth] Profile verified:', data.full_name);
                setProfile(data as UserProfile);
                setError(null);
            }
        } catch (e: any) {
            console.error('[fetchProfile error]', e);
            setError(`Critical Sync Error: ${e.message || 'Unknown network error'}`);
        } finally {
            setLoading(false);
        }
    };

    const signOut = async () => {
        try {
            setLoading(true);
            await supabase.auth.signOut();
            setProfile(null);
            setSession(null);
            setUser(null);
            setError(null);
        } catch (err) {
            console.error('[SignOut Error]', err);
        } finally {
            setLoading(false);
        }
    };

    if (isInactiveSignout) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl max-w-sm text-center shadow-2xl">
                    <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 mb-6 mx-auto border border-amber-500/20">
                        <RefreshCw size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Session Expired</h2>
                    <p className="text-slate-400 mb-6 text-sm">You were signed out due to inactivity for security reasons.</p>
                    <button 
                        onClick={() => setIsInactiveSignout(false)}
                        className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold transition-all active:scale-95"
                    >
                        Return to Login
                    </button>
                </div>
            </div>
        );
    }

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
                                <h2 className="text-white font-black text-2xl tracking-tighter mb-2 italic">AUTO<span className="text-cyan-500">PULSE</span><span className="text-cyan-500 underline decoration-cyan-500/30 ml-1">OS</span></h2>
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
        <AuthContext.Provider value={{ session, user, profile, loading, error, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
