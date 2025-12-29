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
            // Don't show error for no session, just stop loading
            if (err.message === 'No session found') {
                setLoading(false);
                return;
            }
            setError(err.message || "Failed to connect to authentication service.");
            setLoading(false);
        }
    };

    // Inactivity Detection (FIXED)
    useEffect(() => {
        // 1. CRITICAL: Only run inactivity check if user is logged in
        if (!session) return;

        const MAX_INACTIVE_TIME = 1000 * 60 * 60 * 12; // 12 Hours (Increased from 60min)
        
        const checkInactivity = setInterval(async () => {
            const now = Date.now();
            const lastActive = parseInt(localStorage.getItem('lastActivity') || String(lastActiveRef.current));
            
            if (now - lastActive > MAX_INACTIVE_TIME) {
                console.warn('[Auth] Inactivity limit reached. Signing out.');
                
                // 2. Clear storage first to prevent loop on reload
                localStorage.removeItem('lastActivity');
                
                setIsInactiveSignout(true);
                await signOut();
                // 3. Optional: Reload to clear memory, but only after signout
                window.location.reload();
            }
        }, 1000 * 60); // Check every minute

        const handleActivity = () => {
            const now = Date.now();
            lastActiveRef.current = now;
            // Throttle local storage writes
            if (Math.random() > 0.9) {
                localStorage.setItem('lastActivity', String(now));
            }
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

    // Loading Watchdog (FIXED: Increased time)
    useEffect(() => {
        if (loading) {
            const watchdog = setTimeout(() => {
                if (loading && !error) {
                    console.warn('[Auth] Loading state stuck for >30s. Releasing.');
                    // Don't show error, just let user try to interact
                    setLoading(false); 
                }
            }, 30000); // 30 Seconds (Increased from 12s)
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
                localStorage.removeItem('lastActivity');
            } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                setSession(session);
                setUser(session?.user ?? null);
                if (session?.user) {
                     // Reset inactivity timer on login
                     lastActiveRef.current = Date.now();
                     localStorage.setItem('lastActivity', String(Date.now()));
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
                
                // If backgrounded for > 30 mins, refresh session
                if (hiddenDuration > 1000 * 60 * 30) {
                    console.log('[Auth] App backgrounded for too long. Re-syncing.');
                    initializeAuth();
                    return;
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
        // Don't set loading true here if we already have session, to prevent UI flash
        // setLoading(true); 
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
                
                if (fetchError.code === 'PGRST116') {
                    // Profile doesn't exist yet (Registration flow) - not an error
                    console.log('Profile missing, waiting for registration...');
                } else {
                   // Only show error for actual connection issues
                   console.error("Sync Error:", fetchError.message);
                }
            } else if (data) {
                console.log('[Auth] Profile verified:', data.full_name);
                setProfile(data as UserProfile);
                setError(null);
            }
        } catch (e: any) {
            console.error('[fetchProfile error]', e);
        } finally {
            setLoading(false);
        }
    };

    const signOut = async () => {
        try {
            setLoading(true);
            await supabase.auth.signOut();
            // Clear all state
            setProfile(null);
            setSession(null);
            setUser(null);
            setError(null);
            localStorage.clear(); // Clear all local storage to be safe
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
                    <p className="text-slate-400 mb-6 text-sm">You were signed out due to inactivity.</p>
                    <button 
                        onClick={() => {
                            setIsInactiveSignout(false);
                            window.location.reload();
                        }}
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