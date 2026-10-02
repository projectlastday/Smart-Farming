import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { queryClient } from '@/app/queryClient';
import { router } from '@/app/router';
import { AuthProvider } from '@/hooks/useAuth';
import { PwaUpdateBanner } from '@/components/PwaUpdateBanner';
import '@/styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PwaUpdateBanner />
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
