import { test, expect, type Page } from '@playwright/test';
import { loginAsDemo } from './session';

async function contrastRatio(page: Page, selector: string): Promise<number> {
  return page.locator(selector).evaluate((el) => {
    const style = getComputedStyle(el);
    const parse = (color: string) => {
      const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!m) return [0, 0, 0];
      return [Number(m[1]), Number(m[2]), Number(m[3])];
    };
    const channel = (c: number) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const lum = (rgb: number[]) => 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
    let bgEl: HTMLElement | null = el as HTMLElement;
    let bg = parse(style.backgroundColor);
    while (bgEl && bg[0] === 0 && bg[1] === 0 && bg[2] === 0 && getComputedStyle(bgEl).backgroundColor === 'rgba(0, 0, 0, 0)') {
      bgEl = bgEl.parentElement;
      if (!bgEl) break;
      bg = parse(getComputedStyle(bgEl).backgroundColor);
    }
    const fg = parse(style.color);
    const l1 = lum(fg);
    const l2 = lum(bg[0] === 0 && bg[1] === 0 && bg[2] === 0 ? [244, 247, 240] : bg);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  });
}

test.describe('Accessibility', () => {
  test('login labels, skip link, 44px target, contrast', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Kata Sandi')).toBeVisible();
    const skip = page.getByRole('link', { name: 'Lewati ke formulir masuk' });
    await skip.focus();
    await expect(skip).toBeVisible();
    const submit = page.getByRole('button', { name: 'Masuk' });
    const box = await submit.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    const headingContrast = await contrastRatio(page, 'h1');
    expect(headingContrast).toBeGreaterThanOrEqual(4.5);
  });

  test('200% zoom equivalent (640px) keeps login usable without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 400 });
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'AgriFusionNet' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Masuk' })).toBeVisible();
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 2);
  });

  test('reduced motion is honored by the stylesheet', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/login');
    const reduced = await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    expect(reduced).toBe(true);
    const durationMs = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.className = 'progress-bar-fill';
      document.body.appendChild(probe);
      const raw = getComputedStyle(probe).transitionDuration;
      probe.remove();
      return raw.split(',').map((part) => {
        const value = part.trim();
        if (value.endsWith('ms')) return Number.parseFloat(value);
        if (value.endsWith('s')) return Number.parseFloat(value) * 1000;
        return Number.NaN;
      })[0];
    });
    expect(durationMs).toBeLessThan(50);
  });

  test('authenticated skip link and menu name for screen readers', async ({ page }) => {
    await loginAsDemo(page);
    await expect(page.getByRole('heading', { name: /Selamat datang/i })).toBeVisible();
    const skip = page.getByRole('link', { name: 'Lewati ke konten' });
    await expect(skip).toHaveAttribute('href', '#main-content');
    await skip.focus();
    await expect(skip).toBeFocused();
    const menu = page.getByRole('button', { name: 'Menu' });
    if (await menu.isVisible()) {
      await expect(menu).toHaveAttribute('aria-expanded', /false|true/);
    } else {
      await expect(page.getByRole('navigation').getByRole('link', { name: 'Dasbor' })).toBeVisible();
    }
  });
});
