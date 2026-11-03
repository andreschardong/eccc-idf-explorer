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
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

export const test = base.extend({
  page: async ({ page }, use) => {
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
    await page.route('https://eccc-idf-files.andreschardong.workers.dev/**', (route) => route.fulfill({ body: PIXEL, contentType: 'image/png' }));

    await use(page);
    expect(consoleErrors, 'the page logged errors to the console').toEqual([]);
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
