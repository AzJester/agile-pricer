# Agile Pricing Studio — User Guide

*A walkthrough for first-time users. No agile or pricing background assumed.*

**Open the app:** https://azjester.github.io/agile-pricer/ (any modern browser, nothing to install).

---

## 1. What this tool does

Agile Pricing Studio turns an agile software backlog into a **defensible fixed-price bid**. You give it:

- the work, sized as story points with optimistic/likely/pessimistic estimates,
- the teams that will do the work and what they cost,
- how fast those teams deliver (velocity),
- everything else the program needs (security operations, help desk, program management, cloud, travel),

and it produces:

- a **total price** at your chosen confidence level,
- a **milestone payment schedule** the customer pays against,
- a **basis of estimate (BOE)** that traces every dollar from requirement to price,
- funding by fiscal year, a monthly spend and staffing plan, risk analysis, and proposal-ready Excel/Word exports.

It also contains a second pricing model, **Capacity Tiers**, for selling a standing team as a subscription instead of pricing the backlog. Section 8 covers when to use which.

> **Important:** all the data that ships with the tool is illustrative placeholder content. Do not enter CUI, controlled, or proprietary program data unless you are running a private copy in an accredited environment. Your work is saved in *your own browser*; nobody else can see what you type at the public URL.

---

## 2. Five-minute orientation

1. Open the app. You land on **Start Here**, a short orientation page.
2. In the dark bar at the top, the **pursuit selector** (the dropdown) holds your bids. Three samples are preloaded. Pick **"Feature Showcase — Software Factory"** to see every feature populated.
3. The strip below the toolbar always shows the headline numbers: **Total Price, Cost P50/P80, Reserve, Capacity Utilization, Budget Status, Integrity**. These update live as you type.
4. The left sidebar is the table of contents, grouped top to bottom in roughly the order you work: **Guide → Setup → Scope → Outputs → Subscription Model → Analysis**.
5. Click into **Backlog** and change any number. Watch the Total Price in the header move. Press the **Undo** button (or Ctrl+Z) to put it back.

One color rule to remember everywhere: **blue numbers are inputs you can edit; black numbers are calculated.** If it's blue, click it.

---

## 3. Key concepts in plain language

You don't need to be an agile coach or a cost estimator to use the tool, but these eight terms appear everywhere:

| Term | What it means here |
| --- | --- |
| **Story points** | A relative size measure for a chunk of work (an "epic"). Bigger number = more work. The absolute scale doesn't matter as long as points and velocity use the same scale. |
| **Three-point estimate** | For each epic you enter **Low / Likely / High** points. The tool computes the expected value with the PERT formula (Low + 4×Likely + High) ÷ 6, and uses the spread (High − Low) as a measure of uncertainty. Wide spread = soft scope = more reserve. |
| **Velocity** | Points one team finishes per sprint, based on history. This single number converts points into time and therefore into dollars, which is why the tool keeps asking you to back it with real sprint samples. |
| **Capacity reserve** | The share of each sprint that goes to defects and rework rather than new scope (typically ~15%). The tool inflates the points to cover it. |
| **P50 / P80** | Confidence levels. P50 is the "coin-flip" estimate; P80 adds a cushion so there is an 80% chance the real cost comes in at or under it. Fixed-price bids are usually quoted at P80. |
| **Wrap rates** | Fringe, overhead, and G&A percentages that turn a raw (direct) hourly rate into the fully loaded rate the contract actually pays for. |
| **Reserve and fee** | Reserve is risk money added on top of the cost estimate (sized from estimate spread or velocity variation). Fee is your margin. Price = (cost + reserve + fee) ± any price-to-win adjustment. |
| **Gross-up** | Total price ÷ base cost. The tool applies this single multiplier to spread reserve and fee proportionally across milestone prices, so reserve never appears as a separate line the customer can strike. |

---

## 4. The screen, piece by piece

**Top toolbar** (dark bar): manage pursuits (New, Duplicate, Rename, Delete), Undo/Redo, Import/Export JSON, Portfolio (all pursuits in one file), Excel and Word exports, Snapshots, Sync, the Tips toggle, and Print/PDF.

**KPI strip**: the live headline numbers described above. If **Integrity** ever reads anything but ALL OK, stop and open the Integrity Checks tab before trusting the price.

**Sidebar**: the sections, in working order. The Backlog badge shows your epic count; the Integrity Checks badge shows failures.

**Tips**: purple "Tip" boxes on the input-heavy tabs explain what good inputs look like. Turn them off with the **Tips** button once you know your way around.

---

## 5. Building a bid, step by step

The fastest path to a real bid is to duplicate a sample (top bar → **Duplicate**) and replace its content, or press **New** for a blank model. Then work top to bottom:

### Step 1 — Overview & Control (Setup)

Set the global assumptions:

