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
  UserPlus,
  KeyRound,
  Eye,
  EyeOff,
  Wrench,
  Search,
  Users,
  Copy,
  Briefcase,
  FileSpreadsheet,
  Power,
  Info,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useQueryClient } from "@tanstack/react-query";
import { checkSMSBalance } from "../lib/sms";
import { tidyName } from "../lib/textCase";
import { CreateStaffModal } from "./CreateStaffModal";
import { AddFloorTechModal } from "./AddFloorTechModal";
import { AdminResetPasswordModal } from "./AdminResetPasswordModal";

export const Settings = () => {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const isAdmin = profile?.role === "admin";
  const isManager = profile?.role === "manager";
  const canManageGeneral = isAdmin || isManager;
  const [activeTab, setActiveTab] = useState<
    "general" | "users" | "ai" | "troubleshoot" | "mfa" | "audit"
  >(canManageGeneral ? "general" : "mfa");
  const [isCreateStaffOpen, setIsCreateStaffOpen] = useState(false);
  const [resetPasswordTarget, setResetPasswordTarget] = useState<any>(null);
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
  const [paymentQrUrl, setPaymentQrUrl] = useState("");
  const [paymentLink, setPaymentLink] = useState("");
  const [bankDetails, setBankDetails] = useState("");
  const [uploadingQr, setUploadingQr] = useState(false);
  const [loading, setLoading] = useState(true);

  // Users Settings State
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [staff, setStaff] = useState<{ id: string; name: string; profile_id: string | null; active: boolean }[]>([]);
  const [editForm, setEditForm] = useState({ full_name: "", role: "" });
  const [isAddFloorTechOpen, setIsAddFloorTechOpen] = useState(false);
  const [createStaffPrefill, setCreateStaffPrefill] = useState<{
    fullName?: string;
    role?: 'technician' | 'manager' | 'accountant' | 'admin';
  }>({});
  const [staffSearch, setStaffSearch] = useState("");
  const [staffFilter, setStaffFilter] = useState<'all' | 'login' | 'floor' | 'admin'>('all');
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [editingStaffName, setEditingStaffName] = useState("");

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
        setPaymentQrUrl(data.payment_qr_url || "");
        setPaymentLink(data.payment_link || "");
        setBankDetails(data.bank_details || "");
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
    fetchStaff();
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

  const fetchStaff = async () => {
    const { data } = await supabase
      .from("staff")
      .select("id, name, profile_id, active")
      .order("name");
    if (data) setStaff(data);
  };

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploadingQr(true);
      if (!e.target.files || e.target.files.length === 0) return;

      const file = e.target.files[0];
      const fileExt = file.name.split(".").pop();
      const filePath = `${profile?.tenant_id}/qr-${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("logos")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("logos").getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("tenants")
        .update({ payment_qr_url: publicUrl })
        .eq("id", profile?.tenant_id);
      if (updateError) throw updateError;

      setPaymentQrUrl(publicUrl);
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
      toast("Payment QR updated!", 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'QR upload failed', 'error');
    } finally {
      setUploadingQr(false);
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
                    default_labor_rate: parseFloat(defaultLaborRate),
                    payment_link: paymentLink || null,
                    bank_details: bankDetails || null
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
    const clean = tidyName(editForm.full_name);
    if (!clean) {
      toast("Name cannot be empty.", 'error');
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: clean, role: editForm.role })
      .eq("id", id);
    if (error) {
      toast("Failed to update user: " + error.message, 'error');
    } else {
      await supabase.from("staff").update({ name: clean }).eq("profile_id", id);
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, full_name: clean, role: editForm.role } : u)),
      );
      setEditingUserId(null);
      fetchStaff();
      toast("User updated.", 'success');
    }
  };

  const deleteUser = async (id: string, name: string) => {
    if (!await confirm({ title: 'Remove User', message: `Remove ${name} from the workshop? They will lose access to sign in.`, confirmLabel: 'Remove' })) return;
    const { error } = await supabase.from("profiles").delete().eq("id", id);
    if (error) {
      toast("Failed to delete user: " + error.message, 'error');
    } else {
      setUsers((prev) => prev.filter((u) => u.id !== id));
      fetchStaff();
      toast("User removed.", 'info');
    }
  };

  const startEditStaff = (member: { id: string; name: string }) => {
    setEditingStaffId(member.id);
    setEditingStaffName(member.name);
  };

  const cancelEditStaff = () => {
    setEditingStaffId(null);
    setEditingStaffName("");
  };

  const saveEditStaff = async (id: string) => {
    const clean = tidyName(editingStaffName);
    if (!clean) {
      toast("Name cannot be empty.", 'error');
      return;
    }
    const { error } = await supabase.from("staff").update({ name: clean }).eq("id", id);
    if (error) {
      toast("Failed to update technician: " + error.message, 'error');
    } else {
      toast("Technician updated.", 'success');
      setEditingStaffId(null);
      fetchStaff();
    }
  };

  const handleToggleStaffActive = async (staffId: string, currentActive: boolean, name: string) => {
    const { error } = await supabase
      .from("staff")
      .update({ active: !currentActive })
      .eq("id", staffId);
    if (error) {
      toast(error.message, 'error');
      return;
    }
    toast(!currentActive ? `${name} enabled for job assignment.` : `${name} paused from job assignment.`, 'info');
    fetchStaff();
  };

  const deleteStaff = async (staffMember: { id: string; name: string }) => {
    if (!await confirm({
      title: 'Remove Technician',
      message: `Remove ${staffMember.name} from technicians? If they have completed job cards in the past, their history will be preserved and they will be marked inactive.`,
      confirmLabel: 'Remove'
    })) return;

    const { error } = await supabase.from("staff").delete().eq("id", staffMember.id);
    if (error) {
      if (error.code === '23503' || error.message?.includes('foreign key') || error.message?.includes('referenced')) {
        const { error: deactError } = await supabase.from("staff").update({ active: false }).eq("id", staffMember.id);
        if (deactError) {
          toast("Failed to update technician: " + deactError.message, 'error');
        } else {
          toast(`${staffMember.name} has past job history, so they have been marked inactive.`, 'info');
          fetchStaff();
        }
        return;
      }
      toast("Failed to delete technician: " + error.message, 'error');
    } else {
      toast(`${staffMember.name} removed.`, 'info');
      fetchStaff();
    }
  };

  // Unified Team List: Combines users (profiles) and floor-only staff
  const unifiedTeam = React.useMemo(() => {
    const list: Array<{
      key: string;
      staffId: string | null;
      profileId: string | null;
      name: string;
      username: string | null;
      role: 'admin' | 'manager' | 'accountant' | 'technician';
      hasLogin: boolean;
      isStaffActive: boolean;
      isFloorOnly: boolean;
      userObj?: any;
      staffObj?: any;
    }> = [];

    // 1. Add all profiles (users with login credentials)
    for (const u of users) {
      const matched = staff.find((s) => s.profile_id === u.id);
      list.push({
        key: `profile-${u.id}`,
        staffId: matched ? matched.id : null,
        profileId: u.id,
        name: u.full_name || u.username || 'Unnamed Staff',
        username: u.username || null,
        role: (u.role as any) || 'technician',
        hasLogin: true,
        isStaffActive: matched ? matched.active : true,
        isFloorOnly: false,
        userObj: u,
        staffObj: matched,
      });
    }

    // 2. Add unlinked staff (floor-only technicians with no profile)
    for (const s of staff) {
      if (!s.profile_id || !users.some((u) => u.id === s.profile_id)) {
        list.push({
          key: `staff-${s.id}`,
          staffId: s.id,
          profileId: null,
          name: s.name || 'Technician',
          username: null,
          role: 'technician',
          hasLogin: false,
          isStaffActive: s.active,
          isFloorOnly: true,
          staffObj: s,
        });
      }
    }

    return list;
  }, [users, staff]);

  // Filtered team list
  const filteredTeam = React.useMemo(() => {
    const query = staffSearch.trim().toLowerCase();
    return unifiedTeam.filter((member) => {
      // Tab filter
      if (staffFilter === 'login' && !member.hasLogin) return false;
      if (staffFilter === 'floor' && !member.isFloorOnly) return false;
      if (staffFilter === 'admin' && member.role !== 'admin' && member.role !== 'manager') return false;

      // Search query
      if (query) {
        const matchesName = member.name.toLowerCase().includes(query);
        const matchesUsername = member.username?.toLowerCase().includes(query);
        const matchesRole = member.role.toLowerCase().includes(query);
        return matchesName || matchesUsername || matchesRole;
      }
      return true;
    });
  }, [unifiedTeam, staffFilter, staffSearch]);

  const teamStats = React.useMemo(() => {
    const total = unifiedTeam.length;
    const loginCount = unifiedTeam.filter((m) => m.hasLogin).length;
    const floorOnlyCount = unifiedTeam.filter((m) => m.isFloorOnly).length;
    const adminCount = unifiedTeam.filter((m) => m.role === 'admin' || m.role === 'manager').length;
    return { total, loginCount, floorOnlyCount, adminCount };
  }, [unifiedTeam]);

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
        {canManageGeneral && (
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
        )}
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

                  <div className="pt-4 border-t border-slate-800/50 space-y-3">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Payment QR
                    </label>
                    <div className="w-32 h-32 rounded-2xl bg-slate-800 border-2 border-dashed border-slate-700 flex flex-col items-center justify-center relative overflow-hidden group">
                      {paymentQrUrl ? (
                        <img src={paymentQrUrl} alt="Payment QR" className="w-full h-full object-contain bg-white" />
                      ) : (
                        <div className="text-slate-500 flex flex-col items-center">
                          <Plus size={24} />
                          <span className="text-[10px] mt-1 uppercase font-bold tracking-widest">QR</span>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleQrUpload}
                        disabled={uploadingQr}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <span className="text-white text-xs font-bold">
                          {uploadingQr ? "Processing..." : paymentQrUrl ? "Change QR" : "Upload QR"}
                        </span>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      LankaQR or your bank's QR. Appears on the invoice PDF.
                    </p>

                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest pt-1">
                      Payment Link
                    </label>
                    <input
                      type="url"
                      inputMode="url"
                      placeholder="https://pay.example.lk/yourshop"
                      value={paymentLink}
                      onChange={(e) => setPaymentLink(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-brand"
                    />
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      Included in the WhatsApp message. Saved with Save Settings.
                    </p>

                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest pt-1">
                      Bank Account Details
                    </label>
                    <textarea
                      rows={5}
                      placeholder={"Bank of Ceylon\nAccount name: ABC Motors (Pvt) Ltd\nAccount no: 1234567890\nBranch: Kandy"}
                      value={bankDetails}
                      onChange={(e) => setBankDetails(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-brand resize-y"
                    />
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      Printed on the invoice PDF in a highlighted box. Type it exactly as you
                      want it to appear — each line is reproduced as entered.
                    </p>
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
                  <label className="text-[10px] text-slate-400 uppercase font-bold mb-2 block">
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
                  <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">
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
            {/* Top Header & Quick Actions */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 pb-6 border-b border-slate-800">
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <Users size={22} className="text-brand" />
                  Staff & Access Control
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Manage workshop mechanics, role permissions, and system logins in one unified place.
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
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
                    className="p-1 hover:bg-slate-800 rounded transition-colors text-slate-500 hover:text-slate-300"
                    title="Copy Workshop ID"
                  >
                    <Copy size={12} />
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                <button
                  onClick={() => setIsAddFloorTechOpen(true)}
                  className="px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow"
                >
                  <Wrench size={15} className="text-cyan-400" />
                  <span>+ ADD FLOOR TECH</span>
                </button>

                <button
                  onClick={() => {
                    setCreateStaffPrefill({});
                    setIsCreateStaffOpen(true);
                  }}
                  className="btn-brand px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-lg whitespace-nowrap"
                >
                  <UserPlus size={15} />
                  <span>+ ADD STAFF ACCOUNT</span>
                </button>

                <button
                  onClick={async () => {
                    const { data: token, error } = await supabase.rpc('create_invite', { p_role: 'technician' });
                    if (error || !token) {
                      toast(error?.message || 'Could not create an invite.', 'error');
                      return;
                    }
                    const registerUrl = `${window.location.origin}${window.location.pathname}#/register?invite=${token}`;
                    await navigator.clipboard.writeText(registerUrl);
                    toast("Invite link copied — single use, expires in 7 days.", 'success');
                  }}
                  className="px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-950 hover:bg-slate-800 border border-slate-800 flex items-center justify-center gap-1.5 transition-all active:scale-95"
                  title="Generate a 7-day single use registration invite"
                >
                  <Copy size={13} />
                  <span>INVITE LINK</span>
                </button>
              </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Team</span>
                  <Users size={15} className="text-cyan-400" />
                </div>
                <div className="text-2xl font-black text-white">{teamStats.total}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Active personnel</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Login Accounts</span>
                  <Shield size={15} className="text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-emerald-400">{teamStats.loginCount}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Can sign in</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Floor Only</span>
                  <Wrench size={15} className="text-amber-400" />
                </div>
                <div className="text-2xl font-black text-amber-400">{teamStats.floorOnlyCount}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Assigned to jobs</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Admins & Mgrs</span>
                  <Briefcase size={15} className="text-sky-400" />
                </div>
                <div className="text-2xl font-black text-sky-400">{teamStats.adminCount}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">System management</div>
              </div>
            </div>

            {/* Quick Guidance Info Callout */}
            <div className="mb-6 p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/80 flex items-start gap-3">
              <Info size={16} className="text-cyan-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-400 leading-relaxed">
                <span className="text-white font-semibold">How it works:</span> Mechanics working solely on the shop floor can be added as <span className="text-cyan-300 font-semibold">Floor Techs</span> without an email or login. Anyone who logs into the tablet or computer needs a <span className="text-emerald-300 font-semibold">Staff Account</span>. You can upgrade any floor technician to a login account with 1-click at any time.
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between mb-5">
              <div className="relative flex-1 max-w-md">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  placeholder="Search by name, @username, or role..."
                  className="w-full pl-9 pr-8 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-brand transition-colors"
                />
                {staffSearch && (
                  <button
                    onClick={() => setStaffSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 border border-slate-800 rounded-xl overflow-x-auto">
                {[
                  { id: 'all', label: 'All Team', count: teamStats.total },
                  { id: 'login', label: 'Login Accounts', count: teamStats.loginCount },
                  { id: 'floor', label: 'Floor Only', count: teamStats.floorOnlyCount },
                  { id: 'admin', label: 'Admins & Mgrs', count: teamStats.adminCount },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setStaffFilter(tab.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      staffFilter === tab.id
                        ? 'bg-brand text-slate-950 font-bold shadow'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        staffFilter === tab.id ? 'bg-slate-900/30 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Unified Team Roster List */}
            <div className="space-y-3">
              {filteredTeam.length === 0 && (
                <div className="text-center py-12 px-4 rounded-xl border border-dashed border-slate-800 bg-slate-950/30">
                  <Users size={32} className="mx-auto text-slate-600 mb-3" />
                  <h4 className="text-sm font-bold text-white">No team members found</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    {staffSearch ? `No team members match "${staffSearch}". Try clearing your search or filter.` : 'No team members in this category.'}
                  </p>
                  {(staffSearch || staffFilter !== 'all') && (
                    <button
                      onClick={() => { setStaffSearch(''); setStaffFilter('all'); }}
                      className="mt-3 px-3 py-1.5 rounded-lg text-xs font-semibold text-brand hover:underline"
                    >
                      Clear search & filters
                    </button>
                  )}
                </div>
              )}

              {filteredTeam.map((member) => {
                const isEditingUser = !!member.profileId && editingUserId === member.profileId;
                const isEditingStaff = !!member.staffId && editingStaffId === member.staffId && member.isFloorOnly;

                return (
                  <div
                    key={member.key}
                    className={`p-4 rounded-xl border transition-all ${
                      member.hasLogin
                        ? 'bg-slate-800/40 border-slate-800 hover:border-slate-700'
                        : 'bg-slate-950/40 border-slate-800/70 hover:border-slate-700/80'
                    } ${!member.isStaffActive ? 'opacity-70' : ''}`}
                  >
                    {isEditingUser ? (
                      /* Inline Profile Edit Form */
                      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                        <input
                          value={editForm.full_name}
                          onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                          placeholder="Full Name"
                          className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm flex-1 focus:outline-none focus:border-brand"
                        />
                        <select
                          value={editForm.role}
                          onChange={(e) => setEditForm({ ...editForm, role: e.target.value as any })}
                          className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-brand"
                        >
                          <option value="technician">Technician</option>
                          <option value="manager">Manager</option>
                          <option value="accountant">Accountant</option>
                          <option value="admin">Admin</option>
                        </select>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => saveEditUser(member.profileId!)}
                            className="p-2 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-xl transition-colors"
                            title="Save Changes"
                          >
                            <Check size={18} />
                          </button>
                          <button
                            onClick={cancelEditUser}
                            className="p-2 text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
                            title="Cancel"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </div>
                    ) : isEditingStaff ? (
                      /* Inline Floor Staff Edit Form */
                      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                        <input
                          value={editingStaffName}
                          onChange={(e) => setEditingStaffName(e.target.value)}
                          placeholder="Technician Name"
                          className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm flex-1 focus:outline-none focus:border-brand"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => saveEditStaff(member.staffId!)}
                            className="p-2 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-xl transition-colors"
                            title="Save Changes"
                          >
                            <Check size={18} />
                          </button>
                          <button
                            onClick={cancelEditStaff}
                            className="p-2 text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
                            title="Cancel"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Normal Display Row */
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        {/* Member Identity & Badges */}
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div
                            className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm uppercase shrink-0 border ${
                              member.role === 'admin'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                : member.role === 'manager'
                                ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                                : member.role === 'accountant'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-slate-800 text-cyan-400 border-slate-700'
                            }`}
                          >
                            {member.name?.charAt(0) || 'T'}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-white text-sm truncate">{member.name}</span>
                              {member.username && (
                                <span className="text-[11px] font-mono text-cyan-400 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800">
                                  @{member.username}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              {/* Role Badge */}
                              {member.role === 'admin' && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                                  <Shield size={10} /> Admin
                                </span>
                              )}
                              {member.role === 'manager' && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-md border border-sky-500/20">
                                  <Briefcase size={10} /> Manager
                                </span>
                              )}
                              {member.role === 'accountant' && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                  <FileSpreadsheet size={10} /> Accountant
                                </span>
                              )}
                              {member.role === 'technician' && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20">
                                  <Wrench size={10} /> Technician
                                </span>
                              )}

                              {/* Access Badge */}
                              {member.hasLogin ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                  Login Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                                  Floor Only · No Login
                                </span>
                              )}

                              {/* Job assignment status */}
                              {member.staffId && !member.isStaffActive ? (
                                <span className="text-[10px] text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                                  Assignment Paused
                                </span>
                              ) : member.staffId ? (
                                <span className="text-[10px] text-slate-400">
                                  Job Assignable
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        {/* Actions Area */}
                        <div className="flex items-center gap-1.5 self-end md:self-center shrink-0">
                          {member.isFloorOnly ? (
                            <>
                              {/* 1-Click Upgrade Floor Tech to Full Login */}
                              <button
                                onClick={() => {
                                  setCreateStaffPrefill({ fullName: member.name, role: 'technician' });
                                  setIsCreateStaffOpen(true);
                                }}
                                className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 flex items-center gap-1.5 transition-all active:scale-95 shadow"
                                title="Create login username & password for this floor technician"
                              >
                                <UserPlus size={13} />
                                <span>Create Login</span>
                              </button>

                              {/* Toggle active / paused assignment */}
                              <button
                                onClick={() => handleToggleStaffActive(member.staffId!, member.isStaffActive, member.name)}
                                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 ${
                                  member.isStaffActive
                                    ? 'text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700'
                                    : 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20'
                                }`}
                                title={member.isStaffActive ? "Pause job assignments for this technician" : "Resume job assignments for this technician"}
                              >
                                <Power size={13} />
                                <span>{member.isStaffActive ? "Pause" : "Resume"}</span>
                              </button>

                              {/* Edit Floor Tech Name */}
                              <button
                                onClick={() => startEditStaff({ id: member.staffId!, name: member.name })}
                                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                                title="Edit Name"
                              >
                                <Edit2 size={15} />
                              </button>

                              {/* Remove Floor Tech */}
                              <button
                                onClick={() => deleteStaff({ id: member.staffId!, name: member.name })}
                                className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors"
                                title="Remove Floor Technician"
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          ) : (
                            <>
                              {/* Reset Password */}
                              <button
                                onClick={() => setResetPasswordTarget(member.userObj)}
                                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 flex items-center gap-1.5 transition-all active:scale-95 shadow"
                                title="Reset this user's password directly"
                              >
                                <KeyRound size={13} />
                                <span>Reset Pass</span>
                              </button>

                              {/* Edit Profile & Role */}
                              <button
                                onClick={() => startEditUser(member.userObj)}
                                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                                title="Edit User Name & Role"
                              >
                                <Edit2 size={15} />
                              </button>

                              {/* Toggle job assignment capability if linked to staff */}
                              {member.staffId && (
                                <button
                                  onClick={() => handleToggleStaffActive(member.staffId!, member.isStaffActive, member.name)}
                                  className={`p-2 rounded-xl transition-colors ${
                                    member.isStaffActive
                                      ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                                      : 'text-rose-400 bg-rose-500/10 hover:bg-rose-500/20'
                                  }`}
                                  title={member.isStaffActive ? "Pause job assignment for this user" : "Resume job assignment for this user"}
                                >
                                  <Power size={15} />
                                </button>
                              )}

                              {/* Remove User */}
                              {member.profileId === profile?.id ? (
                                <span
                                  className="p-2 text-slate-700 cursor-not-allowed"
                                  title="You cannot remove your own active login"
                                >
                                  <Trash2 size={15} />
                                </span>
                              ) : (
                                <button
                                  onClick={() => deleteUser(member.profileId!, member.name)}
                                  className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors"
                                  title="Remove user from workshop"
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
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
                <p className="text-[10px] text-slate-400 mt-4 leading-relaxed italic">
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
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">API Token <span className="text-slate-400 normal-case font-normal">(from app.text.lk → Developers)</span></label>
                  <input
                    type="password"
                    placeholder="3388|uXAvFuPDOORLY..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-brand"
                    value={smsApiKey}
                    onChange={(e) => setSmsApiKey(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Sender ID <span className="text-slate-400 normal-case font-normal">(approved ID from app.text.lk → Sender IDs)</span></label>
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
                    <p className="text-[10px] text-slate-400 mt-0.5">Fires on: job in progress · job completed</p>
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

      <CreateStaffModal
        isOpen={isCreateStaffOpen}
        initialFullName={createStaffPrefill.fullName}
        initialRole={createStaffPrefill.role}
        onClose={() => {
          setIsCreateStaffOpen(false);
          setCreateStaffPrefill({});
        }}
        onSuccess={() => {
          fetchUsers();
          fetchStaff();
        }}
      />
      <AddFloorTechModal
        isOpen={isAddFloorTechOpen}
        onClose={() => setIsAddFloorTechOpen(false)}
        onSuccess={() => {
          fetchStaff();
        }}
      />
      <AdminResetPasswordModal
        isOpen={!!resetPasswordTarget}
        targetUser={resetPasswordTarget}
        onClose={() => setResetPasswordTarget(null)}
      />
    </div>
  );
};

function MFATab() {
  const { profile } = useAuth();
  const [factors, setFactors] = React.useState<any[]>([]);
  const [enrolling, setEnrolling] = React.useState(false);
  const [qrCode, setQrCode] = React.useState('');
  const [secret, setSecret] = React.useState('');
  const [factorId, setFactorId] = React.useState('');
  const [code, setCode] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState('');

  // Password change state
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [pwLoading, setPwLoading] = React.useState(false);
  const [pwMsg, setPwMsg] = React.useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    const clean = newPassword.trim();
    if (clean.length < 4) {
      setPwMsg({ text: 'Password must be at least 4 characters long.', type: 'error' });
      return;
    }
    if (clean !== confirmPassword.trim()) {
      setPwMsg({ text: 'Passwords do not match. Please verify.', type: 'error' });
      return;
    }
    setPwLoading(true);
    try {
      const { supabase } = await import('../lib/supabase');
      const { error } = await supabase.rpc('change_my_password', { p_new_password: clean });
      if (error) throw error;
      setPwMsg({ text: 'Password updated successfully! No email or SMS needed.', type: 'success' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwMsg({ text: err.message || 'Failed to update password.', type: 'error' });
    } finally {
      setPwLoading(false);
    }
  };

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
      {/* Change Password Card */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <KeyRound size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Change Password</h3>
            <p className="text-xs text-slate-400">Update your account password. No email or SMS required.</p>
          </div>
        </div>

        {pwMsg && (
          <div className={`mb-4 p-3 rounded-xl text-xs font-medium ${pwMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
            {pwMsg.text}
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-400">
            Account: <strong className="text-white">{profile?.full_name}</strong> · Username: <span className="text-cyan-400 font-mono">@{profile?.username || profile?.full_name?.toLowerCase()}</span> · Role: <span className="uppercase text-amber-400 font-bold">{profile?.role}</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min. 4 characters)"
                  required
                  minLength={4}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 pr-10 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                Confirm New Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                required
                minLength={4}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={pwLoading || !newPassword || !confirmPassword}
            className="btn-brand px-5 py-2.5 rounded-xl font-bold text-xs disabled:opacity-40 flex items-center gap-2"
          >
            <KeyRound size={14} />
            {pwLoading ? 'Updating…' : 'Save New Password'}
          </button>
        </form>
      </div>

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
              <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Or enter manually:</p>
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
              <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                log.action === 'deleted'
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                  : 'bg-slate-800 text-cyan-400'
              }`}>{log.action}</span>
              {/* Deletions carry entity_type + a label; without them the row just
                  said "deleted" with no indication of what was removed. */}
              {log.action === 'deleted' && (
                <>
                  <span className="text-xs text-slate-400">{String(log.entity_type || '').replace(/_/g, ' ')}</span>
                  {log.meta?.label && <span className="text-xs text-white font-medium">{log.meta.label}</span>}
                </>
              )}
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
