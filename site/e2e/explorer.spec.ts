import { readFile } from 'node:fs/promises';
import {
  expect, mapCounts, openExplorer, test,
} from './fixtures';

test.describe('opening the explorer', () => {
  test('shows the release, a national map of grouped stations and a legend that explains the groups', async ({ page }) => {
    await openExplorer(page);
    await expect(page.locator('#release-line')).toHaveText('ECCC release 3.40 · 751 stations');
    await expect(page).toHaveTitle('ECCC Rainfall IDF Explorer · release 3.40');
    const { groups } = await mapCounts(page);
    expect(groups).toBeGreaterThan(10);
    await expect(page.locator('#legend')).toContainText('Years of record');
    await expect(page.locator('#legend')).toContainText('Numbered circles group nearby stations');
  });

  test('invites a choice and lists ways in', async ({ page }) => {
    await openExplorer(page);
    await expect(page.getByRole('heading', { level: 2, name: 'Rainfall design values for Canadian stations' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Longest records' })).toBeVisible();
    await page.getByRole('button', { name: /^Toronto City, ON/ }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Toronto City' })).toBeVisible();
    expect(page.url()).toContain('#/station/6158355/curves');
  });

  test('separates the groups into single stations when the map flies to one', async ({ page }) => {
    await openExplorer(page);
    const national = await mapCounts(page);
    await page.getByRole('button', { name: /^Toronto City, ON/ }).click();
    await expect.poll(async () => (await mapCounts(page)).singles, { timeout: 20_000 }).toBeGreaterThan(national.singles);
    await expect.poll(async () => (await mapCounts(page)).groups).toBeLessThan(national.groups);
  });

  test('narrows the map to one province', async ({ page }) => {
    await openExplorer(page);
    await page.locator('#province-filter').selectOption('PE');
    await expect.poll(async () => {
      const { groups, singles } = await mapCounts(page);
      return groups + singles;
    }, { timeout: 20_000 }).toBeLessThanOrEqual(8);
  });

  test('recolours the legend for a design-depth view', async ({ page }) => {
    await openExplorer(page);
    await page.locator('#color-by').selectOption('d24h');
    await expect(page.locator('#legend')).toContainText('100-year, 24-hour depth (mm)');
  });
});

test.describe('finding a station', () => {
  test('search finds a station by name and opens it from the keyboard', async ({ page }) => {
    await openExplorer(page);
    const search = page.getByRole('combobox', { name: /search stations/i });
    await search.fill('toronto c');
    await expect(page.getByRole('option').first()).toContainText('Toronto City');
    await search.press('Enter');
    await expect(page.getByRole('heading', { level: 2, name: 'Toronto City' })).toBeVisible();
    await expect(page.locator('#station-title')).toBeFocused();
    expect(page.url()).toContain('#/station/6158355/curves');
  });

  test('search finds a station by climate ID', async ({ page }) => {
    await openExplorer(page);
    await page.getByRole('combobox', { name: /search stations/i }).fill('8300301');
    await expect(page.getByRole('option').first()).toContainText('Charlottetown A');
  });

  test('says so when nothing matches', async ({ page }) => {
    await openExplorer(page);
    await page.getByRole('combobox', { name: /search stations/i }).fill('zzzzzz');
    await expect(page.locator('#search-list')).toContainText('No station matches');
  });

  test('a shared link opens straight on the station and tab', async ({ page }) => {
    await openExplorer(page, '#/station/6158355/tables');
    await expect(page.getByRole('heading', { level: 2, name: 'Toronto City' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Tables' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Rainfall depth (mm)' })).toBeVisible();
  });

  test('an unknown station in the link falls back to the start page', async ({ page }) => {
    await openExplorer(page, '#/station/0000000/curves');
    await expect(page.getByRole('heading', { level: 2, name: 'Rainfall design values for Canadian stations' })).toBeVisible();
  });

  test('the back button returns to the previous station', async ({ page }) => {
    await openExplorer(page, '#/station/6158355/curves');
    await page.getByRole('combobox', { name: /search stations/i }).fill('charlottetown a');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 2, name: 'Charlottetown A' })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('heading', { level: 2, name: 'Toronto City' })).toBeVisible();
  });
});

test.describe('a station', () => {
  test('leads with the 100-year design values', async ({ page }) => {
    await openExplorer(page, '#/station/6158355/curves');
    await expect(page.locator('.tile').first()).toContainText('56.2');
    await expect(page.locator('.tile').last()).toContainText('97.3');
    await expect(page.locator('.station-facts')).toContainText('1940–2023');
    await expect(page.locator('.station-facts')).toContainText('43.67° N, 79.40° W');
  });

  test('reads the IDF chart with the keyboard', async ({ page }) => {
    await openExplorer(page, '#/station/6158355/curves');
    const chart = page.locator('#panel-curves svg');
    await chart.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#panel-curves .chart-tip')).toBeVisible();
    await expect(page.locator('#panel-curves .tip-title')).toHaveText('5 min · mm/h');
    await page.keyboard.press('End');
    await expect(page.locator('#panel-curves .tip-title')).toHaveText('24 h · mm/h');
    await page.keyboard.press('Escape');
    await expect(page.locator('#panel-curves .chart-tip')).toBeHidden();
  });

  test('reads the IDF chart with the mouse and switches to depth', async ({ page }) => {
    await openExplorer(page, '#/station/6158355/curves');
    const box = await page.locator('#panel-curves svg').boundingBox();
    await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) * 0.5, (box?.y ?? 0) + (box?.height ?? 0) * 0.5);
    await expect(page.locator('#panel-curves .chart-tip')).toBeVisible();
    await page.getByRole('button', { name: 'Depth (mm)' }).click();
    await expect(page.getByText('Rainfall depth (mm)').first()).toBeVisible();
  });

  test('draws a confidence band on request', async ({ page }) => {
    await openExplorer(page, '#/station/6158355/curves');
    await expect(page.locator('#panel-curves path.band')).toHaveCount(0);
    await page.getByLabel('95 % limits for').selectOption('100');
    await expect(page.locator('#panel-curves path.band')).toHaveCount(1);
  });

  test('shows the tables, annual maxima and calculator', async ({ page }) => {
    await openExplorer(page, '#/station/6158355/curves');
    await page.getByRole('tab', { name: 'Tables' }).click();
    await expect(page.locator('#panel-tables table')).toHaveCount(3);
    await page.getByRole('tab', { name: 'Annual' }).click();
    await expect(page.locator('#panel-annual rect.bar').first()).toBeVisible();
    await page.locator('#annual-duration').selectOption({ label: '24 h' });
    await expect(page.locator('#panel-annual .chart-note').first()).toContainText('years in the record have a value');
    await page.getByRole('tab', { name: 'Calculator' }).click();
    await expect(page.locator('.calc-result')).toContainText('mm/h');
  });

  test('the calculator starts at the 100-year storm and warns outside 5 minutes to 24 hours', async ({ page }) => {
    await openExplorer(page, '#/station/6158355/calc');
    await expect(page.getByLabel('Return period')).toHaveValue('100');
    await page.getByLabel('Storm duration').fill('2');
    await expect(page.locator('.calc-warn')).toBeVisible();
    await page.getByLabel('Storm duration').fill('30');
    await expect(page.locator('.calc-warn')).toBeHidden();
    await page.getByLabel('Storm duration').fill('60');
    await page.getByLabel('Return period').selectOption('2');
    await expect(page.locator('.calc-formula').nth(1)).toContainText("ECCC's published 1 h value for the 2-year storm");
  });

  test('moves between tabs with the arrow keys', async ({ page }) => {
    await openExplorer(page, '#/station/6158355/curves');
    await page.getByRole('tab', { name: 'Curves' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Tables' })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('End');
    await expect(page.getByRole('tab', { name: 'Official' })).toHaveAttribute('aria-selected', 'true');
    expect(page.url()).toContain('/official');
  });

  test('notes a short record and shades the durations ECCC did not analyse', async ({ page }) => {
    await openExplorer(page, '#/station/1012055/curves');
    await expect(page.locator('.notice').first()).toContainText('short record (14 years)');
    await expect(page.locator('.notice').nth(1)).toContainText('did not analyse the 5 min, 10 min, 15 min and 30 min durations');
    await expect(page.locator('#panel-curves text.gap-label')).toHaveText('Not analysed');
  });

  test('downloads the station as CSV', async ({ page }) => {
    await openExplorer(page, '#/station/6158355/curves');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download CSV' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('eccc-idf-v3.40-6158355.csv');
    const body = (await readFile(await file.path(), 'utf8')).replace(/^﻿/, '');
    const lines = body.trim().split('\r\n');
    expect(lines[0]).toBe('climate_id,station,province,latitude,longitude,duration_min,return_period_yr,depth_mm,intensity_mm_per_h,intensity_ci95_mm_per_h');
    expect(lines).toHaveLength(1 + 9 * 7);
    expect(lines[1]).toMatch(/^6158355,TORONTO CITY,ON,43\.6667,-79\.4,5,2,/);
  });

  test('offers the JSON file', async ({ page }) => {
    await openExplorer(page, '#/station/6158355/curves');
    await expect(page.getByRole('link', { name: 'Download JSON' })).toHaveAttribute('href', /\/data\/stations\/6158355\.json$/);
  });
});

test.describe('official files', () => {
  test('lists ECCC\'s own graphs and station file with addresses on the files host', async ({ page }) => {
    await openExplorer(page, '#/station/6158355/official');
    const panel = page.locator('#panel-official');
    await expect(panel.locator('img')).toHaveAttribute('src', 'https://eccc-idf-files.andreschardong.workers.dev/v3.40/stations/6158355/idf_v3-40_2025_12_5_615_ON_6158355_TORONTO_CITY.png');
    await expect(panel.locator('.file-row')).toHaveCount(5);
    await expect(panel.getByRole('link', { name: 'TXT' })).toHaveAttribute('href', /\/v3\.40\/stations\/6158355\/idf_v3-40_2025_12_5_615_ON_6158355_TORONTO_CITY\.txt$/);
    await expect(panel.getByRole('link', { name: 'PDF', exact: true })).toHaveCount(4);
    await expect(panel.getByRole('link', { name: 'PNG', exact: true })).toHaveCount(4);
  });
});

test.describe('about, the author and the IDF_CC tool', () => {
  test('the header links to the IDF_CC tool', async ({ page }) => {
    await openExplorer(page);
    await expect(page.getByRole('navigation', { name: 'Site' }).getByRole('link', { name: 'IDF_CC tool' })).toHaveAttribute('href', 'https://www.idf-cc-uwo.ca');
  });

  test('the About dialog explains the data, the related tool and the author', async ({ page }) => {
    await openExplorer(page);
    await page.getByRole('button', { name: 'About', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { level: 3 })).toHaveText(['About the data', 'Curves for a changing climate', 'About the author']);
    await expect(dialog).toContainText('not affiliated with or endorsed by ECCC');
    await expect(dialog.getByRole('link', { name: 'IDF_CC tool' })).toHaveAttribute('href', 'https://www.idf-cc-uwo.ca');
    await expect(dialog).toContainText('Andre Schardong is a senior software engineer');
    await expect(dialog.getByRole('link', { name: 'andreschardong.com' })).toHaveAttribute('href', 'https://andreschardong.com');
    await expect(dialog.getByRole('link', { name: /doi\.org\/10\.3390\/w12051243/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: 'About', exact: true })).toBeFocused();
  });

  test('the curves tab points to the IDF_CC tool for climate-change curves', async ({ page }) => {
    await openExplorer(page, '#/station/6158355/curves');
    await expect(page.locator('#panel-curves').getByRole('link', { name: 'IDF_CC tool' })).toHaveAttribute('href', 'https://www.idf-cc-uwo.ca');
  });
});

test.describe('appearance', () => {
  test('switches to dark, redraws the map style, and remembers the choice', async ({ page }) => {
    await openExplorer(page);
    await page.getByRole('button', { name: 'Switch colour theme' }).click();
    const theme = await page.evaluate(() => document.documentElement.dataset['theme']);
    expect(['light', 'dark']).toContain(theme);
    await expect(page.locator('#map')).toHaveAttribute('data-map-ready', 'true');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme as string);
    await expect(page.locator('#map')).toHaveAttribute('data-map-ready', 'true', { timeout: 30_000 });
  });

  test('follows the system dark setting', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await openExplorer(page);
    const surface = await page.evaluate(() => getComputedStyle(document.querySelector('.station-card') as Element).backgroundColor);
    expect(surface).toBe('rgb(26, 26, 25)');
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('stacks the map above the station and keeps everything reachable', async ({ page }) => {
    await openExplorer(page, '#/station/6158355/curves');
    const map = await page.locator('.map-card').boundingBox();
    const card = await page.locator('.station-card').boundingBox();
    expect(map?.y).toBeLessThan(card?.y ?? 0);
    expect(map?.width).toBeLessThanOrEqual(390);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.getByRole('tab', { name: 'Official' }).click();
    await expect(page.locator('#panel-official .file-row')).toHaveCount(5);
  });

  test('keeps the search and both filters inside the map', async ({ page }) => {
    await openExplorer(page);
    for (const control of [page.getByRole('combobox', { name: /search stations/i }), page.locator('#province-filter'), page.locator('#color-by')]) {
      const box = await control.boundingBox();
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390);
    }
  });
});
