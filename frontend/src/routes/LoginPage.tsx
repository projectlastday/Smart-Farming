import { FormEvent, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { login } from '@/services/auth';
import { ApiClientError } from '@/services/api';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/dashboard';

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: async (session) => {
      qc.setQueryData(['session'], session);
      try {
        sessionStorage.setItem('agrifusion_last_user', JSON.stringify(session.user));
      } catch {
        /* ignore */
      }
      navigate(from, { replace: true });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Gagal masuk. Periksa koneksi Anda.');
      }
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    mutation.mutate({ email, password });
  };

  return (
    <div className="auth-page">
      <a className="skip-link" href="#login-form">
        Lewati ke formulir masuk
      </a>
      <main id="main-content" className="container" tabIndex={-1}>
      <div className="card auth-card">
        <h1>AgriFusionNet</h1>
        <p className="subtitle">Masuk ke akun anda</p>
        {error && (
          <div id="login-error" className="alert alert-error" role="alert">
            {error}
          </div>
        )}
        <form id="login-form" onSubmit={handleSubmit} aria-describedby={error ? 'login-error' : undefined}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Kata Sandi</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={mutation.isPending}>
            {mutation.isPending ? 'Memproses...' : 'Masuk'}
          </button>
        </form>
        <p className="auth-footer">
          Belum punya akun? <Link to="/register">Daftar</Link>
        </p>
      </div>
      </main>
    </div>
  );
}
