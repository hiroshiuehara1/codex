export interface DependencyFinding {
  package: string;
  cve: string;
  cvss: number;
}

export interface DependencyReport {
  findings: DependencyFinding[];
}

export function violatesDependencyPolicy(
  report: DependencyReport,
  maxCvss = 7
): string[] {
  return report.findings
    .filter((finding) => finding.cvss >= maxCvss)
    .map(
      (finding) =>
        `${finding.package} (${finding.cve}) has CVSS ${finding.cvss}, threshold ${maxCvss}`
    );
}
