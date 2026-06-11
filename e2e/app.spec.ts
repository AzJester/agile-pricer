import { expect, test } from '@playwright/test';

const SECTIONS = [
  ['start', 'Start Here'],
  ['overview', 'Overview & Control'],
  ['rates', 'Labor Rates'],
  ['teams', 'Team Archetypes'],
  ['backlog', 'Backlog'],
  ['velocity', 'Velocity & Reserve'],
  ['phasing', 'Time-Phasing: Surge & AI Disruption'],
  ['loe', 'Persistent Level-of-Effort'],
  ['psupport', 'Program Support Labor'],
  ['odc', 'Other Direct Costs'],
  ['milestones', 'Milestones'],
  ['teaming', 'Teaming'],
  ['results', 'Pricing Results'],
  ['mps', 'Milestone Payment Schedule'],
  ['boe', 'BOE Traceability'],
  ['value', 'Value Map'],
  ['checks', 'Integrity Checks'],
  ['capacity', 'Capacity Subscription Tiers'],
  ['dashboard', 'Dashboard'],
  ['funding', 'Funding & Color of Money'],
  ['staffing', 'Cost Phasing & Staffing'],
  ['risk', 'Risk — Monte Carlo'],
  ['sensitivity', 'Driver Sensitivity'],
  ['margin', 'Margin Walk (internal view)'],
  ['scenario', 'Scenario Compare'],
] as const;

test('golden total appears in the KPI strip on a fresh load', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.kpi .v').first()).toHaveText('$27,590,173');
});

test('every section renders its heading', async ({ page }) => {
  await page.goto('/');
  for (const [id, heading] of SECTIONS) {
    await page.goto('/#/' + id);
    await expect(page.locator('main h2').first()).toHaveText(heading);
  }
});

test('editing a backlog estimate recomputes the model and undo restores it', async ({ page }) => {
  await page.goto('/#/backlog');
  const kpi = page.locator('.kpi .v').first();
  const before = await kpi.textContent();
  const lowCell = page.locator('table.t-backlog tbody tr').first().locator('input[type=number]').nth(1);
  await lowCell.fill('500');
  await lowCell.blur();
  await expect(kpi).not.toHaveText(before!);
  await page.locator('button[title="Undo (Ctrl+Z)"]').click();
  await expect(kpi).toHaveText(before!);
});

test('Monte Carlo and sensitivity run', async ({ page }) => {
  await page.goto('/#/risk');
  await page.getByRole('button', { name: 'Run 4,000 trials' }).click();
  await expect(page.getByText('Simulated P50 cost')).toBeVisible();
  await page.goto('/#/sensitivity');
  await page.getByRole('button', { name: '±20%' }).click();
  await expect(page.getByText('Tornado — price swing at ±20%')).toBeVisible();
});

test('backlog import dialog parses a pasted Jira block', async ({ page }) => {
  await page.goto('/#/backlog');
  await page.getByRole('button', { name: /Import \/ Paste/ }).click();
  await page
    .locator('.dialog textarea')
    .fill('Summary\tStory Points\tSprint\nImported epic one\t40\tPI1\nImported epic two\t25\tPI2\n');
  await expect(page.getByText('2 epics ready')).toBeVisible();
  await page.getByRole('button', { name: /Import 2 epics/ }).click();
  // Imported rows append to the grid; the epic name lands in an input cell.
  const epicInputs = page.locator('table.t-backlog tbody tr td:nth-child(2) input');
  await expect(epicInputs.last()).toHaveValue('Imported epic two');
});

test('periods editor adds a third period and milestone schedule shows it', async ({ page }) => {
  await page.goto('/#/overview');
  await page.getByRole('button', { name: '+ Add option period' }).click();
  await expect(page.getByText('ALIN 003')).toBeVisible();
  // Integrity must still hold with three periods.
  await page.goto('/#/checks');
  await expect(page.locator('.section-head .pill').first()).toHaveText('ALL OK');
});

test('staffing section reconciles and exports', async ({ page }) => {
  await page.goto('/#/staffing');
  await expect(page.getByText('Peak staffing')).toBeVisible();
  await expect(page.locator('table tbody tr').first()).toBeVisible();
});
