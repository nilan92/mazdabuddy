import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, PenTool as Tool, Package, FileText, Settings, LogOut, Scan, Users, DollarSign } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user, profile } = useAuth();
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const role = profile?.role || 'technician';

  const allLinks = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin', 'manager', 'technician', 'accountant'] },
    { to: '/scan', icon: Scan, label: 'Smart Scan', roles: ['admin', 'manager', 'technician'] },
    { to: '/jobs', icon: Tool, label: 'Jobs Board', roles: ['admin', 'manager', 'technician'] },
    { to: '/customers', icon: Users, label: 'Customers', roles: ['admin', 'manager', 'accountant'] },
    { to: '/inventory', icon: Package, label: 'Inventory', roles: ['admin', 'manager'] },
    { to: '/invoices', icon: FileText, label: 'Invoices', roles: ['admin', 'manager', 'accountant'] },
    { to: '/expenses', icon: DollarSign, label: 'My Expenses', roles: ['admin', 'technician', 'manager', 'accountant'] },
    { to: '/settings', icon: Settings, label: 'Settings', roles: ['admin', 'manager'] },
  ];

  const allowedLinks = allLinks.filter(link => link.roles.includes(role));

  // Mobile: Show first 4 + More button
  const mobileLinks = allowedLinks.slice(0, 4);
  const hiddenLinks = allowedLinks.slice(4);

  const handleSignOut = async () => {
      await signOut();
      navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      {/* Sidebar - Hidden on mobile */}
      <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-900 border-r border-slate-800 hidden md:flex flex-col z-20">
        <div className="p-6">
          <h1 className="text-2xl font-black tracking-tight text-white mb-1">
            <span className="text-cyan-400">MAZDA</span>BUDDY
          </h1>
          <div className="text-xs text-slate-500 font-mono flex flex-col">
              <span>{profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0]}</span>
              <span className="uppercase text-cyan-600 font-bold">{role}</span>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          {allowedLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive 
                    ? 'bg-cyan-500/10 text-cyan-400 font-semibold shadow-[0_0_20px_rgba(6,182,212,0.15)] border border-cyan-500/20' 
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                }`}
              >
                <Icon size={20} className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={handleSignOut}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors group"
          >
            <LogOut size={20} className="group-hover:translate-x-1 transition-transform" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-slate-900 border-t border-slate-800 z-50 px-6 py-3 flex justify-between items-center safe-area-pb shadow-2xl">
        {mobileLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.to;
            return (
                <Link 
                    key={link.to} 
                    to={link.to} 
                    className={`flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-cyan-400' : 'text-slate-500'}`}
                >
                    <Icon size={22} />
                    <span className="text-[10px] font-medium">{link.label}</span>
                </Link>
            )
        })}
        {/* More Button */}
        <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={`flex flex-col items-center gap-1 transition-colors ${isMobileMenuOpen ? 'text-cyan-400' : 'text-slate-500'}`}
        >
            <div className="flex gap-0.5 mt-2 mb-1">
                <div className="w-1 h-1 rounded-full bg-current"></div>
                <div className="w-1 h-1 rounded-full bg-current"></div>
                <div className="w-1 h-1 rounded-full bg-current"></div>
            </div>
            <span className="text-[10px] font-medium">More</span>
        </button>
      </nav>

      {/* Mobile Menu Drawer */}
      {isMobileMenuOpen && (
          <div className="md:hidden fixed bottom-20 right-4 w-64 bg-slate-800 border border-slate-700 rounded-2xl shadow-xl z-50 p-2 animate-fade-in-up">
              {hiddenLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = location.pathname === link.to;
                  return (
                      <Link 
                        key={link.to} 
                        to={link.to} 
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-1 ${isActive ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-300 hover:bg-slate-700'}`}
                      >
                          <Icon size={20} />
                          <span className="font-medium">{link.label}</span>
                      </Link>
                  )
              })}
              <div className="h-px bg-slate-700 my-1" />
              <button 
                onClick={handleSignOut} 
                className="flex items-center gap-3 px-4 py-3 rounded-xl w-full text-slate-400 hover:text-red-400 hover:bg-red-500/10"
              >
                  <LogOut size={20} />
                  <span className="font-medium">Sign Out</span>
              </button>
          </div>
      )}
      
      {/* Overlay to close menu */}
      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />}

      {/* Main Content */}
      <main className="flex-1 ml-0 md:ml-64 p-4 md:p-8 pb-24 md:pb-8 relative overflow-hidden">
         {/* Background Gradients */}
         <div className="absolute top-0 left-0 w-full h-96 bg-cyan-500/5 rounded-full blur-[120px] -translate-y-1/2 pointer-events-none" />
         <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/5 rounded-full blur-[120px] translate-y-1/2 pointer-events-none" />
         
         <div className="relative z-10 animate-fade-in">
            {children}
         </div>
      </main>
    </div>
  );
};
