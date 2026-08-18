import * as fs from 'fs';
import * as path from 'path';
import { MANAGED_API_SCOPES } from '../api-scopes';

const LEGACY_SCOPES = [
  'ReadConfig',
  'ReadSyntheticData',
  'ReadLogContent',
  'ReadEvents',
  'ReadProblems',
  'ReadSecurityProblems',
  'ReadSLO',
];

describe('MANAGED_API_SCOPES', () => {
  it('contains exactly the eight v2 scopes documented in docs/api-token.md', () => {
    expect(MANAGED_API_SCOPES).toEqual([
      'DataExport',
      'entities.read',
      'events.read',
      'logs.read',
      'metrics.read',
      'problems.read',
      'securityProblems.read',
      'slo.read',
    ]);
  });

  it('contains none of the legacy scope names', () => {
    for (const legacyScope of LEGACY_SCOPES) {
      expect(MANAGED_API_SCOPES).not.toContain(legacyScope);
    }
  });

  // A source-text drift guard, not a behavioral test: it is brittle to reformatting (e.g. reordered
  // import specifiers) and does not exercise any user-visible output. The user-visible check - that
  // dynatrace_managed_get_environments_info's response actually emits the corrected scopes and not
  // the legacy ones - lives in src/tools/__tests__/environment-tools.test.ts instead, since that is
  // where the real tool response is produced.
  it('is imported (not re-declared) by both consumers, so they cannot drift apart again', () => {
    const managedAuthClientSource = fs.readFileSync(
      path.join(__dirname, '../../authentication/managed-auth-client.ts'),
      'utf-8',
    );
    const environmentToolsSource = fs.readFileSync(path.join(__dirname, '../../tools/environment-tools.ts'), 'utf-8');

    expect(managedAuthClientSource).toMatch(/import\s*\{\s*MANAGED_API_SCOPES\s*\}\s*from\s*'\.\.\/utils\/api-scopes'/);
    expect(environmentToolsSource).toMatch(/import\s*\{\s*MANAGED_API_SCOPES\s*\}\s*from\s*'\.\.\/utils\/api-scopes'/);

    // Neither file should declare its own local copy of the array.
    expect(managedAuthClientSource).not.toMatch(/const\s+MANAGED_API_SCOPES\s*=/);
    expect(environmentToolsSource).not.toMatch(/const\s+MANAGED_API_SCOPES\s*=/);
  });
});
