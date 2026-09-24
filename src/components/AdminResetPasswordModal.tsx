import React, { useState } from 'react';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';
import { KeyRound, Eye, EyeOff, ShieldAlert } from 'lucide-react';

interface AdminResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: {
    id: string;
    full_name: string;
    username?: string;
    role: string;
  } | null;
}

export const AdminResetPasswordModal = ({
  isOpen,
  onClose,
  targetUser,
}: AdminResetPasswordModalProps) => {
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetState = () => {
    setNewPassword('');
    setShowPassword(false);
    setError(null);
    setLoading(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser) return;
    setError(null);

    const cleanPw = newPassword.trim();
    if (cleanPw.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }

    setLoading(true);
    try {
      const { error: rpcError } = await supabase.rpc('admin_set_user_password', {
        p_user_id: targetUser.id,
        p_new_password: cleanPw,
      });

      if (rpcError) {
        throw rpcError;
      }

      toast(`Password for ${targetUser.full_name} updated!`, 'success');
      handleClose();
    } catch (err: any) {
      console.error('Reset password error:', err);
      setError(err?.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Reset Staff Password">
      <form onSubmit={handleSubmit} className="space-y-4">
        {targetUser && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              {targetUser.full_name.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">{targetUser.full_name}</p>
              <p className="text-xs text-slate-400">
                Username: <span className="text-brand font-mono">@{targetUser.username || targetUser.full_name.toLowerCase()}</span> · Role: <span className="uppercase text-amber-400 font-bold">{targetUser.role}</span>
              </p>
            </div>
          </div>
        )}

        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-xs text-amber-300">
          <ShieldAlert size={16} className="shrink-0 mt-0.5" />
          <span>
            This will immediately update their password without requiring email or phone confirmation. Provide the new password directly to the staff member.
          </span>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
            New Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password (min. 4 characters)"
              required
              minLength={4}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 pr-10 text-white font-mono text-sm focus:outline-none focus:border-brand"
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
            disabled={loading || !newPassword.trim()}
            className="flex-1 btn-brand py-2.5 rounded-xl font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <KeyRound size={16} />
            {loading ? 'Resetting…' : 'Set Password'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
