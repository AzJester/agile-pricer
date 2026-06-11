/** Route an advisory to the screen that fixes it, keyed off its wording. */
export function advisoryTarget(msg: string): { tab: string; label: string } {
  const rules: [RegExp, string, string][] = [
    [/capacity reserve/i, 'velocity', 'Velocity & Reserve'],
    [/utilization/i, 'phasing', 'Time-Phasing'],
    [/effective reserve/i, 'velocity', 'Velocity & Reserve'],
    [/budget ceiling/i, 'overview', 'Overview'],
    [/ODC/, 'odc', 'Other Direct Costs'],
    [/milestone price/i, 'milestones', 'Milestones'],
    [/velocity has fewer|historical sample/i, 'velocity', 'Velocity & Reserve'],
    [/rate.*basis|documented basis/i, 'rates', 'Labor Rates'],
    [/tier/i, 'capacity', 'Capacity Tiers'],
  ];
  for (const [re, tab, label] of rules) if (re.test(msg)) return { tab, label };
  return { tab: 'checks', label: 'Integrity Checks' };
}
