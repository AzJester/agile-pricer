import { Callout, Card, Note, Section } from '../components/ui';

function Step(props: { n: number; title: string; body: string }) {
  return (
    <div className="startcard">
      <div className="startnum">{props.n}</div>
      <div>
        <b>{props.title}</b>
        <div className="sub" style={{ marginTop: 3 }}>
          {props.body}
        </div>
      </div>
    </div>
  );
}

export function StartHere() {
  return (
    <Section
      title="Start Here"
      sub={
        <>
          A two-minute orientation. New reviewers should read this, then open the <b>Feature Showcase</b> pursuit from the
          selector at the top to see every capability populated.
        </>
      }
    >
      <Callout color="var(--twilight)">
        <b>This tool is illustrative.</b> Every figure is a placeholder. Do not enter CUI, controlled, or proprietary program
        data unless you are working in an accredited environment.
      </Callout>
      <Card title="What this is">
        <div className="sub">
          A model that turns an agile backlog into a defensible, fixed-price milestone bid: it estimates the labor from story
          points and velocity, adds LOE, program support, and ODC, applies reserve and fee, and ties everything to a milestone
          payment schedule and a basis of estimate. It produces a <b>cost basis and BOE your pricing team builds around</b>. It
          is not your full pricing submission.
        </div>
      </Card>
      <Card title="The model is only as good as its inputs">
        <div className="sub">
          Story points, velocity, and capacity reserve drive the whole estimate. A single one of them a standard deviation off
          the mark produces a confident but wrong number. Source each from past performance where you can, record the basis,
          and use the <b>Sensitivity</b> tab to see which inputs move the price most before you trust the total.
        </div>
      </Card>
      <Card title="Recommended order">
        <Step
          n={1}
          title="Set the program controls"
          body="Overview tab: period of performance, wrap rates (or apply an indirect set), fee, escalation, confidence level, and budget ceiling."
        />
        <Step
          n={2}
          title="Build the rate basis"
          body="Labor Rates: direct rate per LCAT, and tag each as Actual or Survey/HR3D with the qualifications behind it."
        />
        <Step
          n={3}
          title="Define teams and the backlog"
          body="Team Archetypes for the squads, then Backlog with three-point story-point estimates mapped to capabilities and milestones."
        />
        <Step
          n={4}
          title="Calibrate velocity and reserve"
          body="Velocity & Reserve: enter real sprint samples; the spread feeds the risk reserve. Use Time-Phasing for surge years or AI-driven throughput gains."
        />
        <Step
          n={5}
          title="Add the rest of the cost"
          body="Persistent LOE, Program Support (PM/finance/contracts), and ODC with a stated basis. Define payable Milestones."
        />
        <Step
          n={6}
          title="Read and defend the result"
          body="Pricing Results, Milestone Schedule, BOE, Dashboard, Funding, Sensitivity, and Margin Walk. Export to Excel or Word for the proposal."
        />
      </Card>
      <Card title="Two models in one">
        <div className="sub">
          The <b>milestone build</b> prices the work the backlog needs, so bid it when you are competitive. The{' '}
          <b>Capacity Tiers</b> model prices a standing team per period, so use it when you are selling a managed capability
          and the unused capacity is buffer or margin. The Pricing Results tab shows sprints needed versus funded so you can
          choose deliberately.
        </div>
        <Note style={{ marginTop: 12, marginBottom: 0 }}>
          Tips appear on the input-heavy tabs. Toggle them off with the <b>Tips</b> button in the top bar once you know your
          way around.
        </Note>
      </Card>
    </Section>
  );
}
