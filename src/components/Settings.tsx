import React, { useState, useEffect } from "react";
import { useConfirm } from "../context/ConfirmContext";
import {
  Save,
  RefreshCcw,
  Trash2,
  Edit2,
  Check,
  X,
  Shield,
  Plus,
  RotateCcw,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useQueryClient } from "@tanstack/react-query";
import { checkSMSBalance } from "../lib/sms";

export const Settings = () => {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const isAdmin = profile?.role === "admin";
  const [activeTab, setActiveTab] = useState<
    "general" | "users" | "ai" | "troubleshoot"
  >("general");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [smsApiKey, setSmsApiKey] = useState("");
  const [smsSenderId, setSmsSenderId] = useState("");
  const [smsAutoEnabled, setSmsAutoEnabled] = useState(true);
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsBalance, setSmsBalance] = useState<string | null>(null);
  const [smsBalanceLoading, setSmsBalanceLoading] = useState(false);


  // Tenant Settings State
  const [tenantName, setTenantName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [terms, setTerms] = useState("");
  const [brandColor, setBrandColor] = useState("#06b6d4");
  const [defaultLaborRate, setDefaultLaborRate] = useState("2500");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  // Users Settings State
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ full_name: "", role: "" });

  const fetchTenantData = async () => {
    if (!profile?.tenant_id) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", profile.tenant_id)
        .single();

      if (data) {
        setTenantName(data.name);
        setLogoUrl(data.logo_url || "");
        setAddress(data.address || "");
        setPhone(data.phone || "");
        setTerms(data.terms_and_conditions || "");
        setBrandColor(data.brand_color || "#06b6d4");
        setAiApiKey(data.ai_api_key || "");
        setDefaultLaborRate(data.default_labor_rate?.toString() || "2500");
        setSmsApiKey(data.sms_api_key || "");
        setSmsSenderId(data.sms_sender_id || "");
        setSmsAutoEnabled(data.sms_auto_enabled !== false); // default true
      }
    } catch (error) {
      console.error("Error fetching tenant:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    if (!isAdmin) return;
    setUsersLoading(true);
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .order("updated_at", { ascending: false });
      if (data) setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    fetchTenantData();
    if (isAdmin) fetchUsers();
  }, [isAdmin, profile?.tenant_id]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!e.target.files || e.target.files.length === 0) return;

      const file = e.target.files[0];
      const fileExt = file.name.split(".").pop();
      const filePath = `${profile?.tenant_id}/${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("logos")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("logos").getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("tenants")
        .update({ logo_url: publicUrl })
        .eq("id", profile?.tenant_id);

      if (updateError) throw updateError;

      setLogoUrl(publicUrl);
      // Invalidate all tenant-related caches so PDF/invoice use the new logo immediately
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
      await refreshProfile();
      toast("Logo updated!", 'success');
    } catch (error: any) {
      toast(error.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const checkColorContrast = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    // Use HSP (Highly Sensitive Poo) color model for brightness
    const brightness = Math.sqrt(
      0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b),
    );

    if (brightness < 60) return "TOO_DARK";
    if (brightness > 240) return "TOO_LIGHT";
    return "OK";
  };

  const handleSaveTenant = async (e: React.FormEvent) => {
    e.preventDefault();

    const contrast = checkColorContrast(brandColor);
    if (contrast === "TOO_DARK") {
      toast("This color is too dark — it'll be invisible on the dark theme.", 'warning');
      return;
    }
    if (contrast === "TOO_LIGHT") {
      toast("This color is too bright — white text won't be readable.", 'warning');
      return;
    }

        if (!profile?.tenant_id) {
            toast("No tenant ID found.", 'error');
            return;
        }
        
        // Use the context refresher
        // You might need to cast or ensure typescript knows about it if the interface update didn't propagate instantly in IDE, but it should be fine.
        // Wait... we need to grab refreshProfile from useAuth() first.
        // We'll update the component body next.
        
        try {
            console.log('[Settings] Updating tenant:', profile.tenant_id, {
                name: tenantName,
                address,
                phone,
                terms_and_conditions: terms,
                brand_color: brandColor,
                default_labor_rate: parseFloat(defaultLaborRate)
            });

            const { data, error } = await supabase
                .from('tenants')
                .update({ 
                    name: tenantName,
                    address: address,
                    phone: phone,
                    terms_and_conditions: terms,
                    brand_color: brandColor,
                    default_labor_rate: parseFloat(defaultLaborRate)
                })
                .eq('id', profile.tenant_id)
                .select();

            if (error) {
                console.error('[Settings] Update Error:', error);
                throw error;
            }

            if (!data || data.length === 0) {
                throw new Error("Save blocked! The database didn't update anything. Either you lack admin permissions (RLS), or the new 'phone'/'address' columns don't exist yet (did you run update_tenants_info.sql?).");
            }

            console.log('[Settings] Update Successful');
            toast('Settings saved.', 'success');
            await refreshProfile();
            fetchTenantData();
            queryClient.invalidateQueries({ queryKey: ["tenant"] });
        } catch (error: any) {
            console.error('Error saving settings:', error);
            toast('Failed to save settings: ' + error.message, 'error');
        }
  };

  const startEditUser = (user: any) => {
    setEditingUserId(user.id);
    setEditForm({
      full_name: user.full_name || "",
      role: user.role || "technician",
    });
  };

  const cancelEditUser = () => {
    setEditingUserId(null);
  };

  const saveEditUser = async (id: string) => {
    const { error } = await supabase
      .from("profiles")
      .update(editForm)
      .eq("id", id);
    if (error) {
      toast("Failed to update user: " + error.message, 'error');
    } else {
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, ...editForm } : u)),
      );
      setEditingUserId(null);
      toast("User updated.", 'success');
    }
  };

  const deleteUser = async (id: string, name: string) => {
    if (!await confirm({ title: 'Remove User', message: `Remove ${name} from the workshop?`, confirmLabel: 'Remove' })) return;
    const { error } = await supabase.from("profiles").delete().eq("id", id);
    if (error) {
      toast("Failed to delete user: " + error.message, 'error');
    } else {
      setUsers((prev) => prev.filter((u) => u.id !== id));
      toast("User removed.", 'info');
    }
  };

  const handleSaveAiKey = async () => {
    setAiLoading(true);
    try {
      const { error } = await supabase
        .from("tenants")
        .update({ ai_api_key: aiApiKey })
        .eq("id", profile?.tenant_id);
      if (error) throw error;
      toast("AI configuration saved.", 'success');
    } catch (error: any) {
      toast("Error saving AI key: " + error.message, 'error');
    } finally {
      setAiLoading(false);
    }
  };

  const handleCheckBalance = async () => {
    if (!profile?.tenant_id) return;
    setSmsBalanceLoading(true);
    setSmsBalance(null);
    try {
      const balance = await checkSMSBalance(profile.tenant_id);
      setSmsBalance(balance);
    } catch (e: any) {
      setSmsBalance('Error: ' + e.message);
    } finally {
      setSmsBalanceLoading(false);
    }
  };

  const handleSaveSMS = async () => {
    setSmsLoading(true);
    try {
      const { error } = await supabase
        .from("tenants")
        .update({ sms_api_key: smsApiKey, sms_sender_id: smsSenderId, sms_auto_enabled: smsAutoEnabled })
        .eq("id", profile?.tenant_id);
      if (error) throw error;
      toast("SMS configuration saved.", 'success');
    } catch (error: any) {
      toast("Error saving SMS config: " + error.message, 'error');
    } finally {
      setSmsLoading(false);
    }
  };

  return (
    <div className="p-2 max-w-4xl mx-auto h-[calc(100vh-100px)] flex flex-col text-left">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Shop Settings</h1>
          <p className="text-slate-400">
            Manage your garage identity and team.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              fetchTenantData();
              if (isAdmin) fetchUsers();
            }}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCcw
              size={20}
              className={loading || usersLoading ? "animate-spin" : ""}
            />
          </button>
        </div>
      </div>

      <div className="flex border-b border-slate-800 mb-6 overflow-x-auto scrollbar-none whitespace-nowrap">
        <button
          onClick={() => setActiveTab("general")}
          className={`px-6 py-3 font-bold text-sm transition-colors border-b-2`}
          style={{
            borderBottomColor:
              activeTab === "general" ? brandColor : "transparent",
            color: activeTab === "general" ? brandColor : undefined,
          }}
        >
          Identity & Logo
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveTab("users")}
            className={`px-6 py-3 font-bold text-sm transition-colors border-b-2`}
            style={{
              borderBottomColor:
                activeTab === "users" ? brandColor : "transparent",
              color: activeTab === "users" ? brandColor : undefined,
            }}
          >
            Staff & Access
          </button>
        )}
        {isAdmin && (
          <button
            onClick={() => setActiveTab("ai")}
            className={`px-6 py-3 font-bold text-sm transition-colors border-b-2`}
            style={{
              borderBottomColor: activeTab === "ai" ? brandColor : "transparent",
              color: activeTab === "ai" ? brandColor : undefined,
            }}
          >
            AI & Intelligence
          </button>
        )}
        <button
          onClick={() => setActiveTab("mfa" as any)}
          className="px-6 py-3 font-bold text-sm transition-colors border-b-2"
          style={{
            borderBottomColor: activeTab === ("mfa" as any) ? brandColor : "transparent",
            color: activeTab === ("mfa" as any) ? brandColor : undefined,
          }}
        >
          Security
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveTab("audit" as any)}
            className={`px-6 py-3 font-bold text-sm transition-colors border-b-2`}
            style={{
              borderBottomColor: activeTab === ("audit" as any) ? brandColor : "transparent",
              color: activeTab === ("audit" as any) ? brandColor : undefined,
            }}
          >
            Audit Log
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        {activeTab === "general" && (
          <div className="space-y-6">
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-6 border-b border-slate-800 pb-2">
                Business Branding
              </h3>

              <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="space-y-4 flex-shrink-0">
                  <label className="block text-sm text-slate-400">
                    Shop Logo
                  </label>
                  <div className="w-32 h-32 rounded-2xl bg-slate-800 border-2 border-dashed border-slate-700 flex flex-col items-center justify-center relative overflow-hidden group">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt="Logo"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-slate-500 flex flex-col items-center">
                        <Plus size={24} />
                        <span className="text-[10px] mt-1 uppercase font-bold tracking-widest">
                          Logo
                        </span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={uploading}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <span className="text-white text-xs font-bold">
                        {uploading ? "Processing..." : "Change Logo"}
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800/50">
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        Theme Color
                      </label>
                      <button
                        onClick={() => setBrandColor("#06b6d4")}
                        className="text-[9px] font-bold text-slate-500 hover:text-white flex items-center gap-1 transition-colors uppercase"
                        title="Reset to Cyan"
                      >
                        <RotateCcw size={10} /> Reset
                      </button>
                    </div>
                    <div className="flex items-center gap-3 bg-slate-800 p-2 rounded-xl border border-slate-700">
                      <input
                        type="color"
                        value={brandColor}
                        onChange={(e) => setBrandColor(e.target.value)}
                        className="w-10 h-10 rounded-lg bg-transparent border-none cursor-pointer"
                      />
                      <span className="text-xs font-mono text-slate-400">
                        {brandColor.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[9px] text-slate-500 italic mt-2">
                      Will sync to all terminals.
                    </p>
                  </div>
                </div>

                <form
                  onSubmit={handleSaveTenant}
                  className="flex-1 space-y-6 w-full"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                        Auto-Shop Name
                      </label>
                      <input
                        type="text"
                        required
                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 focus:outline-none font-bold"
                        style={{ borderBottomColor: brandColor }}
                        value={tenantName}
                        onChange={(e) => setTenantName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                        Phone Number
                      </label>
                      <input
                        type="text"
                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 focus:outline-none font-mono"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+94 ..."
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                      Shop Address
                    </label>
                    <textarea
                      rows={2}
                      className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 focus:outline-none text-sm"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Enter your garage physical address..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                      Terms & Conditions (Shown on Invoice)
                    </label>
                    <textarea
                      rows={4}
                      className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 focus:outline-none text-xs leading-relaxed"
                      value={terms}
                      onChange={(e) => setTerms(e.target.value)}
                      placeholder="1. Warranty details... 2. Payment terms..."
                    />
                  </div>

                  <button
                    type="submit"
                    className="px-8 py-3 text-white rounded-xl font-bold shadow-lg transition-all flex items-center gap-2 active:scale-95"
                    style={{ backgroundColor: brandColor }}
                  >
                    <Save size={18} /> Save Shop Profile
                  </button>
                </form>
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center gap-2 text-brand mb-4">
                <Shield size={16} />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Operational Config
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                  <label className="text-[10px] text-slate-500 uppercase font-bold mb-2 block">
                    Default Labor Rate (LKR / hr)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      className="bg-transparent text-white font-mono text-xl focus:outline-none w-full"
                      value={defaultLaborRate}
                      onChange={(e) => setDefaultLaborRate(e.target.value)}
                    />
                    <button
                      onClick={handleSaveTenant}
                      className="text-[10px] bg-brand/10 text-brand px-3 py-1 rounded-lg hover:bg-brand/20 transition-all font-bold"
                    >
                      UPDATE
                    </button>
                  </div>
                </div>
                <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800 opacity-50">
                  <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">
                    Tax Configuration
                  </div>
                  <div className="text-white font-mono">0.00 % (Flat Rate)</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "users" && isAdmin && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-6 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Staff Management
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-slate-500 uppercase font-black">
                    Workshop ID:
                  </span>
                  <code
                    className="text-[10px] bg-slate-950 px-2 py-0.5 rounded font-mono border border-slate-800"
                    style={{ color: brandColor }}
                  >
                    {profile?.tenant_id}
                  </code>
                  <button
                    onClick={() => {
                      if (profile?.tenant_id) {
                        navigator.clipboard.writeText(profile.tenant_id);
                        toast("Workshop ID copied!", 'success');
                      }
                    }}
                    className="p-1 hover:bg-slate-800 rounded transition-colors text-slate-500"
                    title="Copy Workshop ID"
                  >
                    <span className="text-[9px] font-bold underline">
                      COPY ID
                    </span>
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-2 w-full md:w-auto">
                <button
                  onClick={() => {
                    const registerUrl = `${window.location.origin}${window.location.pathname}#/register?workshop_id=${profile?.tenant_id}`;
                    navigator.clipboard.writeText(registerUrl);
                    toast("Invite link copied — send to your staff member.", 'success');
                  }}
                  className="text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 bg-emerald-600 hover:bg-emerald-500"
                >
                  <Plus size={14} /> COPY INVITE LINK
                </button>
                <p className="text-[9px] text-slate-500 text-center italic">
                  Best for onboarding new staff
                </p>
              </div>
            </div>

            <div className="grid gap-3">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="bg-slate-800/40 border border-slate-700/50 p-4 rounded-xl flex items-center justify-between group"
                >
                  {editingUserId === user.id ? (
                    <div className="flex-1 flex gap-3 items-center">
                      <input
                        value={editForm.full_name}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            full_name: e.target.value,
                          })
                        }
                        className="bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm flex-1 focus:outline-none"
                      />
                      <select
                        value={editForm.role}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            role: e.target.value as any,
                          })
                        }
                        className="bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm focus:outline-none"
                      >
                        <option value="technician">Technician</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                        <option value="accountant">Accountant</option>
                      </select>
                      <button
                        onClick={() => saveEditUser(user.id)}
                        className="p-2 text-green-400 hover:bg-green-500/10 rounded-lg transition-colors"
                      >
                        <Check size={18} />
                      </button>
                      <button
                        onClick={cancelEditUser}
                        className="p-2 text-slate-400 hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold uppercase border border-slate-600">
                          {user.full_name?.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-white text-sm">
                            {user.full_name}
                          </div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1 uppercase tracking-widest font-black">
                            {user.role === "admin" && (
                              <Shield size={10} style={{ color: brandColor }} />
                            )}
                            {user.role}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEditUser(user)}
                          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => deleteUser(user.id, user.full_name)}
                          className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {activeTab === "ai" && isAdmin && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 max-w-2xl">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 rounded-2xl bg-brand-soft border border-brand/20 flex items-center justify-center">
                <Shield size={32} className="text-brand" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white leading-none mb-2">
                  Neural Intelligence Engine
                </h3>
                <p className="text-sm text-slate-400">
                  Power vehicle scanning and automated diagnostics.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="p-6 bg-slate-950/50 rounded-2xl border border-slate-800">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">
                  OpenRouter API Key
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="password"
                    placeholder="sk-or-v1-..."
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white font-mono focus:outline-none focus:border-brand"
                    value={aiApiKey}
                    onChange={(e) => setAiApiKey(e.target.value)}
                  />
                  <button
                    onClick={handleSaveAiKey}
                    disabled={aiLoading}
                    className="btn-brand px-6 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    <Save size={18} /> {aiLoading ? "Saving..." : "Apply Key"}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-4 leading-relaxed italic">
                  We use <strong>OpenRouter</strong> to provide high-performance
                  vision models like Gemini 2.0. Get your key at{" "}
                  <a
                    href="https://openrouter.ai"
                    target="_blank"
                    className="text-brand underline"
                  >
                    openrouter.ai
                  </a>
                  .
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
                  <div className="text-[10px] font-black text-brand uppercase tracking-widest mb-1 italic">Active Model</div>
                  <div className="text-white font-bold text-sm">Gemini 2.0 Flash</div>
                  <div className="text-[9px] text-slate-500 mt-1 uppercase">Optimized for Speed</div>
                </div>
                <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
                  <div className="text-[10px] font-black text-brand uppercase tracking-widest mb-1 italic">SmartScan</div>
                  <div className="text-white font-bold text-sm">Tesseract OCR</div>
                  <div className="text-[9px] text-slate-500 mt-1 uppercase">On-device · No API key</div>
                </div>
              </div>
            </div>

            {/* SMS Settings */}
            <div className="mt-8 p-6 bg-slate-950/50 rounded-2xl border border-slate-800">
              <h4 className="text-sm font-black text-white uppercase tracking-widest mb-1">SMS Notifications</h4>
              <p className="text-xs text-slate-500 mb-5">Auto-send SMS when jobs are opened or completed. Uses <strong className="text-slate-400">text.lk</strong>. Find your Sender ID at <span className="text-slate-400">app.text.lk → Sender IDs</span>.</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">API Token <span className="text-slate-600 normal-case font-normal">(from app.text.lk → Developers)</span></label>
                  <input
                    type="password"
                    placeholder="3388|uXAvFuPDOORLY..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-brand"
                    value={smsApiKey}
                    onChange={(e) => setSmsApiKey(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Sender ID <span className="text-slate-600 normal-case font-normal">(approved ID from app.text.lk → Sender IDs)</span></label>
                  <input
                    type="text"
                    placeholder="TextLKDemo"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand"
                    value={smsSenderId}
                    onChange={(e) => setSmsSenderId(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleCheckBalance}
                    disabled={smsBalanceLoading || !smsApiKey}
                    className="py-3 rounded-xl font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-all active:scale-95 text-sm"
                  >
                    {smsBalanceLoading ? "Checking..." : "Check Balance"}
                  </button>
                  <button
                    onClick={handleSaveSMS}
                    disabled={smsLoading}
                    className="btn-brand py-3 rounded-xl font-bold active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Save size={16} /> {smsLoading ? "Saving..." : "Save"}
                  </button>
                </div>
                {smsBalance !== null && (
                  <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border ${smsBalance.startsWith('Error') ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                    {smsBalance.startsWith('Error') ? '✗' : '✓'} {smsBalance.startsWith('Error') ? smsBalance : `SMS balance: ${smsBalance} units`}
                  </div>
                )}
                {/* Auto SMS toggle */}
                <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-slate-800 mt-1">
                  <div>
                    <p className="text-sm font-bold text-white">Auto-send SMS</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Fires on: job in progress · job completed</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSmsAutoEnabled(p => !p)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${smsAutoEnabled ? 'bg-brand' : 'bg-slate-700'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${smsAutoEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
                <p className="text-[10px] text-slate-600 italic">Manual send is always available via the SMS button in any job detail panel.</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "troubleshoot" && isAdmin && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 max-w-2xl">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Shield size={32} className="text-amber-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white leading-none mb-2">
                  Data Diagnostics
                </h3>
                <p className="text-sm text-slate-400">
                  Fix common data consistency issues.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="p-6 bg-slate-950/50 rounded-2xl border border-slate-800">
                <h4 className="text-sm font-bold text-white mb-2">
                  Fix "Job Card Error" / "Missing Tenant"
                </h4>
                <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                  If you created jobs or parts before your workshop was fully
                  set up (e.g., immediate Google Login), some records might be
                  "orphaned" (missing your Workshop ID). This tool will find
                  records you created and link them to your current workshop.
                </p>
                <button
                  onClick={async () => {
                    if (!await confirm({ title: 'Run Data Repair', message: 'This will link orphaned records to your current workshop.', confirmLabel: 'Run Repair', confirmStyle: 'warning' })) return;
                    setLoading(true);
                    try {
                      if (!profile?.tenant_id)
                        throw new Error(
                          "You don't have a workshop ID yourself!",
                        );
                      if (!profile?.id) throw new Error("User ID missing.");

                      // 1. Fix Job Cards
                      const { data: jobOrphans } = await supabase
                        .from("job_cards")
                        .select("id")
                        .is("tenant_id", null)
                        .eq("created_by", profile.id);

                      // 2. Fix Parts/Labor (optional, usually cascading but good to check)

                      if (jobOrphans?.length) {
                        const { error } = await supabase
                          .from("job_cards")
                          .update({ tenant_id: profile.tenant_id })
                          .in(
                            "id",
                            jobOrphans.map((j) => j.id),
                          );
                        if (error) throw error;
                        toast(`Repaired ${jobOrphans.length} job cards.`, 'success');
                      } else {
                        toast("No orphaned job cards found — data looks good!", 'info');
                      }
                    } catch (e: any) {
                      toast("Repair error: " + e.message, 'error');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all shadow-lg active:scale-95 flex items-center gap-2 border border-slate-700"
                >
                  <RefreshCcw
                    size={18}
                    className={loading ? "animate-spin" : ""}
                  />
                  {loading ? "Scanning & Repairing..." : "Scan & Repair Data"}
                </button>
              </div>
            </div>
          </div>
        )}

        {(activeTab as any) === "mfa" && (
          <MFATab />
        )}

        {(activeTab as any) === "audit" && isAdmin && (
          <AuditLogTab tenantId={profile?.tenant_id} />
        )}
      </div>
    </div>
  );
};

function MFATab() {
  const [factors, setFactors] = React.useState<any[]>([]);
  const [enrolling, setEnrolling] = React.useState(false);
  const [qrCode, setQrCode] = React.useState('');
  const [secret, setSecret] = React.useState('');
  const [factorId, setFactorId] = React.useState('');
  const [code, setCode] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState('');

  React.useEffect(() => {
    import('../lib/supabase').then(({ supabase }) => {
      supabase.auth.mfa.listFactors().then(({ data }) => {
        setFactors(data?.totp || []);
      });
    });
  }, []);

  const startEnroll = async () => {
    const { supabase } = await import('../lib/supabase');
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'AutoPulse' });
    if (error) { setMsg(error.message); return; }
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setFactorId(data.id);
    setEnrolling(true);
    setMsg('');
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { supabase } = await import('../lib/supabase');
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (error) { setMsg(error.message); setLoading(false); return; }
    setEnrolling(false);
    setMsg('MFA enabled! Your account is now protected.');
    supabase.auth.mfa.listFactors().then(({ data }) => setFactors(data?.totp || []));
    setLoading(false);
  };

  const unenroll = async (id: string) => {
    const { supabase } = await import('../lib/supabase');
    await supabase.auth.mfa.unenroll({ factorId: id });
    setFactors(f => f.filter(x => x.id !== id));
    setMsg('MFA removed.');
  };

  const verified = factors.filter(f => f.status === 'verified');

  return (
    <div className="max-w-lg space-y-6">
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-1">Two-Factor Authentication</h3>
        <p className="text-sm text-slate-400 mb-6">Add an authenticator app (Google Authenticator, Authy) for extra login security.</p>

        {msg && <div className={`mb-4 p-3 rounded-xl text-sm ${msg.includes('enabled') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{msg}</div>}

        {verified.length > 0 ? (
          <div className="space-y-3">
            {verified.map(f => (
              <div key={f.id} className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <div>
                  <p className="text-sm font-bold text-emerald-400">✓ MFA Active</p>
                  <p className="text-xs text-slate-400">{f.friendly_name || 'Authenticator App'}</p>
                </div>
                <button onClick={() => unenroll(f.id)} className="text-xs text-red-400 hover:text-red-300 font-bold">Remove</button>
              </div>
            ))}
          </div>
        ) : enrolling ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">Scan this QR code with your authenticator app:</p>
            <div className="bg-white p-4 rounded-xl inline-block">
              <img src={qrCode} alt="MFA QR Code" className="w-40 h-40" />
            </div>
            <div className="bg-slate-800 p-3 rounded-xl">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Or enter manually:</p>
              <p className="font-mono text-xs text-white break-all">{secret}</p>
            </div>
            <form onSubmit={verify} className="flex gap-3">
              <input
                type="text"
                placeholder="Enter 6-digit code"
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white font-mono text-center text-lg tracking-widest focus:outline-none focus:border-brand"
              />
              <button type="submit" disabled={loading || code.length !== 6} className="btn-brand px-4 py-2 rounded-xl font-bold disabled:opacity-50">
                {loading ? '...' : 'Verify'}
              </button>
            </form>
          </div>
        ) : (
          <button onClick={startEnroll} className="btn-brand px-6 py-3 rounded-xl font-bold">
            Enable Two-Factor Authentication
          </button>
        )}
      </div>

      {/* Push Notifications */}
      <PushNotificationSection />
    </div>
  );
}

function PushNotificationSection() {
  const [status, setStatus] = React.useState<'idle'|'enabled'|'denied'|'loading'>('idle');
  React.useEffect(() => {
    if (!('Notification' in window)) { setStatus('denied'); return; }
    if (Notification.permission === 'granted') setStatus('enabled');
    else if (Notification.permission === 'denied') setStatus('denied');
  }, []);

  const enable = async () => {
    setStatus('loading');
    const { subscribeToPush } = await import('../lib/push');
    const { supabase } = await import('../lib/supabase');
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from('profiles').select('id, tenant_id').eq('id', user?.id ?? '').single();
    if (!prof) { setStatus('idle'); return; }
    const ok = await subscribeToPush(prof.id, prof.tenant_id);
    setStatus(ok ? 'enabled' : Notification.permission === 'denied' ? 'denied' : 'idle');
  };

  if (!('Notification' in window) || !('PushManager' in window)) return null;

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
      <h3 className="text-lg font-bold text-white mb-1">Push Notifications</h3>
      <p className="text-sm text-slate-400 mb-4">Get notified when jobs are completed or assigned to you.</p>
      {status === 'enabled' && (
        <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold">
          <span>✓</span> Push notifications enabled
        </div>
      )}
      {status === 'denied' && (
        <p className="text-sm text-red-400">Notifications blocked. Enable them in your device Settings → Safari → Notifications.</p>
      )}
      {(status === 'idle' || status === 'loading') && (
        <button
          onClick={enable}
          disabled={status === 'loading'}
          className="btn-brand px-5 py-2.5 rounded-xl font-bold text-sm active:scale-95 disabled:opacity-50"
        >
          {status === 'loading' ? 'Enabling...' : 'Enable Push Notifications'}
        </button>
      )}
    </div>
  );
}

function AuditLogTab({ tenantId }: { tenantId?: string }) {
  const [logs, setLogs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const { supabase: _sb } = { supabase: null }; // unused — using module import below

  React.useEffect(() => {
    if (!tenantId) return;
    import('../lib/supabase').then(({ supabase }) => {
      supabase
        .from('audit_logs')
        .select('*, profiles(full_name)')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(100)
        .then(({ data }) => { setLogs(data || []); setLoading(false); });
    });
  }, [tenantId]);

  if (loading) return <div className="text-slate-500 text-center py-12">Loading audit log...</div>;
  if (!logs.length) return <div className="text-slate-500 text-center py-12">No activity recorded yet.</div>;

  return (
    <div className="space-y-2">
      {logs.map(log => (
        <div key={log.id} className="flex items-start gap-4 p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono bg-slate-800 text-cyan-400 px-2 py-0.5 rounded">{log.action}</span>
              {log.meta?.plate && <span className="text-xs text-slate-400">{log.meta.plate}</span>}
              {log.meta?.from && <span className="text-xs text-slate-500">{log.meta.from} → {log.meta.to}</span>}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {log.profiles?.full_name || 'System'} · {new Date(log.created_at).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
