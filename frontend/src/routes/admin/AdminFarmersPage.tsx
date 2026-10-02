import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createAdminUser } from '@/services/auth';
import { apiFetch, ApiClientError } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import type { User } from '@/types';

export function AdminFarmersPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [role, setRole] = useState('farmer');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  const farmersQuery = useQuery({
    queryKey: ['admin-farmers'],
    queryFn: () => apiFetch<User[]>('/admin/farmers'),
  });

  const mutation = useMutation({
    mutationFn: () => createAdminUser({ name, email, password, phone: phone || undefined, role }),
    onSuccess: (data) => {
      setResult(`Akun ${data.email} berhasil dibuat dan siap digunakan.`);
      setName('');
      setEmail('');
      setPhone('');
      setPassword('');
      setPasswordConfirmation('');
      setError('');
      void qc.invalidateQueries({ queryKey: ['admin-farmers'] });
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiClientError ? err.message : 'Gagal membuat akun');
      setResult('');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enable }: { id: string; enable: boolean }) => {
      const path = enable ? `/admin/farmers/${id}/enable` : `/admin/farmers/${id}/disable`;
      return apiFetch<{ message: string }>(path, { method: 'POST' });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-farmers'] }),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (password !== passwordConfirmation) {
      setError('Konfirmasi kata sandi tidak sama');
      return;
    }
    mutation.mutate();
  };

  const canCreateAdmin = user?.role === 'superadmin';

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Kelola Akun Petani</h1>
          <p>
            {canCreateAdmin
              ? 'Superadmin dapat membuat petani atau admin dengan kata sandi langsung.'
              : 'Admin dapat membuat akun petani, melihat daftar, dan menonaktifkan petani.'}
          </p>
        </div>
      </div>

      <div className="card">
        <h3>Buat Akun Baru</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="admin-name">Nama</label>
            <input id="admin-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="admin-email">Email</label>
            <input id="admin-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="admin-phone">Telepon</label>
            <input id="admin-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="admin-password">Kata Sandi</label>
            <input id="admin-password" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="admin-password-confirmation">Konfirmasi Kata Sandi</label>
            <input id="admin-password-confirmation" type="password" minLength={8} required value={passwordConfirmation} onChange={(e) => setPasswordConfirmation(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="admin-role">Peran</label>
            <select id="admin-role" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="farmer">Petani</option>
              {canCreateAdmin && <option value="admin">Admin</option>}
            </select>
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
            Buat Akun
          </button>
        </form>

        {result && (
          <div className="alert alert-success" style={{ marginTop: '1rem' }}>
            <p>{result}</p>
          </div>
        )}
      </div>

      <div className="card table-card">
        <h3>Daftar petani</h3>
        {farmersQuery.isError ? (
          <div className="alert alert-error" role="alert">
            Gagal memuat daftar petani.{' '}
            <button type="button" className="btn btn-secondary" onClick={() => void farmersQuery.refetch()}>
              Coba lagi
            </button>
          </div>
        ) : (farmersQuery.data ?? []).length === 0 ? (
          <p className="empty-state">Belum ada akun petani.</p>
        ) : (
          <div className="table-scroll" role="region" aria-label="Daftar petani" tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {(farmersQuery.data ?? []).map((farmer) => (
                  <tr key={farmer.id}>
                    <td data-label="Nama">{farmer.name}</td>
                    <td data-label="Email">{farmer.email}</td>
                    <td data-label="Status">{farmer.status === 'active' ? 'Aktif' : 'Nonaktif'}</td>
                    <td data-label="Aksi">
                      {farmer.status === 'active' ? (
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => toggleMutation.mutate({ id: farmer.id, enable: false })}
                        >
                          Nonaktifkan
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => toggleMutation.mutate({ id: farmer.id, enable: true })}
                        >
                          Aktifkan
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
