import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { AuthProvider } from './context/AuthContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 1. Don't refetch immediately when window gains focus
      refetchOnWindowFocus: false, 
      
      // 2. Keep data "fresh" for 2 minutes (prevents spinner if they go back and forth)
      staleTime: 1000 * 60 * 2, 
      
      // 3. Retry only once on error (stops the infinite loading loops)
      retry: 1, 
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
