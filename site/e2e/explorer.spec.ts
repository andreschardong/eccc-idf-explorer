import { readFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';
import {
  PIXEL, STUB_PDF, STUB_TEXT, expect, mapCounts, openExplorer, test,
} from './fixtures';

test.describe('opening the explorer', () => {
  test('shows the release, a national map of grouped stations and a legend that explains the groups', async ({ page }) => {
    await openExplorer(page);
    await expect(page.locator('#release-line')).toHaveText('ECCC release 3.40 · 751 stations');
    await expect(page).toHaveTitle('ECCC Rainfall IDF Explorer · release 3.40');
    const { groups } = await mapCounts(page);
    expect(groups).toBeGreaterThan(10);
    await expect(page.locator('#legend')).toContainText('Years of record');
    await expect(page.locator('#legend')).toContainText('Numbered circles group stations');
    await expect(page.locator('#legend .legend-groups li')).toHaveText(['2–9 stations', '10–49', '50–99', '100 or more']);
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
    // The chart can sit below the fold and redraws once when the panel gets its scrollbar, so scroll to it and move the
    // mouse again until the tooltip shows, as a visitor would.
    await page.locator('#panel-curves svg').scrollIntoViewIfNeeded();
    await expect(async () => {
      const box = await page.locator('#panel-curves svg').boundingBox();
      await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) * 0.5, (box?.y ?? 0) + (box?.height ?? 0) * 0.5);
      await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) * 0.52, (box?.y ?? 0) + (box?.height ?? 0) * 0.5);
      await expect(page.locator('#panel-curves .chart-tip')).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Depth (mm)' }).click();
    await expect(page.getByText('Rainfall depth (mm)').first()).toBeVisible();
  });

  test('shows ECCC\'s published values as dots and its equations as lines, which can be switched off', async ({ page }) => {
    await openExplorer(page, '#/station/6158355/curves');
    const chart = page.locator('#panel-curves');
    await expect(chart.locator('circle.dot')).toHaveCount(63);
    await expect(chart.locator('path.fit')).toHaveCount(7);
    await expect(chart.locator('path.line')).toHaveCount(0);
    await chart.getByLabel("Show ECCC's fitted equations").uncheck();
    await expect(chart.locator('path.fit')).toHaveCount(0);
    await expect(chart.locator('circle.dot')).toHaveCount(63);
    await chart.getByLabel("Show ECCC's fitted equations").check();
    await chart.getByText("ECCC's fitted equations", { exact: true }).click();
    await expect(chart.locator('details.equations li')).toHaveCount(7);
    await expect(chart.locator('details.equations li').nth(5)).toContainText('R = 48.7 × T^−0.735');
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
    await expect(page.getByRole('tab', { name: 'Files' })).toHaveAttribute('aria-selected', 'true');
    expect(page.url()).toContain('/files');
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

  test('puts Download files beside Download CSV and Download JSON, and opens the files', async ({ page }) => {
    await openExplorer(page, '#/station/6158355/curves');
    const row = page.locator('.station-actions');
    await expect(row.locator('> *')).toHaveText(['Download CSV', 'Download JSON', 'Download files', 'Copy link']);
    await row.getByRole('button', { name: 'Download files' }).click();
    await expect(page.getByRole('tab', { name: 'Files' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#panel-files')).toBeVisible();
    await expect(page.locator('#panel-files img')).toBeVisible();
    expect(page.url()).toContain('/files');
  });

  test('offers the JSON file', async ({ page }) => {
    await openExplorer(page, '#/station/6158355/curves');
    await expect(page.getByRole('link', { name: 'Download JSON' })).toHaveAttribute('href', /\/data\/stations\/6158355\.json$/);
  });
});

test.describe('files for each station', () => {
  const STEM = 'idf_v3-40_2025_12_5_615_ON_6158355_TORONTO_CITY';
  const HOST = 'https://eccc-idf-files.andreschardong.workers.dev/v3.40/stations/6158355';

  test('opens on ECCC\'s IDF graph and says what it shows', async ({ page }) => {
    await openExplorer(page, '#/station/6158355/files');
    const panel = page.locator('#panel-files');
    await expect(panel.getByRole('heading', { level: 3, name: 'Files for this station' })).toBeVisible();
    await expect(panel.locator('img')).toHaveAttribute('src', `${HOST}/${STEM}.png`);
    await expect(panel.locator('figcaption')).toContainText('IDF graph. The official intensity-duration-frequency curves');
    await expect(panel.getByRole('button', { name: 'IDF graph', pressed: true })).toBeVisible();
  });

  test('shows each of the four plots', async ({ page }) => {
    await openExplorer(page, '#/station/6158355/files');
    const panel = page.locator('#panel-files');
    for (const [button, suffix, caption] of [
      ['Q–Q plot', '_qq', 'Quantile-quantile plot'],
      ['Return levels', '_r', 'Return-level plot'],
      ['Trend', '_t', 'Trend plot'],
      ['IDF graph', '', 'IDF graph'],
    ] as const) {
      await panel.getByRole('button', { name: button }).click();
      await expect(panel.locator('img')).toHaveAttribute('src', `${HOST}/${STEM}${suffix}.png`);
      await expect(panel.locator('figcaption')).toContainText(caption);
      await expect(panel.getByRole('button', { name: button, pressed: true })).toBeVisible();
      await expect(panel.getByRole('link', { name: 'Open PDF' })).toHaveAttribute('href', `${HOST}/${STEM}${suffix}.pdf`);
    }
  });

  test('opens the PDF in a new tab', async ({ page }) => {
    await openExplorer(page, '#/station/6158355/files');
    const link = page.locator('#panel-files').getByRole('link', { name: 'Open PDF' });
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
  });

  test('downloads a plot as PDF or PNG under ECCC\'s own file name', async ({ page }) => {
    await openExplorer(page, '#/station/6158355/files');
    const panel = page.locator('#panel-files');
    await panel.getByRole('button', { name: 'Return levels' }).click();

    const pdf = page.waitForEvent('download');
    await panel.getByRole('button', { name: 'Download PDF' }).click();
    const pdfFile = await pdf;
    expect(pdfFile.suggestedFilename()).toBe(`${STEM}_r.pdf`);
    expect((await readFile(await pdfFile.path())).toString('latin1')).toBe(STUB_PDF.toString('latin1'));
    await expect(panel.getByRole('status')).toContainText(`Saved ${STEM}_r.pdf`);

    const png = page.waitForEvent('download');
    await panel.getByRole('button', { name: 'Download PNG' }).click();
    expect((await png).suggestedFilename()).toBe(`${STEM}_r.png`);
  });

  test('downloads the station\'s text file', async ({ page }) => {
    await openExplorer(page, '#/station/6158355/files');
    const download = page.waitForEvent('download');
    await page.locator('#panel-files').getByRole('button', { name: 'Download TXT' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe(`${STEM}.txt`);
    expect(Buffer.compare(await readFile(await file.path()), STUB_TEXT)).toBe(0);
  });

  test('downloads all nine files as one ZIP', async ({ page }) => {
    await openExplorer(page, '#/station/6158355/files');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download all files (ZIP)' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('eccc-idf-v3.40-6158355-official-files.zip');
    const entries = unzipSync(new Uint8Array(await readFile(await file.path())));
    expect(Object.keys(entries).sort()).toEqual([
      `${STEM}.pdf`, `${STEM}.png`, `${STEM}.txt`,
      `${STEM}_qq.pdf`, `${STEM}_qq.png`, `${STEM}_r.pdf`, `${STEM}_r.png`, `${STEM}_t.pdf`, `${STEM}_t.png`,
    ].sort());
    expect(Buffer.from(entries[`${STEM}.pdf`] as Uint8Array).toString('latin1')).toBe(STUB_PDF.toString('latin1'));
    expect(Buffer.compare(Buffer.from(entries[`${STEM}.png`] as Uint8Array), PIXEL)).toBe(0);
    expect(Buffer.compare(Buffer.from(entries[`${STEM}.txt`] as Uint8Array), STUB_TEXT)).toBe(0);
    await expect(page.getByRole('status')).toContainText('Saved eccc-idf-v3.40-6158355-official-files.zip (9 files');
  });

  test('reads the station file in place, with its accents', async ({ page }) => {
    await openExplorer(page, '#/station/6158355/files');
    const panel = page.locator('#panel-files');
    await expect(panel.locator('pre')).toBeHidden();
    await panel.getByRole('button', { name: 'View text' }).click();
    await expect(panel.locator('pre')).toBeVisible();
    await expect(panel.locator('pre')).toContainText("Données sur l'intensité");
    await panel.getByRole('button', { name: 'Hide text' }).click();
    await expect(panel.locator('pre')).toBeHidden();
  });

  test.describe('when the host does not have a file', () => {
    test.use({ allowedConsoleErrors: [/Failed to load resource/] });

    test('says so, and does not save anything', async ({ page }) => {
      await page.route('**/*.pdf', (route) => route.fulfill({ status: 404, body: 'not found', headers: { 'access-control-allow-origin': '*' } }));
      await openExplorer(page, '#/station/6158355/files');
      const panel = page.locator('#panel-files');
      let saved = false;
      page.on('download', () => { saved = true; });
      await panel.getByRole('button', { name: 'Download PDF' }).click();
      await expect(panel.getByRole('status')).toContainText(`Could not download ${STEM}.pdf (HTTP 404)`);
      await page.getByRole('button', { name: 'Download all files (ZIP)' }).click();
      await expect(panel.getByRole('status')).toContainText('Could not prepare the ZIP');
      expect(saved).toBe(false);
    });
  });
});

test.describe('about, the author and the IDF_CC tool', () => {
  test('the header links to the IDF_CC tool', async ({ page }) => {
    await openExplorer(page);
    await expect(page.getByRole('navigation', { name: 'Site' }).getByRole('link', { name: 'IDF_CC tool' })).toHaveAttribute('href', 'https://www.idf-cc-uwo.ca');
  });

  test('About the data opens the data notes and the pointer to climate-change curves, and nothing about the author', async ({ page }) => {
    await openExplorer(page);
    await page.getByRole('button', { name: 'About the data' }).click();
    const dialog = page.getByRole('dialog', { name: 'About the data' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { level: 3 })).toHaveText(['Curves for a changing climate']);
    await expect(dialog).toContainText('not affiliated with or endorsed by ECCC');
    await expect(dialog).toContainText('751 stations');
    await expect(dialog.getByRole('link', { name: 'IDF_CC tool' })).toHaveAttribute('href', 'https://www.idf-cc-uwo.ca');
    await expect(dialog).not.toContainText('Schardong');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: 'About the data' })).toBeFocused();
  });

  test('About the author opens the author, the paper and the links, and nothing about the data', async ({ page }) => {
    await openExplorer(page);
    await page.getByRole('button', { name: 'About the author' }).click();
    const dialog = page.getByRole('dialog', { name: 'About the author' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { level: 3 })).toHaveText(['The paper behind the IDF_CC tool', 'Elsewhere']);
    await expect(dialog).toContainText('Andre Schardong is a senior software engineer');
    await expect(dialog.getByRole('link', { name: 'andreschardong.com' })).toHaveAttribute('href', 'https://andreschardong.com');
    await expect(dialog.getByRole('link', { name: /doi\.org\/10\.3390\/w12051243/ })).toBeVisible();
    await expect(dialog).not.toContainText('751 stations');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: 'About the author' })).toBeFocused();
  });

  test('the two menu items open different dialogs, one after the other', async ({ page }) => {
    await openExplorer(page);
    await page.getByRole('button', { name: 'About the author' }).click();
    await expect(page.getByRole('dialog')).toContainText('senior software engineer');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'About the data' }).click();
    await expect(page.getByRole('dialog')).toContainText('751 stations');
    await expect(page.getByRole('dialog')).not.toContainText('senior software engineer');
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
    await page.getByRole('tab', { name: 'Files' }).click();
    const buttons = await page.locator('#panel-files .seg button').all();
    expect(buttons).toHaveLength(4);
    for (const button of buttons) {
      const box = await button.boundingBox();
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390);
    }
  });

  for (const width of [390, 320]) {
    test(`keeps both About menu items and the theme switch in the header at ${width}px, with short labels`, async ({ page }) => {
      await page.setViewportSize({ width, height: 740 });
      await openExplorer(page);
      for (const name of ['Data', 'Author', 'Switch colour theme']) {
        const box = await page.getByRole('button', { name, exact: true }).boundingBox();
        expect(box, name).not.toBeNull();
        expect((box?.x ?? 0) + (box?.width ?? 0), name).toBeLessThanOrEqual(width);
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test('keeps the search and both filters inside the map', async ({ page }) => {
    await openExplorer(page);
    for (const control of [page.getByRole('combobox', { name: /search stations/i }), page.locator('#province-filter'), page.locator('#color-by')]) {
      const box = await control.boundingBox();
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390);
    }
  });
});
