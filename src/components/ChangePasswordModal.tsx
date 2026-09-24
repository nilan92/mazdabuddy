import React, { useState } from 'react';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';
import { KeyRound, Eye, EyeOff, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangePasswordModal = ({ isOpen, onClose }: ChangePasswordModalProps) => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const resetState = () => {
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirm(false);
    setError(null);
    setSuccess(false);
    setLoading(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = newPassword.trim();
    if (trimmed.length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }

    if (trimmed !== confirmPassword.trim()) {
      setError('Passwords do not match. Please verify.');
      return;
    }

    setLoading(true);
    try {
      const { error: rpcError } = await supabase.rpc('change_my_password', {
        p_new_password: trimmed,
      });

      if (rpcError) {
        throw rpcError;
      }

      setSuccess(true);
      toast('Password changed successfully!', 'success');
    } catch (err: any) {
      console.error('Password change error:', err);
      setError(err?.message || 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Change Your Password">
      {success ? (
        <div className="text-center py-4 space-y-4">
          <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto">
            <CheckCircle2 size={36} />
          </div>
          <h3 className="text-xl font-bold text-white">Password Updated!</h3>
          <p className="text-sm text-slate-300 max-w-sm mx-auto leading-relaxed">
            Your new password is now active. No email or SMS confirmation was needed.
          </p>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-400">
            Next time you sign in, log in with username <strong className="text-brand font-mono">{profile?.username || profile?.full_name?.toLowerCase()}</strong> and your new password.
          </div>
          <button
            onClick={handleClose}
            className="w-full btn-brand py-3 rounded-xl font-bold text-sm mt-2"
          >
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800 mb-2">
            <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
              <ShieldCheck size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">
                {profile?.full_name || 'Account Security'}
              </p>
              <p className="text-[10px] text-slate-400 font-mono">
                Username: @{profile?.username || profile?.full_name?.toLowerCase() || 'user'} · Role: {profile?.role}
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            You can set a new password directly below. No email or SMS verification is required.
          </p>

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
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 pr-10 text-white text-sm focus:outline-none focus:border-brand"
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
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                required
                minLength={4}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 pr-10 text-white text-sm focus:outline-none focus:border-brand"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
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
              disabled={loading || !newPassword || !confirmPassword}
              className="flex-1 btn-brand py-2.5 rounded-xl font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <KeyRound size={16} />
              {loading ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
