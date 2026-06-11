import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * End-to-end coverage for the riskiest paths the smoke suite skipped:
 * downloads (JSON / Excel / Word / CSV), file imports, snapshots, and the
 * Escape-cancels-edit contract.
 */

test('toolbar exports download JSON, portfolio, Excel, and Word files', async ({ page }) => {
  await page.goto('/');
  const cases = [
    ['Export', /\.json$/],
    ['Portfolio', /\.json$/],
    ['Excel', /_Pricing\.xlsx$/],
    ['Word', /_Pricing\.docx$/],
  ] as const;
  for (const [name, pattern] of cases) {
    const waiting = page.waitForEvent('download');
    await page.getByRole('button', { name, exact: true }).click();
    const download = await waiting;
    expect(download.suggestedFilename()).toMatch(pattern);
  }
});

test('milestone names cannot smuggle formulas into the MPS CSV', async ({ page }) => {
  await page.goto('/#/milestones');
  const nameCell = page.locator('table tbody tr').first().locator('input[type=text]').first();
  await nameCell.fill('=HYPERLINK("http://evil")');
  await nameCell.press('Enter');
  await page.goto('/#/mps');
  const waiting = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const download = await waiting;
  const content = readFileSync((await download.path())!, 'utf8');
  expect(content).toContain(`"'=HYPERLINK`); // neutralized with an apostrophe
  expect(content).not.toMatch(/(^|,)=HYPERLINK/m); // never as a live formula
});

test('exported pursuit JSON re-imports through the toolbar', async ({ page }) => {
  await page.goto('/');
  const waiting = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await waiting;
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await (await chooser).setFiles((await download.path())!);
  await expect(page.locator('.toast')).toHaveText(/Imported "/);
});

test('rates CSV import handles quoted LCATs with commas', async ({ page }) => {
  await page.goto('/#/rates');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import CSV' }).click();
  await (await chooser).setFiles({
    name: 'rates.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('LCAT,Direct\n"Engineer, Senior",123.45\n'),
  });
  await expect(page.locator('.toast')).toHaveText(/Imported 1 rate/);
  await expect(page.locator('input[value="Engineer, Senior"]')).toBeVisible();
});

test('snapshots: take, list, and restore as a new pursuit', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Snapshots' }).click();
  await page.getByRole('button', { name: 'Take snapshot' }).click();
  await page.getByRole('button', { name: 'OK', exact: true }).click(); // accept default name
  await expect(page.locator('.dialog b').filter({ hasText: 'as-submitted' })).toBeVisible();
  const pursuitsBefore = await page.locator('.pursuit-select option').count();
  await page.getByRole('button', { name: 'Restore as copy' }).click();
  await expect(page.locator('.toast')).toHaveText(/restored/i);
  await expect(page.locator('.pursuit-select option')).toHaveCount(pursuitsBefore + 1);
});

test('Escape discards an in-progress cell edit instead of committing it', async ({ page }) => {
  await page.goto('/#/backlog');
  const kpi = page.locator('.kpi .v').first();
  const before = await kpi.textContent();
  const lowCell = page.locator('table.t-backlog tbody tr').first().locator('input[type=number]').nth(1);
  await lowCell.fill('500');
  await lowCell.press('Escape');
  await expect(kpi).toHaveText(before!);
  await expect(lowCell).not.toHaveValue('500');
});

test('Escape closes the snapshots dialog', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Snapshots' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
