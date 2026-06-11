import type { ComponentType } from 'react';
import { MarginWalk, Risk, ScenarioCompare, Sensitivity } from './Analysis';
import { Backlog } from './Backlog';
import { Capacity } from './Capacity';
import { Dashboard, Funding } from './Dashboard';
import { Loe, PSupport } from './Loe';
import { Milestones, Teaming } from './Milestones';
import { Odc } from './Odc';
import { Boe, Checks, Mps, ValueMap } from './Outputs';
import { Overview } from './Overview';
import { Rates } from './Rates';
import { Results } from './Results';
import { Staffing } from './Staffing';
import { StartHere } from './StartHere';
import { Teams } from './Teams';
import { Phasing } from './Phasing';
import { Velocity } from './Velocity';

export interface SectionDef {
  id: string;
  label: string;
  component: ComponentType;
}

export interface SectionGroup {
  group: string;
  items: SectionDef[];
}

export const SECTION_GROUPS: SectionGroup[] = [
  { group: 'Guide', items: [{ id: 'start', label: 'Start Here', component: StartHere }] },
  {
    group: 'Setup',
    items: [
      { id: 'overview', label: 'Overview & Control', component: Overview },
      { id: 'rates', label: 'Labor Rates', component: Rates },
      { id: 'teams', label: 'Team Archetypes', component: Teams },
    ],
  },
  {
    group: 'Scope',
    items: [
      { id: 'backlog', label: 'Backlog', component: Backlog },
      { id: 'velocity', label: 'Velocity & Reserve', component: Velocity },
      { id: 'phasing', label: 'Time-Phasing (Surge & AI)', component: Phasing },
      { id: 'loe', label: 'Persistent LOE', component: Loe },
      { id: 'psupport', label: 'Program Support', component: PSupport },
      { id: 'odc', label: 'ODC', component: Odc },
    ],
  },
  {
    group: 'Outputs',
    items: [
      { id: 'milestones', label: 'Milestones', component: Milestones },
      { id: 'teaming', label: 'Teaming', component: Teaming },
      { id: 'results', label: 'Pricing Results', component: Results },
      { id: 'mps', label: 'Milestone Schedule', component: Mps },
      { id: 'boe', label: 'BOE Traceability', component: Boe },
      { id: 'value', label: 'Value Map', component: ValueMap },
      { id: 'checks', label: 'Integrity Checks', component: Checks },
    ],
  },
  { group: 'Subscription Model', items: [{ id: 'capacity', label: 'Capacity Tiers', component: Capacity }] },
  {
    group: 'Analysis',
    items: [
      { id: 'dashboard', label: 'Dashboard', component: Dashboard },
      { id: 'funding', label: 'Funding & Color', component: Funding },
      { id: 'staffing', label: 'Cost Phasing & Staffing', component: Staffing },
      { id: 'risk', label: 'Risk (Monte Carlo)', component: Risk },
      { id: 'sensitivity', label: 'Sensitivity', component: Sensitivity },
      { id: 'margin', label: 'Margin Walk', component: MarginWalk },
      { id: 'scenario', label: 'Scenario Compare', component: ScenarioCompare },
    ],
  },
];

export const SECTIONS: Record<string, SectionDef> = Object.fromEntries(
  SECTION_GROUPS.flatMap((g) => g.items).map((s) => [s.id, s]),
);
