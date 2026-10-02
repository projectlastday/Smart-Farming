import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { NavBar } from '@/components/NavBar';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: '1', name: 'Petani', email: 'petani@example.com', phone: null, role: 'farmer', status: 'active', must_change_password: false },
    logout: vi.fn(),
    isAuthenticated: true,
    isLoading: false,
    refreshSession: vi.fn(),
  }),
}));

describe('NavBar', () => {
  it('exposes a skip link and collapsible menu controls', () => {
    render(
      <MemoryRouter>
        <NavBar />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Lewati ke konten' })).toHaveAttribute('href', '#main-content');
    const toggle = screen.getByRole('button', { name: 'Menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Tutup menu' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Analisis Tanaman' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Log Riwayat' })).toBeVisible();
  });
});
