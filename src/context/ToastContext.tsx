import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} });

export const useToast = () => useContext(ToastContext);

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const COLORS = {
  success: 'border-emerald-500/40 text-emerald-400',
  error: 'border-red-500/40 text-red-400',
  info: 'border-cyan-500/40 text-cyan-400',
  warning: 'border-amber-500/40 text-amber-400',
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const dismiss = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {createPortal(
        <div className="fixed top-4 right-4 z-[99999] flex flex-col gap-2 pointer-events-none max-w-sm w-full pr-0">
          {toasts.map(t => {
            const Icon = ICONS[t.type];
            return (
              <div
                key={t.id}
                className={`flex items-start gap-3 px-4 py-3 rounded-xl border border-slate-700 bg-slate-900/95 backdrop-blur-md shadow-2xl pointer-events-auto animate-fade-in ${COLORS[t.type]}`}
              >
                <Icon size={16} className="mt-0.5 flex-shrink-0" />
                <span className="text-sm text-slate-200 flex-1 leading-snug">{t.message}</span>
                <button onClick={() => dismiss(t.id)} className="text-slate-600 hover:text-slate-300 transition-colors flex-shrink-0">
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
};
