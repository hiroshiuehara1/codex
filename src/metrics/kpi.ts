export interface LeadTimeInput {
  openedAt: string;
  deployedAt: string;
}

export interface QualityInput {
  baselineEscapedDefects: number;
  currentEscapedDefects: number;
}

export function leadTimeHours(input: LeadTimeInput): number {
  const opened = new Date(input.openedAt).getTime();
  const deployed = new Date(input.deployedAt).getTime();
  return Math.max(0, (deployed - opened) / (1000 * 60 * 60));
}

export function escapedDefectDeltaPct(input: QualityInput): number {
  if (input.baselineEscapedDefects === 0) {
    return input.currentEscapedDefects === 0 ? 0 : 100;
  }

  return ((input.currentEscapedDefects - input.baselineEscapedDefects) /
    input.baselineEscapedDefects) *
    100;
}
