import { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isConfigured } from '../lib/supabase';
import { AlertCircle } from 'lucide-react';

interface UserProfile {
    id: string;
    full_name: string;
    role: 'admin' | 'manager' | 'technician' | 'accountant';
}

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

    useEffect(() => {
        let timeout: number;
        
        // Safety timeout: prevent infinite loading if auth hangs
        timeout = setTimeout(() => {
            console.warn('[Auth Timeout] Auth did not respond in 10s, assuming no session');
            setLoading(false);
        }, 10000);

        // Init with error handling
        supabase.auth.getSession()
            .then(({ data: { session } }) => {
                clearTimeout(timeout);
                setSession(session);
                setUser(session?.user ?? null);
                if(session?.user) fetchProfile(session.user.id);
                else setLoading(false);
            })
            .catch((error) => {
                clearTimeout(timeout);
                console.error('[Auth Init Error]', error);
                setLoading(false); // Fail gracefully
            });

        // Listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange( async (_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if(session?.user) {
                 await fetchProfile(session.user.id);
            } else {
                setProfile(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchProfile = async (userId: string) => {
        // First try to get profile
        let { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
        
        if (error || !data) {
             // If trigger failed or didn't run (e.g. existing user), create a default profile on the fly
             // This is a safety fallback for your existing test user!
             const newProfile = { id: userId, full_name: 'Staff Member', role: 'admin' }; // Giving admin for first user ease
             const { error: insertError } = await supabase.from('profiles').upsert(newProfile);
             if (!insertError) {
                 // @ts-ignore
                 setProfile(newProfile);
             }
        } else {
            setProfile(data as UserProfile);
        }
        setLoading(false);
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        setProfile(null);
    };

    if (!isConfigured) {
        return (
             <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
                <div className="bg-red-500/10 border border-red-500/50 p-6 rounded-2xl max-w-md text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">Configuration Missing</h2>
                    <p className="text-slate-400 mb-4">
                        The application could not connect to the database. This usually means the 
                        <strong> GitHub Secrets</strong> are missing for the deployment.
                    </p>
                    <div className="text-left bg-slate-900 p-3 rounded text-xs font-mono text-slate-500 overflow-auto">
                        Missing: VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY
                    </div>
                </div>
            </div>
        )
    }

    // If loading, show a global splash screen so the user doesn't see a blank white page
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500 mb-4"></div>
                <div className="text-cyan-500 font-mono text-sm animate-pulse">Initializing MazdaBuddy...</div>
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
