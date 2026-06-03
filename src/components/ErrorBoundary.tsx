import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isChunkError: boolean;
}

const CHUNK_RELOAD_KEY = 'autopulse_chunk_reload';

function isChunkLoadError(error: Error) {
  return (
    error.message.includes('Importing a module script failed') ||
    error.message.includes('Failed to fetch dynamically imported module') ||
    error.message.includes('error loading dynamically imported module')
  );
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    isChunkError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, isChunkError: isChunkLoadError(error) };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);

    if (isChunkLoadError(error) && !sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
      window.location.reload();
    }
  }

  public render() {
    if (this.state.hasError) {
      if (this.state.isChunkError) {
        return (
          <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-8 max-w-md w-full shadow-2xl text-center">
              <RefreshCw size={40} className="text-cyan-400 mx-auto mb-4 animate-spin" />
              <h1 className="text-xl font-bold text-white mb-2">New version available</h1>
              <p className="text-slate-400 mb-6">Reloading to apply the latest update…</p>
              <button
                onClick={() => window.location.reload()}
                className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold transition-colors"
              >
                Reload now
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/50 rounded-2xl p-8 max-w-md w-full shadow-2xl shadow-red-500/10">
            <div className="flex items-center gap-3 text-red-500 mb-4">
              <AlertTriangle size={32} />
              <h1 className="text-2xl font-bold">Something went wrong</h1>
            </div>
            <p className="text-slate-300 mb-4">
              The application encountered an error and crashed.
            </p>
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-xs text-red-400 overflow-auto mb-6 max-h-40">
              {this.state.error?.message}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
