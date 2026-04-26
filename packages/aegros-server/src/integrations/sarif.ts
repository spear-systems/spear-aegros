import type { ReportArtifactV2 } from '@spearsystems/aegros-core';

function sarifLevel(severity: string): 'error' | 'warning' | 'note' | 'none' {
  if (severity === 'critical' || severity === 'high') return 'error';
  if (severity === 'medium') return 'warning';
  if (severity === 'low') return 'note';
  return 'note';
}

/** Minimal SARIF 2.1.0 for dev workflows (GitHub Advanced Security compatible shape). */
export function reportToSarif(report: ReportArtifactV2): Record<string, unknown> {
  return {
    $schema:
      'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'Spear Aegros',
            informationUri: 'https://spear.systems',
            version: '0.1.0-beta',
          },
        },
        results: report.findings.map((f) => ({
          ruleId: f.category,
          message: { text: f.title + (f.description ? ` — ${f.description}` : '') },
          level: sarifLevel(f.severity),
          properties: {
            id: f.id,
            severity: f.severity,
            source: f.source,
          },
        })),
      },
    ],
  };
}
