import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="auth-page">
      <main id="main-content" className="container" tabIndex={-1}>
        <div className="card auth-card">
          <h1>Halaman tidak ditemukan</h1>
          <p className="subtitle">Alamat yang dibuka tidak ada di AgriFusionNet.</p>
          <p className="form-actions">
            <Link className="btn btn-primary" to="/dashboard">
              Kembali ke dasbor
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