- **Contract Periods**: the base period and however many option periods the contract has. Each period gets a label, a length in months, and a color of money (RDT&E, O&M, …). Every other part of the model (milestones, support labor, funding) hangs off these periods. Add periods with **+ Add option period**.
- **Cadence**: productive hours per sprint per person and working sprints per year — these two drive capacity. (Sprint length in weeks is descriptive only and is not an input.)
- **Wrap rates and economics**: fringe, overhead, G&A, fee, escalation. If different years escalate differently, fill in the per-year override boxes.
- **Confidence, reserve and targets**: P50 vs P80, reserve method, the customer's budget ceiling, and milestone rounding.

### Step 2 — Labor Rates (Setup)

One row per labor category (LCAT). Enter the **direct hourly rate**; the loaded rate computes automatically from the wrap rates. Two things make this defensible in a cost review:

- **Tag every rate with a basis**: *Actual staff* for a named incumbent, *Survey / HR3D* for a to-be-hired role (and record the years of experience, degree, and location behind the survey number). Untagged rates raise a warning.
- If you price under a forward-pricing rate agreement, switch on **FPRA per-year rates** to enter each year's direct rate explicitly instead of using uniform escalation.

The **Indirect-Rate Library** at the top lets you save and swap whole wrap-rate sets (e.g. "Full Government Burden" vs "Commercial") to compare cost bases instantly.

### Step 3 — Team Archetypes (Setup)

Define your standard team shapes: how many of each LCAT sits on a "Platform team" or an "Apps squad", that team's steady velocity, and how many copies of it you're staffing. The tool derives each team's **cost per sprint**, which is the engine that turns sprints into dollars.

### Step 4 — Backlog (Scope)

The heart of the bid. One row per epic with capability, PI year, the milestone it pays under, the team type doing it, and the **Low / Likely / High** points.

Three ways to fill it:

1. Type rows by hand (**+ Add epic**).
2. **Import / Paste**: paste a block copied from Excel, or load a Jira / Azure DevOps CSV export. The dialog auto-detects which column is the summary, the story points, and the sprint, lets you correct it, and derives Low/High from the likely points using a spread you set.
3. Duplicate a previous pursuit and edit.

