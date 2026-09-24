import React, { useState } from 'react';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { Wrench, Plus } from 'lucide-react';
import { tidyName } from '../lib/textCase';

interface AddFloorTechModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddFloorTechModal = ({
  isOpen,
  onClose,
  onSuccess,
}: AddFloorTechModalProps) => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanName = tidyName(name);
    if (!cleanName) {
      setError('Please enter a technician name.');
      return;
    }

    setLoading(true);
    try {
      const { error: insertError } = await supabase
        .from('staff')
        .insert({ tenant_id: profile?.tenant_id, name: cleanName, active: true });

      if (insertError) throw insertError;

      toast(`${cleanName} added as floor technician.`, 'success');
      setName('');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to add technician.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Floor Technician">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl flex items-start gap-2.5 text-xs text-cyan-300">
          <Wrench size={16} className="shrink-0 mt-0.5" />
          <span>
            Floor technicians can be assigned to job cards immediately. They do not need an email or login account. You can create a login account for them later with 1-click if needed.
          </span>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
            Technician Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Kasun Fernando"
            required
            autoFocus
            className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-brand"
          />
        </div>

        <div className="pt-2 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="flex-1 btn-brand py-2.5 rounded-xl font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            {loading ? 'Adding…' : 'Add Technician'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
