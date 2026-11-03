import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, openExplorer, test } from './fixtures';

// WCAG 2.2 A and AA, plus the best-practice rules axe ships.
const scan = async (page: Page): Promise<string[]> => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  return results.violations.map((v) => `${v.impact}: ${v.id} (${v.nodes.length} nodes) ${v.help}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
};

test.describe('accessibility scan (axe-core)', () => {
  test('start page', async ({ page }) => {
    await openExplorer(page);
    expect(await scan(page)).toEqual([]);
  });

  for (const [name, hash] of [
    ['curves', '#/station/6158355/curves'],
    ['tables', '#/station/6158355/tables'],
    ['annual maxima', '#/station/6158355/annual'],
    ['calculator', '#/station/6158355/calc'],
    ['files', '#/station/6158355/files'],
    ['a station with unanalysed durations', '#/station/1012055/curves'],
  ] as const) {
    test(`station: ${name}`, async ({ page }) => {
      await openExplorer(page, hash);
      await expect(page.locator('#station-title')).toBeVisible();
      expect(await scan(page)).toEqual([]);
    });
  }

  test('the Files tab with the station text open and another plot chosen', async ({ page }) => {
    await openExplorer(page, '#/station/6158355/files');
    await page.getByRole('button', { name: 'Return levels' }).click();
    await page.getByRole('button', { name: 'View text' }).click();
    await expect(page.locator('#panel-files pre')).toBeVisible();
    expect(await scan(page)).toEqual([]);
  });

  test('the About dialog', async ({ page }) => {
    await openExplorer(page);
    await page.getByRole('button', { name: 'About', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await scan(page)).toEqual([]);
  });

  test('the search results list', async ({ page }) => {
    await openExplorer(page);
    await page.getByRole('combobox', { name: /search stations/i }).fill('toronto');
    await expect(page.getByRole('option').first()).toBeVisible();
    expect(await scan(page)).toEqual([]);
  });

  test('dark theme, station page', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await openExplorer(page, '#/station/6158355/curves');
    await expect(page.locator('#station-title')).toBeVisible();
    expect(await scan(page)).toEqual([]);
  });

  test('every control can be reached with the keyboard alone', async ({ page }) => {
    await openExplorer(page, '#/station/6158355/curves');
    const reached = new Set<string>();
    for (let i = 0; i < 60; i += 1) {
      await page.keyboard.press('Tab');
      reached.add(await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return el ? (el.getAttribute('aria-label') ?? el.textContent ?? el.tagName).trim().slice(0, 40) : '';
      }));
    }
    for (const expected of ['Skip to station details', 'About', 'IDF_CC tool', 'Source code', 'Switch colour theme', 'Download CSV', 'Download JSON', 'Copy link', 'Curves']) {
      expect([...reached].some((label) => label.startsWith(expected)), `Tab never reached "${expected}"`).toBe(true);
    }
  });
});
