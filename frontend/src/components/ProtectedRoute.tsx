import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export function ProtectedRoute({ roles }: { roles?: string[] }) {
  const { isAuthenticated, isLoading, user, isOfflineSession } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="loading-center">
        <div className="spinner" aria-label="Memuat..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <>
      {isOfflineSession && (
        <div className="alert alert-warning" role="status">
          Mode offline: memakai sesi lokal terakhir. Perubahan ke server menunggu koneksi.
        </div>
      )}
      <Outlet />
    </>
  );
}
