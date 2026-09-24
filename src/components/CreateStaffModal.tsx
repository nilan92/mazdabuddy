import React, { useState } from 'react';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';
import { UserPlus, Eye, EyeOff, Copy, Check, Shield, Wrench, FileSpreadsheet, Briefcase } from 'lucide-react';

interface CreateStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialFullName?: string;
  initialRole?: 'technician' | 'manager' | 'accountant' | 'admin';
}

export const CreateStaffModal = ({
  isOpen,
  onClose,
  onSuccess,
  initialFullName,
  initialRole,
}: CreateStaffModalProps) => {
  const { toast } = useToast();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'technician' | 'manager' | 'accountant' | 'admin'>('technician');
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdInfo, setCreatedInfo] = useState<{
    fullName: string;
    username: string;
    password: string;
    role: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Auto-generate username and default password when full name changes (if username not edited manually)
  const handleNameChange = (name: string) => {
    setFullName(name);
    const clean = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!username || username === clean.slice(0, 10)) {
      setUsername(clean.slice(0, 12));
    }
    if (!password) {
      setPassword(clean ? `${clean}123` : '');
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      if (initialFullName) {
        handleNameChange(initialFullName);
      }
      if (initialRole) {
        setRole(initialRole);
      }
    } else {
      resetState();
    }
  }, [isOpen, initialFullName, initialRole]);

  const resetState = () => {
    setFullName('');
    setUsername('');
    setPassword('');
    setRole('technician');
    setEmail('');
    setShowPassword(false);
    setError(null);
    setCreatedInfo(null);
    setCopied(false);
    setLoading(false);
  };

  const handleClose = () => {
    if (createdInfo) {
      onSuccess();
    }
    resetState();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = fullName.trim();
    const cleanUser = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    const cleanPw = password.trim();

    if (!cleanName) {
      setError('Please enter a full name.');
      return;
    }
    if (cleanUser.length < 3) {
      setError('Username must be at least 3 characters (letters, numbers, underscores).');
      return;
    }
    if (cleanPw.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }

    setLoading(true);
    try {
      const { error: rpcError } = await supabase.rpc('create_staff_member', {
        p_full_name: cleanName,
        p_username: cleanUser,
        p_password: cleanPw,
        p_role: role,
        p_email: email.trim() || null,
      });

      if (rpcError) {
        throw rpcError;
      }

      setCreatedInfo({
        fullName: cleanName,
        username: cleanUser,
        password: cleanPw,
        role,
      });
      toast(`Account for ${cleanName} created!`, 'success');
      onSuccess();
    } catch (err: any) {
      console.error('Create staff error:', err);
      setError(err?.message || 'Failed to create staff member.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCredentials = async () => {
    if (!createdInfo) return;
    const text = `AutoPulse Login Credentials:\nFull Name: ${createdInfo.fullName}\nUsername: ${createdInfo.username}\nPassword: ${createdInfo.password}\nRole: ${createdInfo.role.toUpperCase()}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast('Credentials copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Staff Account">
      {createdInfo ? (
        <div className="space-y-4 py-2">
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-2">
              <Check size={24} />
            </div>
            <h3 className="text-lg font-bold text-white">Staff Login Ready!</h3>
            <p className="text-xs text-slate-300 mt-1">
              Account created successfully. They can now log in immediately using their username.
            </p>
          </div>

          <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Full Name:</span>
              <span className="text-white font-bold">{createdInfo.fullName}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Username:</span>
              <span className="text-brand font-mono font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                {createdInfo.username}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Password:</span>
              <span className="text-white font-mono font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                {createdInfo.password}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Role:</span>
              <span className="uppercase text-[11px] font-black tracking-wider text-amber-400">
                {createdInfo.role}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCopyCredentials}
              className="flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy Credentials'}
            </button>
            <button
              onClick={handleClose}
              className="flex-1 btn-brand py-2.5 rounded-xl text-xs font-bold transition-transform active:scale-95"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-xs text-slate-400 leading-relaxed">
            Create a technician or staff login directly. No email address or invite link is needed.
          </p>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
              Full Name *
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Manusha Perera"
              required
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-brand"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                Username *
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="e.g. manusha"
                required
                minLength={3}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-brand"
              />
              <span className="text-[10px] text-slate-500">For signing in</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                Initial Password *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 4 characters"
                  required
                  minLength={4}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 pr-9 text-white font-mono text-sm focus:outline-none focus:border-brand"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <span className="text-[10px] text-slate-500">Can be changed later</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
              System Role *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'technician', label: 'Technician', icon: Wrench, desc: 'Jobs & diagnostics only. No financial data.' },
                { id: 'manager', label: 'Manager', icon: Briefcase, desc: 'Manage jobs, inventory, customers & invoices.' },
                { id: 'accountant', label: 'Accountant', icon: FileSpreadsheet, desc: 'Financial reports & invoices.' },
                { id: 'admin', label: 'Admin', icon: Shield, desc: 'Full workshop management access.' },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = role === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRole(item.id as any)}
                    className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                      isSelected
                        ? 'border-brand bg-brand-soft/30 text-white'
                        : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon size={14} className={isSelected ? 'text-brand' : 'text-slate-400'} />
                      <span className="text-xs font-bold">{item.label}</span>
                    </div>
                    <span className="text-[9px] text-slate-500 leading-tight">{item.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
              Email Address <span className="text-slate-500 font-normal normal-case">(Optional)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="technician@example.com (optional)"
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:border-brand"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Leave blank if they do not have an email. An internal login ID will be created automatically.
            </p>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !fullName.trim() || !username.trim() || !password.trim()}
              className="flex-1 btn-brand py-2.5 rounded-xl font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <UserPlus size={16} />
              {loading ? 'Creating…' : 'Create Account'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
