import { expect, test as base } from '@playwright/test';

// Tests never touch the internet. The basemap is replaced by an empty style, and the files host by a 1x1 image,
// so a test fails only when this site is wrong, not when a third party is slow.
const EMPTY_STYLE = {
  version: 8,
  name: 'e2e',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#d8dee3' } }],
};
export const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

/** What the stubbed files host serves, so tests can check the bytes that come back out of a download. */
export const STUB_PDF = Buffer.from('%PDF-1.4 e2e stub');
export const STUB_TEXT = Buffer.from('Donn\xe9es sur l\'intensit\xe9\n2025/12/5\n', 'latin1');

export const test = base.extend<{ allowedConsoleErrors: RegExp[] }>({
  allowedConsoleErrors: [[], { option: true }],
  page: async ({ page, allowedConsoleErrors }, use) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (error) => consoleErrors.push(String(error)));
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.route('https://tiles.openfreemap.org/**', (route) => {
      const url = route.request().url();
      if (url.includes('/styles/')) return route.fulfill({ json: EMPTY_STYLE });
      if (url.includes('/fonts/')) return route.fulfill({ body: '', contentType: 'application/x-protobuf' });
      return route.abort();
    });
    await page.route('https://server.arcgisonline.com/**', (route) => route.fulfill({
      body: PIXEL, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' },
    }));
    await page.route('https://eccc-idf-files.andreschardong.workers.dev/**', (route) => {
      const url = route.request().url();
      const cors = { 'access-control-allow-origin': '*' };
      if (url.endsWith('.pdf')) return route.fulfill({ body: STUB_PDF, contentType: 'application/pdf', headers: cors });
      if (url.endsWith('.txt')) return route.fulfill({ body: STUB_TEXT, contentType: 'text/plain', headers: cors });
      return route.fulfill({ body: PIXEL, contentType: 'image/png', headers: cors });
    });

    await use(page);
    const unexpected = consoleErrors.filter((message) => !allowedConsoleErrors.some((pattern) => pattern.test(message)));
    expect(unexpected, 'the page logged errors to the console').toEqual([]);
  },
});

export { expect };

/** Opens the page and waits until the map has drawn its stations. */
export async function openExplorer(page: import('@playwright/test').Page, hash = ''): Promise<void> {
  await page.goto(`/${hash}`);
  await expect(page.locator('#map')).toHaveAttribute('data-map-ready', 'true', { timeout: 30_000 });
}

export const mapCounts = async (page: import('@playwright/test').Page): Promise<{ groups: number; singles: number }> => ({
  groups: Number(await page.locator('#map').getAttribute('data-groups')),
  singles: Number(await page.locator('#map').getAttribute('data-singles')),
});
