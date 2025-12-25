import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, PenTool as Tool, Package, FileText, Settings, LogOut, Scan, Users, DollarSign, PieChart, HelpCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { HelpModal } from './HelpModal';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isHelpOpen, setIsHelpOpen] = React.useState(false);

  const role = profile?.role || 'technician';

  const allLinks = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin', 'manager', 'technician', 'accountant'] },
    { to: '/scan', icon: Scan, label: 'Smart Scan', roles: ['admin', 'manager', 'technician'] },
    { to: '/jobs', icon: Tool, label: 'Jobs Board', roles: ['admin', 'manager', 'technician'] },
    { to: '/customers', icon: Users, label: 'Customers', roles: ['admin', 'manager', 'accountant'] },
    { to: '/inventory', icon: Package, label: 'Inventory', roles: ['admin', 'manager'] },
    { to: '/invoices', icon: FileText, label: 'Invoices', roles: ['admin', 'manager', 'accountant'] },
    { to: '/finances', icon: PieChart, label: 'Finances', roles: ['admin', 'manager', 'accountant'] },
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

  const brandPrimary = profile?.tenants?.brand_color || '#06b6d4';

  // Helper to generate a super dark version of the hex color
  const getSuperDark = (hex: string) => {
    // Basic hex to rgb to darkness conversion
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    
    // Create a very dark version (10% of original brightness)
    const factor = 0.05;
    return `rgb(${Math.floor(r * factor)}, ${Math.floor(g * factor)}, ${Math.floor(b * factor)})`;
  };

  const brandBg = getSuperDark(brandPrimary);

  // Apply Brand Color & Handle Auto-Refresh
  React.useEffect(() => {
      // 1. Set global CSS variables
      document.documentElement.style.setProperty('--brand-primary', brandPrimary);
      document.documentElement.style.setProperty('--brand-bg', brandBg);
      
      // 2. Refresh logic for PWA/Long sessions
      let lastActive = Date.now();
      const handleVisibility = () => {
          if (document.visibilityState === 'visible') {
              const now = Date.now();
              const diff = (now - lastActive) / 1000 / 60; // minutes
              
              if (diff > 30) {
                  window.location.reload();
              }
          } else {
              lastActive = Date.now();
          }
      };

      window.addEventListener('visibilitychange', handleVisibility);
      window.addEventListener('focus', handleVisibility);
      
      return () => {
          window.removeEventListener('visibilitychange', handleVisibility);
          window.removeEventListener('focus', handleVisibility);
      };
  }, [brandPrimary, brandBg]);

  return (
    <div className="flex min-h-screen text-slate-100 selection:bg-[var(--brand-primary)]" style={{ backgroundColor: 'var(--brand-bg)' }}>
      <style>{`
        :root {
          --brand-primary: ${brandPrimary};
          --brand-bg: ${brandBg};
          --brand-soft: color-mix(in srgb, var(--brand-primary) 15%, transparent);
          --brand-border: color-mix(in srgb, var(--brand-primary) 20%, transparent);
        }
        body { background-color: var(--brand-bg) !important; }
        .text-brand { color: var(--brand-primary) !important; }
        .bg-brand { background-color: var(--brand-primary) !important; }
        .bg-brand-soft { background-color: var(--brand-soft) !important; }
        .border-brand { border-color: var(--brand-primary) !important; }
        .border-brand-soft { border-color: var(--brand-border) !important; }
        
        .hover-brand:hover { background-color: var(--brand-primary) !important; color: white !important; }
        .bg-slate-950 { background-color: var(--brand-bg) !important; }
        .bg-slate-900 { background-color: rgba(255,255,255,0.02) !important; backdrop-filter: blur(20px); }
        
        /* Global Brand Overrides */
        .btn-brand { background-color: var(--brand-primary) !important; color: white !important; transition: all 0.2s; }
        .btn-brand:hover { filter: brightness(1.1); transform: translateY(-1px); }
        .btn-brand:active { transform: scale(0.95); }
        
        .active-link { 
            background-color: var(--brand-soft); 
            color: var(--brand-primary);
            border-color: var(--brand-border);
            box-shadow: 0 0 20px var(--brand-soft);
        }
      `}</style>
      {/* Sidebar - Hidden on mobile */}
      <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-900 border-r border-slate-800 hidden md:flex flex-col z-20">
        <div className="p-6 border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-sm">
          <div className="flex items-center gap-4 mb-5">
            {profile?.tenants?.logo_url ? (
              <div className="h-12 w-12 rounded-xl bg-white/5 p-1 flex items-center justify-center border border-white/10 overflow-hidden shadow-inner">
                 <img src={profile.tenants.logo_url} alt="Logo" className="h-full w-full object-contain" />
              </div>
            ) : (
              <div 
                className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-black text-white text-xl shadow-lg border border-white/10"
                style={{ background: `linear-gradient(135deg, ${brandPrimary}, ${brandPrimary}CC)` }}
              >
                {profile?.tenants?.name?.charAt(0) || 'A'}
              </div>
            )}
            <div className="min-w-0">
               <h1 className="text-sm font-black tracking-tight text-white uppercase truncate leading-tight">
                 {profile?.tenants?.name || 'AutoPulse OS'}
               </h1>
               <p className="text-[10px] text-slate-500 font-mono tracking-tighter truncate mt-0.5">WORKSHOP PORTAL</p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 border border-slate-700/50">
                  <Users size={16} />
              </div>
              <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-200 truncate leading-none mb-1">
                      {profile?.full_name?.split(' ')[0]}
                  </p>
                  <p className="uppercase font-black text-[9px] tracking-widest leading-none" style={{ color: brandPrimary }}>
                      {role}
                  </p>
              </div>
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
                    ? 'active-link font-semibold border' 
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                }`}
              >
                <Icon size={20} className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-2">
          <button 
            onClick={() => setIsHelpOpen(true)}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors group"
          >
            <HelpCircle size={20} className="group-hover:scale-110 transition-transform" />
            <span>System Guide</span>
          </button>
          
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
                onClick={() => {
                    setIsHelpOpen(true);
                    setIsMobileMenuOpen(false);
                }} 
                className="flex items-center gap-3 px-4 py-3 rounded-xl w-full text-slate-300 hover:bg-slate-700"
              >
                  <HelpCircle size={20} />
                  <span className="font-medium">System Guide</span>
              </button>
              <button 
                onClick={handleSignOut} 
                className="flex items-center gap-3 px-4 py-3 rounded-xl w-full text-slate-400 hover:text-red-400 hover:bg-red-500/10"
              >
                  <LogOut size={20} />
                  <span className="font-medium">Sign Out</span>
              </button>
          </div>
      )}
      
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      
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
