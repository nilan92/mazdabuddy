import React, { useState, useEffect, useMemo } from 'react';
import { 
    ShieldCheck, 
    Building2, 
    Users, 
    Wrench, 
    Car, 
    DollarSign, 
    Search, 
    Plus, 
    RefreshCw, 
    ArrowRight, 
    Edit3, 
    Check, 
    Copy, 
    Shield, 
    CheckCircle2, 
    AlertCircle, 
    X,
    Mail,
    Phone,
    MapPin,
    Eye,
    TrendingUp,
    Sparkles,
    LogOut
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import type { SuperAdminTenant, SuperAdminMetrics, SuperAdminUser } from '../types';

export const SuperAdminDashboard: React.FC = () => {
    const { profile, isSuperAdmin, switchTenantContext, resetTenantContext, isImpersonating, signOut } = useAuth();
    const navigate = useNavigate();

    // Data states
    const [tenants, setTenants] = useState<SuperAdminTenant[]>([]);
    const [metrics, setMetrics] = useState<SuperAdminMetrics | null>(null);
    const [users, setUsers] = useState<SuperAdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Active tab
    const [activeTab, setActiveTab] = useState<'tenants' | 'users' | 'overview'>('tenants');

    // Tenant search & filter
    const [tenantSearch, setTenantSearch] = useState('');
    const [tenantSort, setTenantSort] = useState<'recent' | 'jobs' | 'revenue' | 'name'>('recent');

    // User search & filter
    const [userSearch, setUserSearch] = useState('');
    const [userRoleFilter, setUserRoleFilter] = useState<string>('all');

    // Modals
    const [editingTenant, setEditingTenant] = useState<SuperAdminTenant | null>(null);
    const [isCreateTenantOpen, setIsCreateTenantOpen] = useState(false);
    const [inspectTenant, setInspectTenant] = useState<SuperAdminTenant | null>(null);

    // Form state for edit/create
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        address: '',
        currency: 'LKR',
        brand_color: '#06b6d4',
        default_labor_rate: 2500,
        booking_enabled: true,
    });
    const [savingTenant, setSavingTenant] = useState(false);
    const [switchingTenantId, setSwitchingTenantId] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3500);
    };

    const handleCopyId = (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        navigator.clipboard.writeText(id);
        setCopiedId(id);
        showToast('Workshop ID copied to clipboard');
        setTimeout(() => setCopiedId(null), 2000);
    };

    // Load Super Admin Data
    const loadSuperAdminData = async (isBackground = false) => {
        if (!isBackground) setLoading(true);
        else setRefreshing(true);
        setError(null);

        try {
            // 1. Fetch Metrics
            const { data: metricsData, error: metricsError } = await supabase.rpc('get_super_admin_metrics');
            if (metricsError) {
                console.error('[SuperAdmin] Metrics fetch error:', metricsError);
                throw metricsError;
            }
            if (metricsData) {
                setMetrics(metricsData as SuperAdminMetrics);
            }

            // 2. Fetch Tenants
            const { data: tenantsData, error: tenantsError } = await supabase.rpc('get_super_admin_tenants');
            if (tenantsError) {
                console.error('[SuperAdmin] Tenants fetch error:', tenantsError);
                throw tenantsError;
            }
            if (tenantsData) {
                setTenants(tenantsData as SuperAdminTenant[]);
            }

            // 3. Fetch Users
            const { data: usersData, error: usersError } = await supabase.rpc('get_super_admin_users');
            if (usersError) {
                console.warn('[SuperAdmin] Users fetch error:', usersError);
            } else if (usersData) {
                setUsers(usersData as SuperAdminUser[]);
            }
        } catch (err: any) {
            console.error('[SuperAdmin] Failed to load data:', err);
            setError(err.message || 'Failed to load Super Admin data.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (isSuperAdmin) {
            loadSuperAdminData();
        }
    }, [isSuperAdmin]);

    // Handle Enter Workshop (Impersonate / Context Switch)
    const handleEnterWorkshop = async (tenant: SuperAdminTenant) => {
        try {
            setSwitchingTenantId(tenant.id);
            const success = await switchTenantContext(tenant.id);
            if (success) {
                showToast(`Switched context to ${tenant.name}`);
                navigate('/jobs');
            } else {
                showToast(`Failed to switch to ${tenant.name}`);
            }
        } catch (err: any) {
            console.error('Error switching context:', err);
            showToast(`Error: ${err.message}`);
        } finally {
            setSwitchingTenantId(null);
        }
    };

    // Open Edit Modal
    const handleOpenEdit = (tenant: SuperAdminTenant, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setEditingTenant(tenant);
        setFormData({
            name: tenant.name || '',
            phone: tenant.phone || '',
            email: tenant.email || '',
            address: tenant.address || '',
            currency: tenant.currency || 'LKR',
            brand_color: tenant.brand_color || '#06b6d4',
            default_labor_rate: Number(tenant.default_labor_rate) || 2500,
            booking_enabled: tenant.booking_enabled ?? true,
        });
    };

    // Open Create Modal
    const handleOpenCreate = () => {
        setEditingTenant(null);
        setFormData({
            name: '',
            phone: '',
            email: '',
            address: '',
            currency: 'LKR',
            brand_color: '#06b6d4',
            default_labor_rate: 2500,
            booking_enabled: true,
        });
        setIsCreateTenantOpen(true);
    };

    // Save Tenant (Create or Update)
    const handleSaveTenant = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            showToast('Workshop name is required');
            return;
        }

        setSavingTenant(true);
        try {
            const { error: saveError } = await supabase.rpc('super_admin_save_tenant', {
                p_id: editingTenant?.id || null,
                p_name: formData.name.trim(),
                p_phone: formData.phone.trim() || null,
                p_email: formData.email.trim() || null,
                p_address: formData.address.trim() || null,
                p_currency: formData.currency,
                p_brand_color: formData.brand_color,
                p_default_labor_rate: Number(formData.default_labor_rate) || 2500,
                p_booking_enabled: formData.booking_enabled,
            });

            if (saveError) throw saveError;

            showToast(editingTenant ? 'Workshop details updated successfully!' : 'New workshop created successfully!');
            setEditingTenant(null);
            setIsCreateTenantOpen(false);
            await loadSuperAdminData(true);
        } catch (err: any) {
            console.error('Failed to save tenant:', err);
            showToast(`Save failed: ${err.message}`);
        } finally {
            setSavingTenant(false);
        }
    };

    // Toggle User Super Admin Status
    const handleToggleSuperAdmin = async (targetUser: SuperAdminUser) => {
        const nextStatus = !targetUser.is_super_admin;
        try {
            const { error: updateErr } = await supabase.rpc('super_admin_update_user', {
                target_user_id: targetUser.id,
                new_is_super_admin: nextStatus,
            });
            if (updateErr) throw updateErr;

            setUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, is_super_admin: nextStatus } : u));
            showToast(`${targetUser.full_name || targetUser.email} ${nextStatus ? 'promoted to Super Admin' : 'removed from Super Admin'}`);
        } catch (err: any) {
            console.error('Failed to toggle super admin:', err);
            showToast(`Update failed: ${err.message}`);
        }
    };

    // Filtered & Sorted Tenants
    const filteredTenants = useMemo(() => {
        let result = tenants.filter(t => {
            if (!tenantSearch.trim()) return true;
            const q = tenantSearch.toLowerCase();
            return (
                t.name.toLowerCase().includes(q) ||
                (t.phone && t.phone.toLowerCase().includes(q)) ||
                (t.email && t.email.toLowerCase().includes(q)) ||
                (t.address && t.address.toLowerCase().includes(q)) ||
                t.id.toLowerCase().includes(q)
            );
        });

        if (tenantSort === 'jobs') {
            result.sort((a, b) => Number(b.jobs_count) - Number(a.jobs_count));
        } else if (tenantSort === 'revenue') {
            result.sort((a, b) => Number(b.total_invoiced) - Number(a.total_invoiced));
        } else if (tenantSort === 'name') {
            result.sort((a, b) => a.name.localeCompare(b.name));
        } else {
            // recent
            result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        }

        return result;
    }, [tenants, tenantSearch, tenantSort]);

    // Filtered Users
    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            const matchesRole = userRoleFilter === 'all' 
                ? true 
                : userRoleFilter === 'super_admin' 
                    ? u.is_super_admin 
                    : u.role === userRoleFilter;

            if (!matchesRole) return false;

            if (!userSearch.trim()) return true;
            const q = userSearch.toLowerCase();
            return (
                (u.full_name && u.full_name.toLowerCase().includes(q)) ||
                (u.username && u.username.toLowerCase().includes(q)) ||
                (u.email && u.email.toLowerCase().includes(q)) ||
                (u.tenant_name && u.tenant_name.toLowerCase().includes(q))
            );
        });
    }, [users, userSearch, userRoleFilter]);

    if (!isSuperAdmin) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6">
                <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4">
                    <ShieldAlertIcon size={32} />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Super Admin Privileges Required</h2>
                <p className="text-slate-400 max-w-md text-sm mb-6">
                    You do not have permission to view or manage global workshop data.
                </p>
                <button
                    onClick={() => navigate('/')}
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition-all"
                >
                    Return to Dashboard
                </button>
            </div>
        );
    }

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-slate-950 flex flex-col">
            {/* Top Standalone Navigation Bar */}
            <header className="sticky top-0 z-40 bg-slate-900/90 border-b border-slate-800/90 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-xl">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-cyan-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-cyan-500/20">
                            <ShieldCheck size={20} className="text-white" />
                        </div>
                        <div>
                            <span className="text-base font-black tracking-tight text-white uppercase leading-none">
                                AUTO<span className="text-cyan-400">PULSE</span>
                            </span>
                            <span className="hidden sm:inline-block ml-2 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                                Super Admin
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-2 text-xs bg-slate-950/60 border border-slate-800 px-3 py-1.5 rounded-xl">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-slate-400 font-medium">Super Admin:</span>
                        <span className="text-white font-bold">{profile?.full_name || profile?.username || 'Nilan'}</span>
                    </div>

                    <button
                        onClick={handleSignOut}
                        className="px-3.5 py-2 bg-slate-800/80 hover:bg-red-500/20 text-slate-300 hover:text-red-300 rounded-xl text-xs font-semibold transition-all border border-slate-700/60 hover:border-red-500/30 flex items-center gap-1.5 active:scale-95"
                        title="Sign Out"
                    >
                        <LogOut size={14} />
                        <span className="hidden sm:inline">Sign Out</span>
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6 pb-16">
            {/* Toast Notification */}
            {toastMessage && (
                <div className="fixed top-5 right-5 z-50 bg-slate-900 border border-cyan-500/40 text-cyan-200 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-fade-in text-sm backdrop-blur-xl">
                    <CheckCircle2 size={18} className="text-cyan-400 shrink-0" />
                    <span className="font-medium">{toastMessage}</span>
                </div>
            )}

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden">
                <div className="absolute -top-16 -right-16 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/10">
                            <ShieldCheck size={22} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-black text-white tracking-tight uppercase">
                                    Super Admin Portal
                                </h1>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                    Platform Owner
                                </span>
                            </div>
                            <p className="text-xs text-slate-400">
                                Global workshop management, telemetry, and account operations
                            </p>
                        </div>
                    </div>

                    {isImpersonating && (
                        <div className="mt-3 inline-flex items-center gap-2 bg-amber-500/15 border border-amber-500/30 text-amber-300 px-3 py-1 rounded-xl text-xs">
                            <Sparkles size={14} className="text-amber-400 animate-pulse" />
                            <span>Currently viewing workshop: <strong>{profile?.tenants?.name}</strong></span>
                            <button
                                onClick={async () => {
                                    await resetTenantContext();
                                    showToast('Returned to default workshop');
                                }}
                                className="ml-2 underline text-amber-200 hover:text-white font-semibold"
                            >
                                Reset Context
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2.5 relative z-10 flex-wrap">
                    <button
                        onClick={() => loadSuperAdminData(true)}
                        disabled={refreshing}
                        className="px-3.5 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all border border-slate-700/60 flex items-center gap-2 disabled:opacity-50"
                        title="Refresh data"
                    >
                        <RefreshCw size={15} className={refreshing ? 'animate-spin text-cyan-400' : ''} />
                        <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
                    </button>

                    <button
                        onClick={handleOpenCreate}
                        className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-cyan-600/20 flex items-center gap-2 active:scale-95"
                    >
                        <Plus size={16} />
                        <span>Add Workshop</span>
                    </button>
                </div>
            </div>

            {/* Platform KPI Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                {/* Total Workshops */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 relative overflow-hidden backdrop-blur-sm group hover:border-cyan-500/30 transition-all">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Workshops</span>
                        <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
                            <Building2 size={16} />
                        </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-white">
                        {metrics?.total_tenants ?? tenants.length}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-cyan-400">
                        <CheckCircle2 size={12} />
                        <span>Active Platforms</span>
                    </div>
                </div>

                {/* Total Jobs */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 relative overflow-hidden backdrop-blur-sm group hover:border-blue-500/30 transition-all">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Platform Jobs</span>
                        <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
                            <Wrench size={16} />
                        </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-white">
                        {metrics?.total_jobs ?? 0}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                        <span className="text-emerald-400 font-semibold">{metrics?.total_completed_jobs ?? 0} Completed</span>
                        <span>•</span>
                        <span className="text-amber-400 font-semibold">{metrics?.total_active_jobs ?? 0} Active</span>
                    </div>
                </div>

                {/* Total Fleet & Customers */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 relative overflow-hidden backdrop-blur-sm group hover:border-purple-500/30 transition-all">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Fleet & Clients</span>
                        <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
                            <Car size={16} />
                        </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-white">
                        {metrics?.total_vehicles ?? 0}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-purple-400">
                        <Users size={12} />
                        <span>{metrics?.total_customers ?? 0} Registered Customers</span>
                    </div>
                </div>

                {/* Total Invoiced Volume */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 relative overflow-hidden backdrop-blur-sm group hover:border-emerald-500/30 transition-all">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Invoiced Revenue</span>
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                            <DollarSign size={16} />
                        </div>
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-white truncate">
                        LKR {Number(metrics?.total_invoiced || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                        <TrendingUp size={12} />
                        <span>Across All Workshops</span>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('tenants')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                        activeTab === 'tenants'
                            ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                >
                    <Building2 size={15} />
                    <span>Workshops Directory ({tenants.length})</span>
                </button>

                <button
                    onClick={() => setActiveTab('users')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                        activeTab === 'users'
                            ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                >
                    <Users size={15} />
                    <span>Staff & User Accounts ({users.length})</span>
                </button>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-red-300 text-xs flex items-center gap-3">
                    <AlertCircle size={18} className="text-red-400 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* TAB 1: WORKSHOPS DIRECTORY */}
            {activeTab === 'tenants' && (
                <div className="space-y-4">
                    {/* Filter & Search Bar */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                        <div className="relative flex-1">
                            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search workshops by name, phone, address, ID..."
                                value={tenantSearch}
                                onChange={(e) => setTenantSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
                            />
                            {tenantSearch && (
                                <button
                                    onClick={() => setTenantSearch('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                            <span className="text-[11px] text-slate-500 font-semibold uppercase">Sort:</span>
                            <select
                                value={tenantSort}
                                onChange={(e: any) => setTenantSort(e.target.value)}
                                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
                            >
                                <option value="recent">Recently Added</option>
                                <option value="jobs">Most Jobs</option>
                                <option value="revenue">Highest Invoiced</option>
                                <option value="name">Alphabetical</option>
                            </select>
                        </div>
                    </div>

                    {/* Workshop Cards List */}
                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map((n) => (
                                <div key={n} className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 animate-pulse h-28" />
                            ))}
                        </div>
                    ) : filteredTenants.length === 0 ? (
                        <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-12 text-center">
                            <Building2 size={36} className="mx-auto text-slate-600 mb-3" />
                            <h3 className="text-sm font-bold text-white mb-1">No Workshops Found</h3>
                            <p className="text-xs text-slate-500 mb-4">Try adjusting your search query or add a new workshop.</p>
                            <button
                                onClick={handleOpenCreate}
                                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold"
                            >
                                Add Workshop
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3.5">
                            {filteredTenants.map((tenant) => {
                                const isCurrent = profile?.tenant_id === tenant.id;
                                const isSwitching = switchingTenantId === tenant.id;
                                const brandColor = tenant.brand_color || '#06b6d4';

                                return (
                                    <div
                                        key={tenant.id}
                                        className={`bg-slate-900/60 border rounded-2xl p-4 sm:p-5 transition-all relative overflow-hidden backdrop-blur-sm hover:border-slate-700 ${
                                            isCurrent ? 'border-cyan-500/50 bg-cyan-950/10 shadow-lg shadow-cyan-950/30' : 'border-slate-800/80'
                                        }`}
                                    >
                                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                            {/* Left: Info */}
                                            <div className="flex items-start gap-3.5 min-w-0">
                                                {/* Logo / Avatar */}
                                                <div 
                                                    className="w-12 h-12 rounded-2xl shrink-0 flex items-center justify-center font-black text-white text-lg border border-white/10 overflow-hidden shadow-inner"
                                                    style={{ backgroundColor: `${brandColor}25`, borderColor: `${brandColor}40` }}
                                                >
                                                    {tenant.logo_url ? (
                                                        <img src={tenant.logo_url} alt={tenant.name} className="w-full h-full object-contain p-1" />
                                                    ) : (
                                                        <span style={{ color: brandColor }}>{tenant.name.charAt(0).toUpperCase()}</span>
                                                    )}
                                                </div>

                                                {/* Meta */}
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                                        <h3 className="text-sm font-bold text-white truncate">
                                                            {tenant.name}
                                                        </h3>
                                                        {isCurrent && (
                                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-cyan-500 text-slate-950">
                                                                Current Workshop
                                                            </span>
                                                        )}
                                                        {tenant.booking_enabled ? (
                                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                                Bookings On
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-slate-800 text-slate-400">
                                                                Bookings Off
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Contact & Location details */}
                                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
                                                        {tenant.phone && (
                                                            <span className="flex items-center gap-1">
                                                                <Phone size={11} className="text-slate-500" />
                                                                {tenant.phone}
                                                            </span>
                                                        )}
                                                        {tenant.email && (
                                                            <span className="flex items-center gap-1">
                                                                <Mail size={11} className="text-slate-500" />
                                                                {tenant.email}
                                                            </span>
                                                        )}
                                                        {tenant.address && (
                                                            <span className="flex items-center gap-1 truncate max-w-xs">
                                                                <MapPin size={11} className="text-slate-500 shrink-0" />
                                                                <span className="truncate">{tenant.address}</span>
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* ID and Created */}
                                                    <div className="mt-1.5 flex items-center gap-3 text-[10px] text-slate-500 font-mono">
                                                        <button
                                                            onClick={(e) => handleCopyId(tenant.id, e)}
                                                            className="flex items-center gap-1 hover:text-cyan-400 transition-colors"
                                                            title="Click to copy ID"
                                                        >
                                                            <span>ID: {tenant.id.slice(0, 8)}...</span>
                                                            {copiedId === tenant.id ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                                                        </button>
                                                        <span>•</span>
                                                        <span>Rate: {tenant.currency || 'LKR'} {Number(tenant.default_labor_rate || 2500).toLocaleString()}/hr</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Middle: Metrics Pills */}
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/80 text-center shrink-0">
                                                <div className="px-2 py-1">
                                                    <p className="text-[10px] font-semibold text-slate-500 uppercase">Staff</p>
                                                    <p className="text-xs font-bold text-slate-200">{tenant.staff_count || 0}</p>
                                                </div>
                                                <div className="px-2 py-1">
                                                    <p className="text-[10px] font-semibold text-slate-500 uppercase">Jobs</p>
                                                    <p className="text-xs font-bold text-white">
                                                        {tenant.jobs_count || 0}
                                                        {Number(tenant.active_jobs_count) > 0 && (
                                                            <span className="text-[10px] text-amber-400 ml-1">({tenant.active_jobs_count})</span>
                                                        )}
                                                    </p>
                                                </div>
                                                <div className="px-2 py-1">
                                                    <p className="text-[10px] font-semibold text-slate-500 uppercase">Vehicles</p>
                                                    <p className="text-xs font-bold text-slate-200">{tenant.vehicles_count || 0}</p>
                                                </div>
                                                <div className="px-2 py-1">
                                                    <p className="text-[10px] font-semibold text-slate-500 uppercase">Invoiced</p>
                                                    <p className="text-xs font-bold text-emerald-400 truncate max-w-[90px]">
                                                        {Number(tenant.total_invoiced || 0) > 0 
                                                            ? `${(Number(tenant.total_invoiced) / 1000).toFixed(0)}k` 
                                                            : '0'}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Right: Actions */}
                                            <div className="flex items-center gap-2 self-end lg:self-center shrink-0">
                                                {/* Edit Button */}
                                                <button
                                                    onClick={(e) => handleOpenEdit(tenant, e)}
                                                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all border border-slate-700 hover:text-white"
                                                    title="Edit Workshop Details"
                                                >
                                                    <Edit3 size={15} />
                                                </button>

                                                {/* Inspect Quick Overview */}
                                                <button
                                                    onClick={() => setInspectTenant(tenant)}
                                                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all border border-slate-700 hover:text-white"
                                                    title="View Workshop Details"
                                                >
                                                    <Eye size={15} />
                                                </button>

                                                {/* Enter Workshop Button */}
                                                <button
                                                    onClick={() => handleEnterWorkshop(tenant)}
                                                    disabled={isSwitching || isCurrent}
                                                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md ${
                                                        isCurrent
                                                            ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-default'
                                                            : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-600/20 active:scale-95'
                                                    }`}
                                                >
                                                    {isSwitching ? (
                                                        <>
                                                            <RefreshCw size={13} className="animate-spin" />
                                                            <span>Entering...</span>
                                                        </>
                                                    ) : isCurrent ? (
                                                        <>
                                                            <Check size={13} className="text-cyan-400" />
                                                            <span>Active Now</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span>⚡ Enter Workshop</span>
                                                            <ArrowRight size={13} />
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: STAFF & USER ACCOUNTS */}
            {activeTab === 'users' && (
                <div className="space-y-4">
                    {/* User Filters */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                        <div className="relative flex-1">
                            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search users by name, username, email, workshop..."
                                value={userSearch}
                                onChange={(e) => setUserSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
                            />
                            {userSearch && (
                                <button
                                    onClick={() => setUserSearch('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-500 font-semibold uppercase">Role:</span>
                            <select
                                value={userRoleFilter}
                                onChange={(e) => setUserRoleFilter(e.target.value)}
                                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
                            >
                                <option value="all">All Roles</option>
                                <option value="super_admin">Super Admins Only</option>
                                <option value="admin">Workshop Admins</option>
                                <option value="technician">Technicians</option>
                                <option value="manager">Managers</option>
                                <option value="accountant">Accountants</option>
                            </select>
                        </div>
                    </div>

                    {/* Users Table */}
                    <div className="bg-slate-900/60 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs text-slate-300">
                                <thead className="bg-slate-950/60 text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-800">
                                    <tr>
                                        <th className="py-3.5 px-4">User</th>
                                        <th className="py-3.5 px-4">Assigned Workshop</th>
                                        <th className="py-3.5 px-4">Role</th>
                                        <th className="py-3.5 px-4">Super Admin</th>
                                        <th className="py-3.5 px-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                    {filteredUsers.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="py-8 text-center text-slate-500">
                                                No users matching criteria.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredUsers.map((u) => {
                                            const isMe = u.id === profile?.id;

                                            return (
                                                <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-cyan-400 shrink-0">
                                                                {(u.full_name || u.email || 'U').charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="font-semibold text-white truncate flex items-center gap-1.5">
                                                                    <span>{u.full_name || 'No Name'}</span>
                                                                    {isMe && (
                                                                        <span className="text-[9px] px-1.5 py-0.2 bg-cyan-500/20 text-cyan-400 rounded-md font-mono">
                                                                            You
                                                                        </span>
                                                                    )}
                                                                </p>
                                                                <p className="text-[11px] text-slate-400 truncate">
                                                                    {u.email || u.username || 'No contact'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className="font-medium text-slate-300">
                                                            {u.tenant_name || <span className="text-slate-600 italic">Unassigned</span>}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                                                            {u.role}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        {u.is_super_admin ? (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                                                <Shield size={11} className="text-amber-400" />
                                                                Super Admin
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-500 text-[11px]">Standard</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        {!isMe && (
                                                            <button
                                                                onClick={() => handleToggleSuperAdmin(u)}
                                                                className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all border ${
                                                                    u.is_super_admin
                                                                        ? 'bg-red-500/10 hover:bg-red-500/20 text-red-300 border-red-500/30'
                                                                        : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
                                                                }`}
                                                            >
                                                                {u.is_super_admin ? 'Revoke Super Admin' : 'Grant Super Admin'}
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: EDIT / CREATE WORKSHOP */}
            {(editingTenant || isCreateTenantOpen) && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl animate-fade-in relative">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                                    {editingTenant ? <Edit3 size={18} /> : <Plus size={18} />}
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white">
                                        {editingTenant ? `Edit Workshop: ${editingTenant.name}` : 'Register New Workshop'}
                                    </h3>
                                    <p className="text-xs text-slate-400">
                                        Configure workshop settings, contact info, and business defaults
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setEditingTenant(null);
                                    setIsCreateTenantOpen(false);
                                }}
                                className="text-slate-400 hover:text-white p-1 rounded-lg"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveTenant} className="space-y-4">
                            {/* Workshop Name */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                    Workshop Name <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. Performance Auto Motors"
                                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                                />
                            </div>

                            {/* Phone & Email */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                        Phone Number
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="e.g. 0770035882"
                                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                        Email Address
                                    </label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="workshop@example.com"
                                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                                    />
                                </div>
                            </div>

                            {/* Address */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                    Physical Address
                                </label>
                                <textarea
                                    rows={2}
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    placeholder="Street address, city, postal code..."
                                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 resize-none"
                                />
                            </div>

                            {/* Currency & Labor Rate */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                        Currency Code
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.currency}
                                        onChange={(e) => setFormData({ ...formData, currency: e.target.value.toUpperCase() })}
                                        placeholder="LKR, USD, AUD, EUR..."
                                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                        Default Hourly Labor Rate
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="50"
                                        value={formData.default_labor_rate}
                                        onChange={(e) => setFormData({ ...formData, default_labor_rate: Number(e.target.value) })}
                                        placeholder="2500"
                                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                                    />
                                </div>
                            </div>

                            {/* Brand Color & Booking Toggle */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                        Brand Color
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={formData.brand_color}
                                            onChange={(e) => setFormData({ ...formData, brand_color: e.target.value })}
                                            className="w-10 h-10 rounded-xl border border-slate-700 bg-slate-950 cursor-pointer p-0.5"
                                        />
                                        <input
                                            type="text"
                                            value={formData.brand_color}
                                            onChange={(e) => setFormData({ ...formData, brand_color: e.target.value })}
                                            className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                        Customer Booking Portal
                                    </label>
                                    <div className="flex items-center gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, booking_enabled: !formData.booking_enabled })}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                                formData.booking_enabled ? 'bg-cyan-600' : 'bg-slate-700'
                                            }`}
                                        >
                                            <span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                    formData.booking_enabled ? 'translate-x-6' : 'translate-x-1'
                                                }`}
                                            />
                                        </button>
                                        <span className="text-xs text-slate-300">
                                            {formData.booking_enabled ? 'Enabled' : 'Disabled'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Buttons */}
                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingTenant(null);
                                        setIsCreateTenantOpen(false);
                                    }}
                                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingTenant}
                                    className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-cyan-600/20 active:scale-95 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {savingTenant && <RefreshCw size={14} className="animate-spin" />}
                                    <span>{editingTenant ? 'Save Changes' : 'Create Workshop'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: INSPECT WORKSHOP QUICK STATS */}
            {inspectTenant && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl animate-fade-in relative">
                        <div className="flex items-start justify-between pb-4 border-b border-slate-800 mb-5">
                            <div className="flex items-center gap-3">
                                <div 
                                    className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-lg border border-white/10"
                                    style={{ backgroundColor: `${inspectTenant.brand_color || '#06b6d4'}25` }}
                                >
                                    {inspectTenant.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white">{inspectTenant.name}</h3>
                                    <p className="text-xs text-slate-400 font-mono">ID: {inspectTenant.id}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setInspectTenant(null)}
                                className="text-slate-400 hover:text-white p-1 rounded-lg"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4 text-xs">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Staff Count</p>
                                    <p className="text-base font-bold text-white mt-0.5">{inspectTenant.staff_count}</p>
                                </div>
                                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Total Jobs</p>
                                    <p className="text-base font-bold text-white mt-0.5">
                                        {inspectTenant.jobs_count} ({inspectTenant.completed_jobs_count} completed)
                                    </p>
                                </div>
                                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Fleet / Customers</p>
                                    <p className="text-base font-bold text-white mt-0.5">
                                        {inspectTenant.vehicles_count} vehicles / {inspectTenant.customers_count} customers
                                    </p>
                                </div>
                                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Total Invoiced</p>
                                    <p className="text-base font-bold text-emerald-400 mt-0.5">
                                        {inspectTenant.currency || 'LKR'} {Number(inspectTenant.total_invoiced || 0).toLocaleString()}
                                    </p>
                                </div>
                            </div>

                            <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800 space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Phone:</span>
                                    <span className="text-white font-medium">{inspectTenant.phone || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Email:</span>
                                    <span className="text-white font-medium">{inspectTenant.email || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Address:</span>
                                    <span className="text-white font-medium text-right max-w-xs truncate">{inspectTenant.address || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Labor Rate:</span>
                                    <span className="text-white font-medium">{inspectTenant.currency || 'LKR'} {inspectTenant.default_labor_rate}/hr</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Created:</span>
                                    <span className="text-white font-medium">{new Date(inspectTenant.created_at).toLocaleDateString()}</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3">
                                <button
                                    onClick={() => {
                                        setInspectTenant(null);
                                        handleOpenEdit(inspectTenant);
                                    }}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold"
                                >
                                    Edit Details
                                </button>
                                <button
                                    onClick={() => {
                                        const t = inspectTenant;
                                        setInspectTenant(null);
                                        handleEnterWorkshop(t);
                                    }}
                                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold flex items-center gap-1.5"
                                >
                                    <span>Enter Workshop</span>
                                    <ArrowRight size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            </main>
        </div>
    );
};

// Helper icon
function ShieldAlertIcon(props: { size?: number }) {
    return <AlertCircle size={props.size || 24} />;
}

export default SuperAdminDashboard;