Two rules: the **Milestone** name on each row must match a row on the Milestones tab (a yellow banner warns you when it doesn't), and resist the urge to make Low and High hug Likely. A honest wide range produces an honest reserve.

### Step 5 — Velocity & Reserve (Scope)

Enter 3 to 6 sprints of **real velocity history** from a comparable team. The variation in those samples (the CoV) competes with your estimate spread to size the risk reserve, so this is where the reserve gets its credibility. Also set the capacity reserve and the first-year ramp factor (new teams run slower in PI 1).

### Step 6 — Time-Phasing, LOE, Program Support, ODC (Scope)

- **Time-Phasing (Surge & AI)**: per PI year, scale the funded capacity up or down (surge), and apply an AI/automation productivity factor above 1.0 if you expect tooling to let the same team clear more points in the out-years.
- **Persistent LOE**: staffed, time-based work that isn't story points: cATO continuous monitoring, 24/7 help desk, on-call. FTE × loaded rate × months.
- **Program Support**: PM office, finance, contracts, business management. Costed like LOE; a toggle controls whether it's in the priced total or carried on the side.
- **ODC**: cloud, licenses, hardware, travel, entered per program year with a basis ("120 seats × $2.5k/yr"). A completeness checklist flags categories estimators routinely forget.

### Step 7 — Milestones and Teaming (Outputs)

- **Milestones**: the payable events. Each has a period, a month offset from contract start, optional fixed dollars (kickoff, mobilization), and a value KPI with an acceptance threshold for gated payments. Backlog labor maps to milestones by name; LOE/support/ODC spread across the same-period milestones pro-rata.
- **Teaming**: subcontractors. Enter a sub's cost as one number, or expand the row and build it bottom-up from the sub's burdened rates × hours. The prime takes the residual share of the total price.

---

## 6. Reading the results

- **Pricing Results**: the full cost-to-price build: P50/P80 cost, reserve, fee, PTW, total; capacity utilization (does the backlog actually fill the teams you staffed?); budget-ceiling check; period split; and which cost element carries which indirect.
- **Milestone Schedule**: the customer-facing payment schedule per period/ALIN, with prime and sub shares per milestone. Export it as CSV.
- **BOE Traceability**: the audit chain per capability: points → effective points → sprints → labor → price. This is the table you defend in an evaluation notice.
- **Value Map**: the value-gated milestones with their KPIs and thresholds, for SOO value-based evaluations.
- **Integrity Checks**: 13 automatic reconciliations (milestones tie to total, periods tie to total, BOE ties to total, teaming sums to 100%, …). **All must read OK before you trust any number in the tool.** A failure almost always means a renamed milestone or an out-of-range input, and the labeled check tells you where to look.

---

## 7. Analysis tools (defend the number)

- **Dashboard**: one screen for a reviewer: advisories, cost-to-price waterfall, milestone cash flow, funding by year. Print/PDF from here.
- **Funding & Color**: milestone payments mapped to federal fiscal years and appropriation type, per contract period.
- **Cost Phasing & Staffing**: the cost stack spread across calendar months: an expenditure curve for spend-plan defense and an **FTE-by-month staffing plan** recruiting can act on. Toggle between cost and price; export the month-level CSV.
- **Risk (Monte Carlo)**: simulates thousands of outcomes from your three-point estimates. Set the **epic correlation** above zero (0.3 to 0.5 is realistic; overruns share causes) and optionally sample velocity per trial. Compare the simulated P80 to the deterministic one to justify the reserve.
- **Sensitivity**: flexes each driver ±10/20/30% and ranks how much the price swings. The longest bar is the assumption to defend hardest (it is almost always velocity or story points).
- **Margin Walk**: the internal view: price vs internal cost target, where the margin comes from.
- **Scenario Compare**: every saved pursuit side by side. **Duplicate** a pursuit, change one assumption, and pin a column as the **baseline** (☆) to see dollar deltas against it.

---

## 8. The second model: Capacity Tiers

The milestone build prices *the work the backlog needs*: bid it when you are competing on price. **Capacity Tiers** prices *a standing team per period*: use it when you are selling a managed capability and the customer reprioritizes through the backlog. Each tier (e.g. Sustainment / Growth / Acceleration) is a menu option with a team mix, an ODC allowance, and a recurring price per period built from the same loaded team costs as everything else, so the two models never disagree on what a team costs. Tiers are alternatives, not additive, and they don't change the milestone price.

The Pricing Results tab shows **sprints needed vs funded** so you can choose deliberately: a big gap is wasted money under a milestone bid but is buffer/margin under a capacity sale.

---

## 9. Managing your work

- **Saving**: automatic, in your browser, on every change. Different browser or computer = different data.
- **Undo/Redo**: toolbar buttons or Ctrl+Z / Ctrl+Y.
- **Snapshots**: freeze a pursuit at a moment ("as-submitted 2026-06-11", "BAFO"). Restore creates a copy; the original is untouched.
- **Export / Import JSON**: one pursuit as a file, for sharing or archiving. **Portfolio** exports everything at once. Always export before clearing browser data.
- **Sync** (optional): if your team runs the bundled sync server (`npm run serve:sync` from the repo), the Sync dialog pushes/pulls the whole portfolio to a shared server with conflict detection. Nothing is sent until you push.
- **Excel**: a multi-sheet workbook where the rate build, PERT math, sprint conversion, and the cost-to-price stack are **live formulas** a reviewer can trace and flex. **Word**: a proposal extract (.docx) with the payment schedule and BOE. **Print/PDF**: any screen, print-formatted.

---

## 10. Common pitfalls

1. **Velocity from memory.** One optimistic velocity poisons every number downstream. Use sprint actuals from a comparable team or widen your backlog ranges and lean on P80.
2. **Tight Low/High ranges.** Anchoring around Likely produces a thin reserve and a confident wrong answer. The tool warns when the effective reserve drops under 3%.
3. **Milestone name mismatches.** Renaming a milestone in one place but not the other strands labor with no payable event. The Backlog banner and Integrity check 6 both catch it; fix names on the Milestones tab (renaming there updates backlog rows automatically).
4. **Forgetting ODC categories.** Run down the completeness checklist on the ODC tab: cATO assessor costs, GFE gaps, and data egress are the usual misses.
5. **Ignoring utilization.** Under 70% means you staffed more team than the backlog needs (bid to demand or switch to capacity tiers); over 105% means the backlog doesn't fit the teams (add capacity or cut scope).
6. **Trusting a price with a failing integrity check.** Don't. The checks exist because spreadsheet-style silent errors are the failure mode of every pricing model.

---

## 11. Where the data lives, and what not to put in it

Everything you enter stays in your browser's local storage on your machine. The public web app sends nothing anywhere; the only ways data leaves are the export buttons and the optional Sync push, both of which you trigger. Practical consequences:

- Clearing browser data deletes your pursuits. Export JSON backups of anything that matters.
- The seed pursuits are placeholders. **Do not enter CUI, controlled, or proprietary data** unless you are running a private, accredited deployment, and never point Sync at a server that isn't approved for the data involved.

---

## 12. Quick reference

| I want to… | Go to / press |
| --- | --- |
| Start a new bid | Top bar → **New** (type "baseline" in the name to start from the reference model) |
| Try every feature with data filled in | Pursuit selector → **Feature Showcase** |
| Bring in a Jira/ADO backlog | **Backlog** → **Import / Paste** |
| See why the price moved | **Sensitivity** → ±20% |
| Defend the reserve | **Risk (Monte Carlo)** → set correlation → Run trials |
| Get the customer payment schedule | **Milestone Schedule** → Export CSV |
| Get the auditable workbook | Top bar → **Excel** |
| Compare two approaches | **Duplicate**, edit, then **Scenario Compare** → pin baseline |
| Freeze the as-submitted version | Top bar → **Snapshots** → Take snapshot |
| Recover from a mistake | **Undo** (Ctrl+Z) |
