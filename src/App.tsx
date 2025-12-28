import { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Jobs } from './components/Jobs';
import { Inventory } from './components/Inventory';
import { Invoices } from './components/Invoices';
import { SmartScan } from './components/SmartScan';
import { Customers } from './components/Customers';
import { Settings } from './components/Settings';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { useAuth } from './context/AuthContext';

import { Finances } from './components/Finances';
import { ForgotPassword } from './components/ForgotPassword';
import { ResetPassword } from './components/ResetPassword';

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
    const { session, profile, loading, error, signOut } = useAuth();
    
    if (loading) return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
            <h1 className="text-4xl font-black tracking-tighter animate-pulse italic">
                <span className="text-white">AUTO</span><span className="text-cyan-400">PULSE</span>
            </h1>
            <p className="text-cyan-500 font-mono text-[10px] tracking-[0.4em] uppercase">Security Checkpoint</p>
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
    
    if (!session) return <Navigate to="/login" replace />;

    // STRICT CHECK: If session exists but profile fetch failed/timed out OR an error occurred
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
                            onClick={() => signOut()}
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
            // New version found
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
    
    // Check on mount and on visibility change
    checkVersion();
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkVersion();
    });
  }, []);

  return (
    <Router>
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
    </Router>
  );
}

export default App;
