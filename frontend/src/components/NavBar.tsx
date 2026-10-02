import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg className="navbar-toggle-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {open ? (
        <path
          fill="currentColor"
          d="M18.3 5.71 12 12.01 5.7 5.7 4.29 7.11 10.59 13.4 4.29 19.7 5.7 21.11 12 14.83l6.3 6.28 1.41-1.41-6.29-6.3 6.3-6.29z"
        />
      ) : (
        <path fill="currentColor" d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
      )}
    </svg>
  );
}

export function NavBar() {
  const { user, logout, isAuthenticated } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!isAuthenticated) return null;

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  const link = (to: string, label: string) => (
    <Link
      key={to}
      to={to}
      className={isActive(to) ? 'active' : undefined}
      onClick={() => setOpen(false)}
    >
      {label}
    </Link>
  );

  return (
    <nav className={`navbar${open ? ' is-open' : ''}`}>
      <a className="skip-link" href="#main-content">
        Lewati ke konten
      </a>
      <div className="navbar-inner">
        <Link to="/dashboard" className="navbar-brand">
          Agri<span>Fusion</span>Net
        </Link>
        <button
          type="button"
          className="navbar-toggle"
          aria-label={open ? 'Tutup menu' : 'Menu'}
          aria-expanded={open}
          aria-controls="navbar-links"
          onClick={() => setOpen((value) => !value)}
        >
          <MenuIcon open={open} />
        </button>
        {open && <div className="navbar-scrim" aria-hidden="true" onClick={() => setOpen(false)} />}
        <div id="navbar-links" className={`navbar-links${open ? ' open' : ''}`}>
          {link('/dashboard', 'Dasbor')}
          {link('/analysis', 'Analisis Tanaman')}
          {link('/farms', 'Lahan')}
          {link('/crop-cycles', 'Siklus Tanam')}
          {link('/predictions', 'Log Riwayat')}
          {link('/features/offline', 'Offline')}
          {(user?.role === 'admin' || user?.role === 'superadmin') &&
            link('/admin/farmers', 'Admin')}
          {user?.role === 'superadmin' && link('/admin/reference', 'Referensi')}
          {user?.role === 'superadmin' && link('/admin/audit', 'Log Audit')}
          <button type="button" className="btn btn-secondary navbar-logout" onClick={() => logout()}>
            Keluar
          </button>
        </div>
      </div>
    </nav>
  );
}
