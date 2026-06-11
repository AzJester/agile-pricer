# Astrion Agile Pricing Studio

A pricing application for agile fixed-price federal pursuits. It turns an agile backlog into a
defensible milestone bid: three-point story estimates flow through velocity, capacity reserve, and
escalation into labor cost; LOE, program support, ODC, and fixed milestone amounts complete the cost
stack; variance-based reserve, fee, and price-to-win produce the quoted price, tied to a milestone
payment schedule, a basis of estimate, funding by fiscal year, a monthly cost-phasing/staffing plan,
and an alternative capacity-subscription pricing model.

The math engine is pinned by golden-master tests to the validated reference workbook
(total $27,590,172.95, gross-up 1.183815×, reserve 7.6195%).

**Live app:** https://azjester.github.io/agile-pricer/ · **New users:** start with the
[User Guide](docs/USER_GUIDE.md).

## Quick start

```bash
npm install
npm run dev        # local dev server
npm test           # engine test suite (43 unit + property tests)
npm run e2e        # Playwright end-to-end suite against the production build
npm run build      # type-check + production bundle in dist/
npm run preview    # serve the production build
npm run serve:sync # optional team sync server (see below)
```

The app is fully client-side, installable as a PWA, and offline-capable once built; it can be served
from any static host. Pursuits persist in browser localStorage and round-trip as JSON.

**GitHub Pages:** pushes to `main` deploy automatically via `.github/workflows/deploy.yml`. Open
`https://<owner>.github.io/agile-pricer/` in any browser. (First run: the workflow enables Pages on
the repo; it needs the repository to be public or on a plan with Pages.)

## Architecture

```
src/
  engine/        Pure, typed pricing engine — no DOM, no React.
    types.ts       Pursuit data model (schema v2) and computed-result types
    compute.ts     Deterministic cost-to-price model, N contract periods,
                   per-year escalation, FPRA rate tables, 13 integrity checks
    simulate.ts    Monte Carlo: triangular sampling, Gaussian-copula epic
                   correlation, optional per-trial velocity sampling
    sensitivity.ts One-at-a-time driver sweep (tornado)
    monthly.ts     Monthly cost phasing + FTE staffing plan (ties to totals)
    seeds.ts       Reference baseline, blank, calibrated, and showcase pursuits
    repair.ts      Schema repair/migration (v1 two-phase -> v2 periods)
    *.test.ts      Golden-master, invariant, behavior, and property-based tests
  state/         Zustand store: pursuits, undo/redo, snapshots, baseline pin,
                 localStorage persistence
  components/    Shared UI: cards, commit-on-blur inputs, focus-trapped dialogs,
                 SVG charts, backlog import dialog, sync dialog
  sections/      25 screens, grouped Guide / Setup / Scope / Outputs /
                 Subscription / Analysis
  export/        CSV, Excel with live formulas (exceljs), Word .docx (docx),
                 JSON portfolio — all bundled, no CDN
  lib/           Formatting, hash routing, Jira/ADO/Excel import parsing,
                 sync client
server/          Optional zero-dependency portfolio sync server
e2e/             Playwright end-to-end suite
```

Design rules:

- **The engine is pure.** `compute(pursuit)` is a deterministic function of the input data, so it is
  unit-testable and runs server-side unchanged.
- **Golden-master protection.** The reference baseline is pinned to the validated workbook figures;
  any change that moves those numbers fails CI loudly. Property-based tests assert the
  reconciliation invariants (milestones, periods, BOE, teaming all tie to one total) for arbitrary
  bounded inputs.
- **Inputs commit on blur/Enter**, so each keystroke does not push an undo snapshot or re-run the model.
  Blue values are inputs; black values are calculated.
- **Exports are bundled.** Excel and Word libraries are code-split and loaded on demand, but ship with
  the app — exports work with no internet access (relevant for accredited environments).

## The pricing model

Loaded rate = direct × (1+fringe) × (1+OH) × (1+G&A); per-year FPRA direct-rate tables override the
escalated Yr1 direct when present, and escalation accepts per-year step overrides. A team archetype's
cost per sprint is its headcount-weighted loaded rate times productive hours. Each backlog epic's
PERT-expected points are grossed up by the capacity reserve, divided by (velocity × ramp × AI-factor)
to get sprints, and multiplied by the escalated team-sprint cost; P80 adds 0.84×SD. LOE and program
support are FTE-month costs; ODC escalates by year and carries material handling. Reserve is
max(estimate spread, velocity CoV) unless manual; fee applies to base+reserve; PTW applies last.

**Contract periods:** the program is any number of periods (base + options), each its own ALIN,
months, and color of money. Milestones, LOE, program support, and row-phased ODC reference a period;
milestone prices allocate the total by mapped labor (LOE/PS/ODC pro-rata within the period) with a
configurable rounding plug, and 13 integrity checks confirm every view reconciles to the same total.

**Risk:** Monte Carlo supports epic correlation (Gaussian copula — independent sampling understates
tail risk) and per-trial velocity sampling from the historical CoV. Trials include program support
and the AI/automation curve, so the distribution reconciles with the deterministic stack.

**Phasing:** `monthly.ts` spreads the cost stack across calendar months (backlog labor over its PI
year, LOE/PS over each line's months from its period start, ODC per program year, fixed at milestone
completion). Spreads preserve engine totals exactly and yield the expenditure curve and FTE-by-month
staffing plan on the Cost Phasing & Staffing tab.

## Getting data in and out

- **Jira / Azure DevOps / Excel import:** the Backlog tab's Import dialog accepts CSV files or pasted
  spreadsheet blocks, auto-maps columns (summary/points/sprint/epic-link…), derives the three-point
  spread from likely points, and previews before appending.
- **Excel export with live formulas:** the rate build, PERT sizing, sprint conversion, and the
  cost-to-price stack are real formulas referencing an Inputs sheet, so a reviewer can trace and flex
  the math; milestone allocation stays values with the app as system of record.
- **Word (.docx), CSV (MPS / tiers / funding / phasing), JSON pursuit + portfolio round-trip.**
- **Snapshots:** named point-in-time copies per pursuit ("as-submitted", "BAFO"); restore creates a
  new pursuit. **Baseline pinning** in Scenario Compare shows dollar deltas against a pinned column.

## Team sync (optional)

`npm run serve:sync` starts a zero-dependency server (`server/server.mjs`) storing portfolios as JSON
with revision-based optimistic concurrency and optional bearer-token auth (`API_TOKEN=…`). The Sync
toolbar dialog pushes/pulls the whole portfolio; the app stays local-first and nothing is sent until
you push. For enterprise SSO, replace `checkAuth()` with JWT validation against your IdP (for
Entra ID: verify signature via the tenant JWKS endpoint, check audience and tenant) and run behind TLS.

## Data caution

All seed data is illustrative placeholder content. Do not enter CUI, controlled, or proprietary
program data unless running in an accredited environment, and do not point Sync at a server that
isn't approved for the data entered. Data stays in the browser (localStorage) unless you export or
push it.
