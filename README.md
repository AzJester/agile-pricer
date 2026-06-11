# Astrion Agile Pricing Studio

A pricing application for agile fixed-price federal pursuits. It turns an agile backlog into a
defensible milestone bid: three-point story estimates flow through velocity, capacity reserve, and
escalation into labor cost; LOE, program support, ODC, and fixed milestone amounts complete the cost
stack; variance-based reserve, fee, and price-to-win produce the quoted price, tied to a milestone
payment schedule, a basis of estimate, funding by fiscal year, and an alternative capacity-subscription
pricing model.

This is the production rebuild of the original single-file HTML prototype. The math engine is a
faithful port, pinned by golden-master tests to the validated reference workbook
(total $27,590,172.95, gross-up 1.183815×, reserve 7.6195%).

## Quick start

```bash
npm install
npm run dev       # local dev server
npm test          # engine test suite (29 tests incl. golden master)
npm run build     # type-check + production bundle in dist/
npm run preview   # serve the production build
```

The app is fully client-side and offline-capable once built; it can be served from any static host.
Pursuits persist in browser localStorage and can be exported/imported as JSON.

## Architecture

```
src/
  engine/        Pure, typed pricing engine — no DOM, no React.
    types.ts       Pursuit data model and computed-result types
    compute.ts     Deterministic cost-to-price model + 13 integrity checks + advisories
    simulate.ts    Monte Carlo over the backlog (triangular sampling)
    sensitivity.ts One-at-a-time driver sweep (tornado)
    seeds.ts       Reference baseline, blank, calibrated, and showcase pursuits
    repair.ts      Schema repair/migration for imported or older data
    engine.test.ts Golden-master + invariant + behavior tests (vitest)
  state/         Zustand store: pursuits, undo/redo, localStorage persistence
  components/    Shared UI (cards, commit-on-blur inputs, dialogs, SVG charts)
  sections/      The 24 screens, grouped Guide / Setup / Scope / Outputs / Subscription / Analysis
  export/        CSV, Excel (exceljs), Word (docx), JSON portfolio — all bundled, no CDN
  lib/           Formatting and hash-route helpers
```

Design rules:

- **The engine is pure.** `compute(pursuit)` is a deterministic function of the input data. All UI
  state lives outside it, so the engine is unit-testable and could be reused server-side unchanged.
- **Golden-master protection.** `engine.test.ts` pins the reference baseline to the validated
  workbook figures. Any change that moves those numbers fails CI loudly.
- **Inputs commit on blur/Enter**, so each keystroke does not push an undo snapshot or re-run the
  model. Blue values are inputs; black values are calculated (same convention as the prototype).
- **Exports are bundled.** Excel and Word libraries are code-split and loaded on demand, but ship
  with the app — exports work with no internet access (relevant for accredited environments).

## Improvements over the prototype

| Area | Prototype | This application |
| --- | --- | --- |
| Code structure | One 1,672-line HTML file, string-built DOM | Typed React components, pure engine module |
| Correctness | Manual "Self-test" button | 29 automated tests incl. golden master, run in CI |
| Monte Carlo | Omitted program-support cost; ignored AI/automation factor | Both fixed — trials reconcile with the deterministic stack |
| Integrity check 4 | Tautological (always OK) | Real reconciliation of capability vs row labor |
| Excel export | SheetJS from a CDN at runtime (fails offline) | exceljs bundled, formatted workbook |
| Word export | HTML renamed to `.doc` | Genuine `.docx` via the docx library |
| Inputs | Inline `onclick` handlers, re-render on each change | Commit-on-blur inputs, memoized compute |
| Undo/redo | Whole-store JSON snapshots wired by hand | Store-level history with disabled-state buttons |
| Dialogs | `window.prompt` / `window.confirm` | Accessible in-app dialogs |
| Navigation | In-memory section state | Hash routes — every section is deep-linkable |
| Import safety | `JSON.parse` + loose repair | Shape validation + typed schema repair |

## The model in one paragraph

Loaded rate = direct × (1+fringe) × (1+OH) × (1+G&A). A team archetype's cost per sprint is its
headcount-weighted loaded rate times productive hours. Each backlog epic's PERT-expected points are
grossed up by the capacity reserve, divided by (velocity × ramp × AI-factor) to get sprints, and
multiplied by the escalated team-sprint cost; P80 adds 0.84×SD before the same chain. LOE and program
support are FTE-month costs; ODC escalates by year and carries material handling. Reserve is
max(estimate spread, velocity CoV) unless manual; fee applies to base+reserve; PTW applies last.
Milestone prices allocate the total by mapped labor (LOE/PS/ODC pro-rata within phase) with a
configurable rounding plug, and 13 integrity checks confirm every view reconciles to the same total.

## Data caution

All seed data is illustrative placeholder content. Do not enter CUI, controlled, or proprietary
program data unless running in an accredited environment. Data stays in the browser (localStorage)
unless you export it.
