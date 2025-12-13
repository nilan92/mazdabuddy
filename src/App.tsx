
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
import { Expenses } from './components/Expenses.tsx';

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
    const { session, loading } = useAuth();
    
    if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-cyan-500">Loading Access...</div>;
    
    if (!session) return <Navigate to="/login" replace />;

    return <>{children}</>;
};

function App() {
  return (
    <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
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
                    <Route path="/expenses" element={<Expenses />} />
                    </Routes>
                </Layout>
              </AuthGuard>
          } />
        </Routes>
    </Router>
  );
}

export default App;
