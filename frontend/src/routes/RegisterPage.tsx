import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { register } from '@/services/auth';
import { ApiClientError } from '@/services/api';

export function RegisterPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: register,
    onSuccess: async (session) => {
      qc.setQueryData(['session'], session);
      navigate('/dashboard', { replace: true });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Registrasi gagal. Periksa koneksi Anda.');
      }
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    mutation.mutate({ name, email, password, phone: phone || undefined });
  };

  return (
    <div className="auth-page">
      <a className="skip-link" href="#register-form">
        Lewati ke formulir daftar
      </a>
      <main id="main-content" className="container" tabIndex={-1}>
      <div className="card auth-card">
        <h1>Daftar Petani</h1>
        <p className="subtitle">Buat akun AgriFusionNet baru</p>
        {error && (
          <div id="register-error" className="alert alert-error" role="alert">
            {error}
          </div>
        )}
        <form id="register-form" onSubmit={handleSubmit} aria-describedby={error ? 'register-error' : undefined}>
          <div className="form-group">
            <label htmlFor="name">Nama Lengkap</label>
            <input id="name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="phone">Telepon (opsional)</label>
            <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="password">Kata Sandi (min. 8 karakter)</label>
            <input
              id="password"
              type="password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={mutation.isPending}>
            {mutation.isPending ? 'Memproses...' : 'Daftar'}
          </button>
        </form>
        <p className="auth-footer">
          Sudah punya akun? <Link to="/login">Masuk</Link>
        </p>
      </div>
      </main>
    </div>
  );
}
