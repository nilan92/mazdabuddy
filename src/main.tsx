import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { AuthProvider } from './context/AuthContext';

// 1. Configure Cache Persistence (Offline Support)
// This saves all query results to LocalStorage so they load instantly next time
const persister = createSyncStoragePersister({
  storage: window.localStorage,
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, 
      staleTime: 1000 * 60 * 5, // 5 Minutes (Increased for better offline feel)
      gcTime: 1000 * 60 * 60 * 24, // 24 Hours (Keep cache for a day)
      retry: 1, 
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
