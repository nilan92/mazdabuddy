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
    const lastActiveRef = useRef<number>(Date.now());
    const timeoutRef = useRef<any>(null); // Restored ref

    // ⚡️ SPEED HACK 1: LocalStorage Check
    useEffect(() => {
        const hasLocalToken = Object.keys(localStorage).some(key => key.startsWith('sb-'));
        // If no token exists, we can stop loading immediately
        if (!hasLocalToken) {
            setLoading(false);
        }
    }, []);

    const initializeAuth = async () => {
        if (!isConfigured) {
            setLoading(false);
            return;
        }

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
            if (err.message === 'No session found') {
                setLoading(false);
                return;
            }
            setError(err.message || "Failed to connect to authentication service.");
            setLoading(false);
        }
    };

    // 🔄 RESTORED: Loading Watchdog (Safety Timeout)
    // If the app gets stuck loading for 30s, this forces it to stop so the user sees an error/login.
    useEffect(() => {
        if (loading) {
            const watchdog = setTimeout(() => {
                if (loading && !error) {
                    console.warn('[Auth] Loading state stuck for >30s. Releasing.');
                    setLoading(false); 
                }
            }, 30000); 
            return () => clearTimeout(watchdog);
        }
    }, [loading, error]);

    // Inactivity Detection
    useEffect(() => {
        if (!session) return;

        const MAX_INACTIVE_TIME = 1000 * 60 * 60 * 12; // 12 Hours
        
        const checkInactivity = setInterval(async () => {
            const now = Date.now();
            const lastActive = parseInt(localStorage.getItem('lastActivity') || String(lastActiveRef.current));
            
            if (now - lastActive > MAX_INACTIVE_TIME) {
                console.warn('[Auth] Inactivity limit reached. Signing out.');
                localStorage.removeItem('lastActivity');
                setIsInactiveSignout(true);
                await signOut();
            }
        }, 1000 * 60);

        const handleActivity = () => {
            const now = Date.now();
            lastActiveRef.current = now;
            if (Math.random() > 0.9) {
                localStorage.setItem('lastActivity', String(now));
            }
        };

        window.addEventListener('mousemove', handleActivity);
        window.addEventListener('keydown', handleActivity);
        window.addEventListener('click', handleActivity);

        return () => {
            clearInterval(checkInactivity);
            window.removeEventListener('mousemove', handleActivity);
            window.removeEventListener('keydown', handleActivity);
            window.removeEventListener('click', handleActivity);
        };
    }, [session]);

    useEffect(() => {
        initializeAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_OUT') {
                setSession(null);
                setUser(null);
                setProfile(null);
                setLoading(false);
                localStorage.removeItem('lastActivity');
            } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                setSession(session);
                setUser(session?.user ?? null);
                if (session?.user) {
                     lastActiveRef.current = Date.now();
                     localStorage.setItem('lastActivity', String(Date.now()));
                     await fetchProfile(session.user.id);
                } else {
                    setLoading(false);
                }
            }
        });

        // 🔄 RESTORED: Visibility Watchdog
        // Refreshes the session if the user switches tabs and comes back after 30 mins
        let lastVisibleTime = Date.now();
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible') {
                const now = Date.now();
                const hiddenDuration = now - lastVisibleTime;
                
                if (hiddenDuration > 1000 * 60 * 30) { // 30 mins
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
        try {
            const { data, error: fetchError } = await supabase
                .from('profiles')
                // @ts-ignore
                .select('*, tenants(*)')
                .eq('id', userId)
                .single();
            
            if (fetchError) {
                if (fetchError.code !== 'PGRST116') {
                   console.error("Sync Error:", fetchError.message);
                }
            } else if (data) {
                setProfile(data as UserProfile);
            }
        } catch (e: any) {
            console.error('[fetchProfile error]', e);
        } finally {
            setLoading(false);
        }
    };

    // ⚡️ SPEED HACK 2: Optimistic Sign Out
    const signOut = async () => {
        try {
            // 1. Instant UI Clear
            setSession(null);
            setUser(null);
            setProfile(null);
            setLoading(false);
            
            // 2. Instant Storage Clear
            window.localStorage.clear(); 

            // 3. Background Network Request
            supabase.auth.signOut();
        } catch (err) {
            console.error('[SignOut Error]', err);
        }
    };

    // --- RENDER LOGIC ---

    // 1. Session Expired Logic (Keep this)
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

    // 2. Config Error Logic (Keep this)
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

    // ❌ REMOVED: "if (loading) return <Spinner />"
    // We intentionally return the children even if loading is true.
    // This allows App.tsx to handle the loading UI non-blockingly.
    return (
        <AuthContext.Provider value={{ session, user, profile, loading, error, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);