import { expect, type Page } from '@playwright/test';

export const PORTRAIT_375 = { name: 'portrait-375', width: 375, height: 812 } as const;
export const LANDSCAPE_667 = { name: 'landscape-667x375', width: 667, height: 375 } as const;

export const MOBILE_ACCEPTANCE_VIEWPORTS = [PORTRAIT_375, LANDSCAPE_667] as const;

export type AcceptanceViewport = (typeof MOBILE_ACCEPTANCE_VIEWPORTS)[number];

const TOUCH_MIN = 44;

type OverflowEl = {
  tag: string;
  className: string;
  left: number;
  right: number;
  width: number;
  text: string;
};

type SmallTarget = {
  tag: string;
  className: string;
  w: number;
  h: number;
  text: string;
};

export async function assertNoPageOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const vw = window.innerWidth;
    const doc = document.documentElement;
    const overflowing: OverflowEl[] = [];
    const skip = new Set(['HTML', 'BODY', 'SCRIPT', 'STYLE', 'LINK', 'META']);
    for (const el of document.querySelectorAll('*')) {
      if (skip.has(el.tagName)) continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 && r.height < 1) continue;
      const className = typeof el.className === 'string' ? el.className : '';
      if (className.includes('skip-link') && r.top < 0) continue;
      if (className.includes('navbar-scrim')) continue;
      const visiblyOverflowsRight = r.right > vw + 2 && r.left < vw;
      const visiblyOverflowsLeft = r.left < -2 && r.right > 0;
      if (visiblyOverflowsRight || visiblyOverflowsLeft) {
        overflowing.push({
          tag: el.tagName.toLowerCase(),
          className: className.slice(0, 80),
          left: Math.round(r.left),
          right: Math.round(r.right),
          width: Math.round(r.width),
          text: (el.textContent || '').replace(/\s+/g, ' ').slice(0, 60),
        });
      }
    }
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      overflowing: overflowing.slice(0, 8),
    };
  });
  expect(
    overflow.scrollWidth,
    `horizontal overflow ${overflow.scrollWidth} > ${overflow.clientWidth}`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
  expect(overflow.overflowing, JSON.stringify(overflow.overflowing, null, 2)).toEqual([]);
}

export async function assertComfortableTargets(page: Page): Promise<void> {
  const smallTargets = await page.evaluate((min) => {
    const found: SmallTarget[] = [];
    for (const el of document.querySelectorAll(
      'button, a, input, select, textarea, summary, [role="button"], [role="option"]',
    )) {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      if (el.getAttribute('aria-hidden') === 'true') continue;
      const className = typeof el.className === 'string' ? el.className : '';
      if (className.includes('skip-link')) {
        const skipBox = el.getBoundingClientRect();
        if (skipBox.top < 0) continue;
      }
      const hit =
        el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')
          ? (el.closest('label, .form-check') ?? el)
          : el;
      const r = hit.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (r.height + 0.51 < min || r.width + 0.51 < min) {
        found.push({
          tag: el.tagName.toLowerCase(),
          className: className.slice(0, 80),
          w: Math.round(r.width),
          h: Math.round(r.height),
          text: (el.textContent || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').slice(0, 40),
        });
      }
    }
    return found.slice(0, 12);
  }, TOUCH_MIN);
  expect(smallTargets, JSON.stringify(smallTargets, null, 2)).toEqual([]);
}

export async function assertDialogFits(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  const vp = page.viewportSize();
  expect(box).toBeTruthy();
  expect(vp).toBeTruthy();
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(vp!.width + 1);
  expect(box!.y).toBeGreaterThanOrEqual(-1);
  expect(box!.height).toBeLessThanOrEqual(vp!.height + 1);
}

export async function assertAuthCardCentered(page: Page): Promise<void> {
  const card = page.locator('.auth-card');
  await expect(card).toBeVisible();
  const box = await card.boundingBox();
  const viewport = page.viewportSize();
  expect(box).toBeTruthy();
  expect(viewport).toBeTruthy();
  const cardCenter = box!.x + box!.width / 2;
  expect(Math.abs(cardCenter - viewport!.width / 2)).toBeLessThanOrEqual(1);
}

export async function assertLayout(
  page: Page,
  shotName: string,
  options: { screenshot?: boolean } = {},
): Promise<void> {
  await assertNoPageOverflow(page);
  await assertComfortableTargets(page);
  if (options.screenshot !== false) {
    await page.screenshot({
      path: `test-results/responsive-acceptance/${shotName}.png`,
      fullPage: true,
    });
  }
}

export async function openMobileNav(page: Page): Promise<void> {
  const menu = page.getByRole('button', { name: 'Menu' });
  await expect(menu).toBeVisible();
  if ((await menu.getAttribute('aria-expanded')) !== 'true') {
    await menu.click();
  }
  await expect(page.locator('#navbar-links')).toBeVisible();
}

export async function closeMobileNav(page: Page): Promise<void> {
  const toggle = page.getByRole('button', { name: /Menu|Tutup menu/ });
  if ((await toggle.getAttribute('aria-expanded')) === 'true') {
    await page.keyboard.press('Escape');
  }
}
