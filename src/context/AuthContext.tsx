import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
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
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    profile: null,
    loading: true,
    error: null,
    signOut: async () => {},
    refreshProfile: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isInactiveSignout, setIsInactiveSignout] = useState(false);
    
    // Refs for tracking activity and timeouts
    const lastActiveRef = useRef<number>(Date.now());
    const timeoutRef = useRef<any>(null);
    const profileIdRef = useRef<string | null>(null);

    // ⚡️ SPEED HACK 1 REMOVED: No more relying on localStorage for initial loading state.
    // We trust Supabase's async check completely to avoid "flash of unauthenticated content".

    // ⚡️ SPEED HACK 2: Optimistic Sign Out (Kept as it is safe)
    const signOut = useCallback(async () => {
        try {
            setSession(null);
            setUser(null);
            setProfile(null);
            setLoading(false);
            window.localStorage.clear(); 
            await supabase.auth.signOut(); 
        } catch (err) {
            console.error('[SignOut Error]', err);
        }
    }, []);

    // 🛡️ CRITICAL: Simplified Profile Fetching
    const fetchProfile = useCallback(async (userId: string, retryCount = 0) => {
        if (!userId) return;

        if (profileIdRef.current === userId) {
            setLoading(false);
            return;
        }

        let isRetrying = false;
        try {
            console.log(`[Auth] Fetching profile for ${userId}... (Attempt ${retryCount + 1})`);
            const { data, error: fetchError } = await supabase
                .from('profiles')
                .select(`
                    *,
                    tenants (
                        id,
                        name,
                        brand_color,
                        logo_url,
                        address,
                        phone,
                        terms_and_conditions,
                        default_labor_rate
                    )
                `)
                .eq('id', userId)
                .single();
            
            if (fetchError) {
                console.error("[Auth] Profile Sync Error:", fetchError);
                
                // Retry mechanism for race conditions during signup
                if (retryCount < 3 && (fetchError.code === 'PGRST116' || fetchError.message?.includes('recursion'))) {
                    console.log(`[Auth] Retrying profile fetch in 2s (Attempt ${retryCount + 1}/3)...`);
                    isRetrying = true;
                    setTimeout(() => fetchProfile(userId, retryCount + 1), 2000);
                    return;
                }

                // Check for specific recursion error
                if (fetchError.message?.includes('recursion')) {
                    setError("Database Policy Error: Infinite Recursion detected. Please contact support.");
                } else if (fetchError.code === 'PGRST116') {
                    // PGRST116 means the profile row doesn't exist. 
                    // This is critical - we can't let the user in without a profile.
                    setError("Profile Not Found: Your user account is missing its profile data.");
                } else {
                    setError(`Sync Failed: ${fetchError.message}`);
                }
            }

            if (data) {
                console.log('[Auth] Profile cached.');
                profileIdRef.current = userId;
                setProfile(data as any);
                setError(null);
            }
        } catch (e: any) {
            console.error("[Auth] Fetch exception:", e);
            setError(e.message);
        } finally {
            if (!isRetrying) {
                setLoading(false);
            }
        }
    }, []);

    // 🔄 RESTORED: Full Inactivity Detection Logic
    // This tracks mouse movements and clicks to keep the session alive
    useEffect(() => {
        if (!session) return;

        const MAX_INACTIVE_TIME = 1000 * 60 * 60 * 18; // 18 Hours
        
        const checkInactivity = setInterval(async () => {
            const now = Date.now();
            const lastActive = parseInt(localStorage.getItem('lastActivity') || String(lastActiveRef.current));
            
            if (now - lastActive > MAX_INACTIVE_TIME) {
                console.warn('[Auth] Inactivity limit reached. Signing out.');
                localStorage.removeItem('lastActivity');
                setIsInactiveSignout(true);
                await signOut();
            }
        }, 1000 * 60); // Check every minute

        const handleActivity = () => {
            const now = Date.now();
            lastActiveRef.current = now;
            // Throttle storage writes to avoid performance hit
            if (Math.random() > 0.9) {
                localStorage.setItem('lastActivity', String(now));
            }
        };

        // Restored all event listeners from original code
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
    }, [session, signOut]);

    // 🔄 RESTORED: Loading Watchdog
    // Prevents the app from getting stuck on "Loading..." forever
    useEffect(() => {
        if (loading) {
            const watchdog = setTimeout(() => {
                if (loading && !error) {
                    console.warn('[Auth] Loading state stuck for >30s. Releasing.');
                    setLoading(false); 
                }
            }, 30000); // 30 seconds timeout to handle cold starts
            return () => clearTimeout(watchdog);
        }
    }, [loading, error]);

    // 🔄 Unified Auth Initialization
    useEffect(() => {
        let mounted = true;

        const init = async () => {
            if (!isConfigured) {
                if (mounted) setLoading(false);
                return;
            }

            try {
                // 1. Get initial session
                const { data: { session: initialSession }, error: initError } = await supabase.auth.getSession();
                
                if (initError) throw initError;

                if (mounted) {
                    setSession(initialSession);
                    setUser(initialSession?.user ?? null);
                }

                if (initialSession?.user) {
                     await fetchProfile(initialSession.user.id);
                } else {
                    if (mounted) setLoading(false);
                }
            } catch (err: any) {
                console.error('[Auth Init Error]', err);
                if (mounted) {
                    const msg = err.message || 'Unknown error';
                    if (msg.includes('infinite recursion') || msg.includes('sync')) {
                         setError("Connection glitch. Retrying..."); // Less scary
                    } else {
                         setError(`Connection issue: ${msg}`);
                    }
                    setLoading(false);
                }
            }
        };

        init();

        // 2. Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
            if (!mounted) return;
            
            console.log(`[Auth] Change Event: ${event}`);

            if (event === 'SIGNED_OUT') {
                setSession(null);
                setUser(null);
                setProfile(null);
                setLoading(false);
                localStorage.removeItem('lastActivity');
            } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                setSession(currentSession);
                setUser(currentSession?.user ?? null);
                if (currentSession?.user) {
                     lastActiveRef.current = Date.now();
                     localStorage.setItem('lastActivity', String(Date.now()));
                     // Let fetchProfile handle the deduplication internally via ref to avoid React effect bouncing
                     await fetchProfile(currentSession.user.id);
                } else {
                    setLoading(false);
                }
            } else if (event === 'INITIAL_SESSION') {
                // Handled above by getSession, but good to have fallback
            }
        });

        // Visibility Watchdog
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible') {
                const now = Date.now();
                const hiddenDuration = now - lastActiveRef.current; // Use ref instead of local var to be safe
                
                if (hiddenDuration > 1000 * 60 * 60 * 18) { // 18 hours
                    console.log('[Auth] App inactive for > 18 hours. Signing out.');
                    setIsInactiveSignout(true);
                    signOut();
                } else if (hiddenDuration > 1000 * 60 * 5) { // 5 mins
                    console.log('[Auth] App back in focus, verifying session passively.');
                    try {
                        // Do not forcefully sign out on error here, because network might still be waking up.
                        // supabase-js will dispatch SIGNED_OUT event automatically if the session is truly invalid/expired.
                        await supabase.auth.getSession();
                    } catch (e) {
                        console.warn('[Auth] Passive session check failed, likely network asleep.', e);
                    }
                }
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            mounted = false;
            subscription.unsubscribe();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [signOut, fetchProfile]);

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

    const refreshProfile = useCallback(async () => {
        if (user) {
            console.log('[Auth] Refreshing profile...');
             const { data, error } = await supabase
                .from('profiles')
                .select(`
                    *,
                    tenants (
                        id,
                        name,
                        brand_color,
                        logo_url,
                        address,
                        phone,
                        terms_and_conditions,
                        default_labor_rate
                    )
                `)
                .eq('id', user.id)
                .single();
            
            if (error) console.error('[Auth] Error refreshing profile:', error);
            if (data) setProfile(data as any);
        }
    }, [user]);

    return (
        <AuthContext.Provider value={{ session, user, profile, loading, error, signOut, refreshProfile }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);