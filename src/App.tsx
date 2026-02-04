import { useEffect, Suspense, lazy } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Layout } from './components/Layout';
import { useAuth } from './context/AuthContext';

// 1. LAZY IMPORTS
const Dashboard = lazy(() => import('./components/Dashboard').then(module => ({ default: module.Dashboard })));
const Jobs = lazy(() => import('./components/Jobs').then(module => ({ default: module.Jobs })));
const Inventory = lazy(() => import('./components/Inventory').then(module => ({ default: module.Inventory })));
const Invoices = lazy(() => import('./components/Invoices').then(module => ({ default: module.Invoices })));
const SmartScan = lazy(() => import('./components/SmartScan').then(module => ({ default: module.SmartScan })));
const Customers = lazy(() => import('./components/Customers').then(module => ({ default: module.Customers })));
const Settings = lazy(() => import('./components/Settings').then(module => ({ default: module.Settings })));
const Finances = lazy(() => import('./components/Finances').then(module => ({ default: module.Finances })));
const Login = lazy(() => import('./components/Login').then(module => ({ default: module.Login })));
const Register = lazy(() => import('./components/Register').then(module => ({ default: module.Register })));
const ForgotPassword = lazy(() => import('./components/ForgotPassword').then(module => ({ default: module.ForgotPassword })));
const ResetPassword = lazy(() => import('./components/ResetPassword').then(module => ({ default: module.ResetPassword })));

// Reusable Loading Screen
const LoadingScreen = ({ message = "Loading Module..." }: { message?: string }) => (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <h1 className="text-4xl font-black tracking-tighter animate-pulse italic">
            <span className="text-white">AUTO</span><span className="text-cyan-400">PULSE</span>
        </h1>
        <p className="text-cyan-500 font-mono text-[10px] tracking-[0.4em] uppercase">{message}</p>
        <div className="w-48 h-1 bg-slate-900 rounded-full overflow-hidden mt-4">
            <div className="w-full h-full bg-cyan-500 rounded-full animate-[loading_1.5s_infinite_linear]" style={{
                animationName: 'loading',
                animationIterationCount: 'infinite',
                animationTimingFunction: 'linear'
            }} />
        </div>
        <style>{`
            @keyframes loading {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(200%); }
            }
        `}</style>
    </div>
);

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
    const { session, profile, loading, error, signOut } = useAuth();
    
    // 1. If we are busy checking authentication, show the loading screen.
    // We do NOT use localStorage checks anymore to avoid race conditions.
    if (loading) return <LoadingScreen message="Security Checkpoint" />;
    
    // 2. If loading is done and no session is found, redirect to login.
    if (!session) return <Navigate to="/login" replace />;

    // 4. If session exists but profile failed to load (Network error or Bug)
    if (!loading && (!profile || error)) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
                 <div className="max-w-md w-full bg-slate-900 border border-red-500/20 rounded-3xl p-8 text-center shadow-2xl">
                    <div className="w-20 h-20 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 mb-6 mx-auto border border-red-500/20">
                        <AlertCircle size={40} />
                    </div>
                    <h2 className="text-2xl font-black text-white mb-4 tracking-tight uppercase">Identity Sync Failed</h2>
                    <p className="text-slate-400 mb-6 text-sm leading-relaxed">
                        We authenticated your credentials, but could not synchronize your workshop profile.
                    </p>
                    
                    {(error || !profile) && (
                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 mb-8 text-left">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Technical Details</p>
                            <p className="text-xs font-mono text-red-400 break-words">
                                {error || "Workshop profile synchronization timeout."}
                            </p>
                        </div>
                    )}

                    <div className="space-y-3">
                        <button 
                            onClick={() => window.location.reload()}
                            className="w-full py-3.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-cyan-500/20 active:scale-95 flex items-center justify-center gap-2"
                        >
                            <RefreshCw size={18} /> RETRY CONNECTION
                        </button>
                        <button 
                            onClick={() => {
                                // Optimistic Sign Out Logic can go here
                                localStorage.clear(); // Force clear local storage
                                signOut();
                            }}
                            className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-all border border-slate-700 active:scale-95"
                        >
                            SIGN OUT & SWITCH ACCOUNT
                        </button>
                    </div>
                 </div>
            </div>
        );
    }

    return <>{children}</>;
};

const App = () => {
  useEffect(() => {
    const checkVersion = async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}version.json?t=${new Date().getTime()}`, { cache: 'no-store' });
        if (!response.ok) return;
        
        const data = await response.json();
        const serverVersion = data.version;
        const localVersion = localStorage.getItem('app_version');

        if (localVersion && localVersion !== serverVersion) {
            console.log(`New version found: ${serverVersion} (Current: ${localVersion})`);
            if (confirm("A new update is available. Refresh now to get the latest features?")) {
                localStorage.setItem('app_version', serverVersion);
                window.location.reload();
            }
        } else {
            localStorage.setItem('app_version', serverVersion);
        }
      } catch (error) {
        console.warn("Failed to check version:", error);
      }
    };
    
    checkVersion();
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkVersion();
    });
  }, []);

  return (
    <Router>
        <Suspense fallback={<LoadingScreen message="Loading Interface..." />}>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                
                <Route path="/*" element={
                    <AuthGuard>
                        <Layout>
                            <Routes>
                                <Route path="/" element={<Dashboard />} />
                                <Route path="/jobs" element={<Jobs />} />
                                <Route path="/inventory" element={<Inventory />} />
                                <Route path="/invoices" element={<Invoices />} />
                                <Route path="/scan" element={<SmartScan />} />
                                <Route path="/customers" element={<Customers />} />
                                <Route path="/settings" element={<Settings />} />
                                <Route path="/finances" element={<Finances />} />
                            </Routes>
                        </Layout>
                    </AuthGuard>
                } />
            </Routes>
        </Suspense>
    </Router>
  );
}

export default App;