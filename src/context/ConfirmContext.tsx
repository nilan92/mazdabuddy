import { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  confirmStyle?: 'danger' | 'warning' | 'default';
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(async () => false);

export const useConfirm = () => useContext(ConfirmContext);

export const ConfirmProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<(ConfirmOptions & { visible: boolean }) | null>(null);
  const resolveRef = useRef<(val: boolean) => void>(() => {});

  const confirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    const opts = typeof options === 'string' ? { message: options } : options;
    return new Promise(resolve => {
      resolveRef.current = resolve;
      setState({ ...opts, visible: true });
    });
  }, []);

  const handle = (result: boolean) => {
    setState(null);
    resolveRef.current(result);
  };

  const styleMap = {
    danger: 'bg-red-600 hover:bg-red-500',
    warning: 'bg-amber-600 hover:bg-amber-500',
    default: 'bg-brand hover:brightness-110',
  };
  const btnStyle = styleMap[state?.confirmStyle ?? 'danger'];

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state?.visible && createPortal(
        <div
          className="fixed inset-0 z-[99998] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => handle(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-4 mb-6">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <div>
                {state.title && <h3 className="font-bold text-white mb-1">{state.title}</h3>}
                <p className="text-slate-300 text-sm leading-relaxed">{state.message}</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => handle(false)}
                className="px-4 py-2 rounded-xl text-sm font-bold text-slate-400 bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handle(true)}
                className={`px-4 py-2 rounded-xl text-sm font-bold text-white transition-colors active:scale-95 ${btnStyle}`}
              >
                {state.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </ConfirmContext.Provider>
  );
};
