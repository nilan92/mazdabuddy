import { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

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
        // Init
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if(session?.user) fetchProfile(session.user.id);
            else setLoading(false);
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

    return (
        <AuthContext.Provider value={{ session, user, profile, loading, signOut }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
