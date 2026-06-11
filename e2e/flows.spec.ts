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

test('rate basis columns offer dropdown choices and accept custom values', async ({ page }) => {
  await page.goto('/#/rates');
  const row = page.locator('table tbody tr').first();
  for (const label of ['Skill level', 'Years of experience', 'Degree', 'Location / market', 'Clearance', 'Rate source']) {
    // Each combo input is wired to a datalist of choices.
    await expect(row.locator(`input[aria-label="${label}"]`)).toHaveAttribute('list', /.+/);
  }
  const degree = row.locator('input[aria-label="Degree"]');
  await degree.fill('JD'); // not in the suggestion list — custom values must commit
  await degree.press('Enter');
  await expect(degree).toHaveValue('JD');
});

test('a custom location typed in one row joins the dropdown choices for all rows', async ({ page }) => {
  await page.goto('/#/rates');
  const rows = page.locator('table tbody tr');
  const loc0 = rows.nth(0).locator('input[aria-label="Location / market"]');
  await loc0.fill('Kwajalein Atoll');
  await loc0.press('Enter');
  const listId = await rows.nth(1).locator('input[aria-label="Location / market"]').getAttribute('list');
  await expect(page.locator(`datalist[id="${listId}"] option[value="Kwajalein Atoll"]`)).toHaveCount(1);
  // The expanded static list and the new degrees are present too.
  await expect(page.locator(`datalist[id="${listId}"] option[value="San Diego, CA"]`)).toHaveCount(1);
  const degreeList = await rows.nth(0).locator('input[aria-label="Degree"]').getAttribute('list');
  await expect(page.locator(`datalist[id="${degreeList}"] option[value="JD"]`)).toHaveCount(1);
  await expect(page.locator(`datalist[id="${degreeList}"] option[value="DBA"]`)).toHaveCount(1);
});

test('every section shows new-user guidance while Tips is on', async ({ page }) => {
  const sections = [
    'start', 'overview', 'rates', 'teams', 'backlog', 'velocity', 'phasing', 'loe', 'psupport', 'odc',
    'milestones', 'teaming', 'results', 'mps', 'boe', 'value', 'checks', 'capacity', 'dashboard',
    'funding', 'staffing', 'risk', 'sensitivity', 'margin', 'scenario',
  ];
  await page.goto('/');
  for (const id of sections) {
    await page.goto('/#/' + id);
    await expect(page.locator('.tip').first(), `tip on #${id}`).toBeVisible();
  }
});

test('dashboard labels are never truncated and widgets drill through', async ({ page }) => {
  await page.goto('/#/dashboard');
  const rows = page.locator('.dashrow');
  await expect(rows.first()).toBeVisible();
  for (const t of await rows.allTextContents()) expect(t).not.toContain('…');
  // Clicking a milestone cash-flow row opens the payment schedule.
  await page.locator('.dashrow[title*="payment schedule"]').first().click();
  await expect(page.locator('main h2').first()).toHaveText('Milestone Payment Schedule');
  // Clicking a KPI opens the tab that owns it.
  await page.goto('/#/dashboard');
  await page.getByTitle('Open Pricing Results').first().click();
  await expect(page.locator('main h2').first()).toHaveText('Pricing Results');
});

test('dashboard insight cards render and drill through', async ({ page }) => {
  await page.goto('/#/dashboard');
  // New cards are present with content.
  await expect(page.getByText('Cumulative Expenditure (cost basis)')).toBeVisible();
  await expect(page.locator('svg[aria-label="Cumulative expenditure by month"]')).toBeVisible();
  await expect(page.getByText('Demand vs Funded Capacity by Year')).toBeVisible();
  await expect(page.getByText('Top Cost Drivers (BOE)')).toBeVisible();
  // Integrity KPI links to the checks tab.
  await page.getByTitle('Open Integrity Checks').click();
  await expect(page.locator('main h2').first()).toHaveText('Integrity Checks');
  // Top-driver rows link to the BOE.
  await page.goto('/#/dashboard');
  await page.getByTitle(/click for the BOE/).first().click();
  await expect(page.locator('main h2').first()).toHaveText('BOE Traceability');
  // Demand rows link to time-phasing.
  await page.goto('/#/dashboard');
  await page.getByTitle(/click for time-phasing/).first().click();
  await expect(page.locator('main h2').first()).toHaveText('Time-Phasing: Surge & AI Disruption');
});

test('no text is truncated anywhere in the app', async ({ page }) => {
  const audit = async (where: string) => {
    const bad = await page.evaluate(() => {
      const out: string[] = [];
      // (a) DOM text clipped by ellipsis or hidden single-line overflow
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('main *, header *, nav *, .dialog *'))) {
        if (el.children.length || !el.textContent?.trim()) continue;
        if (['INPUT', 'SELECT', 'TEXTAREA', 'OPTION'].includes(el.tagName)) continue;
        const cs = getComputedStyle(el);
        const clips = cs.textOverflow === 'ellipsis' || (cs.overflowX === 'hidden' && cs.whiteSpace === 'nowrap');
        if (clips && el.scrollWidth > el.clientWidth + 1) out.push(`clipped: "${el.textContent.trim().slice(0, 40)}"`);
      }
      // (b) SVG chart text escaping its viewBox
      for (const svg of Array.from(document.querySelectorAll('svg[viewBox]'))) {
        const [, , vw, vh] = (svg.getAttribute('viewBox') || '0 0 0 0').split(/\s+/).map(Number);
        for (const t of Array.from(svg.querySelectorAll('text'))) {
          const b = (t as SVGTextElement).getBBox();
          if (b.x < -1 || b.y < -1 || b.x + b.width > vw + 1 || b.y + b.height > vh + 2) {
            out.push(`svg overflow: "${t.textContent?.trim().slice(0, 40)}"`);
          }
        }
      }
      return out;
    });
    expect(bad, where).toEqual([]);
  };
  const sections = [
    'start', 'overview', 'rates', 'teams', 'backlog', 'velocity', 'phasing', 'loe', 'psupport', 'odc',
    'milestones', 'teaming', 'results', 'mps', 'boe', 'value', 'checks', 'capacity', 'dashboard',
    'funding', 'staffing', 'risk', 'sensitivity', 'margin', 'scenario',
  ];
  for (const id of sections) {
    await page.goto('/#/' + id);
    // Render the on-demand charts so their labels are audited too.
    if (id === 'risk') {
      await page.getByRole('button', { name: 'Run 4,000 trials' }).click();
      await expect(page.getByText('Simulated P50 cost')).toBeVisible();
    }
    if (id === 'sensitivity') {
      await page.getByRole('button', { name: '±20%' }).click();
      await expect(page.getByText(/Tornado — price swing/)).toBeVisible();
    }
    await audit('#' + id);
  }
  // The import dialog's column chips wrap long CSV headers instead of clipping.
  await page.goto('/#/backlog');
  await page.getByRole('button', { name: /Import \/ Paste/ }).click();
  await page
    .locator('.dialog textarea')
    .fill('A Very Long Custom Field Header For Story Points\tSummary\n40\tImported epic\n');
  await expect(page.getByText('1 epics ready')).toBeVisible();
  await audit('import dialog');
});

test('Escape closes the snapshots dialog', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Snapshots' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
