import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

export function PwaUpdateBanner() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [update, setUpdate] = useState<((reload?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh() {
        setNeedRefresh(true);
      },
    });
    setUpdate(() => updateSW);
  }, []);

  if (!needRefresh || !update) {
    return null;
  }

  return (
    <div className="pwa-update-banner" role="status">
      <p>Versi aplikasi baru tersedia. Memuat ulang tidak menghapus antrian offline.</p>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => {
          void update(true);
        }}
      >
        Perbarui sekarang
      </button>
      <button type="button" className="btn btn-secondary" onClick={() => setNeedRefresh(false)}>
        Nanti
      </button>
    </div>
  );
}
