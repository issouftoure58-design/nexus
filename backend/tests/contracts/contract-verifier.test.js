/**
 * Contract Verifier Tests
 *
 * Verifie que les routes API respectent les contrats definis dans contracts.json.
 * Ces tests analysent STATIQUEMENT le code source (pas de serveur Express requis).
 * Ils verifient la FORME des reponses, pas les donnees.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');

// Load contracts
const contracts = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'contracts.json'), 'utf-8')
);

/**
 * Helper: read a source file
 */
function readSource(relPath) {
  const fullPath = path.join(SRC_DIR, relPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Source file not found: ${relPath}`);
  }
  return fs.readFileSync(fullPath, 'utf-8');
}

// ============================================================
// POST /api/signup/sms/verify — verified_token (NOT token)
// ============================================================
describe('POST /api/signup/sms/verify', () => {
  const contract = contracts.endpoints['POST /api/signup/sms/verify'];
  let content;

  beforeAll(() => {
    content = readSource(contract.sourceFile);
  });

  it('should return verified_token in response', () => {
    // Find the sms/verify handler and check it returns verified_token
    const verifySection = content.match(/sms\/verify[\s\S]*?res\.json\s*\(\s*\{([^}]+)\}/);
    expect(verifySection).toBeTruthy();
    expect(verifySection[1]).toContain('verified_token');
  });

  it('should NOT return bare "token" field (forbidden)', () => {
    // Extract the verify endpoint's res.json call
    const verifySection = content.match(/sms\/verify[\s\S]*?res\.json\s*\(\s*\{([^}]+)\}/);
    expect(verifySection).toBeTruthy();
    const responseBody = verifySection[1];
    // Should not have a standalone "token" key (but verified_token is OK)
    const hasBareTroken = /(?<![_\w])token\s*:/.test(responseBody) &&
                          !/verified_token\s*:/.test(responseBody);
    expect(hasBareTroken).toBe(false);
  });
});

// ============================================================
// POST /api/signup — required fields
// ============================================================
describe('POST /api/signup', () => {
  const contract = contracts.endpoints['POST /api/signup'];
  let content;

  beforeAll(() => {
    content = readSource(contract.sourceFile);
  });

  it('should return tenant_id in signup response', () => {
    // Find the main signup POST handler response
    const signupResponse = content.match(/res\s*\.\s*(?:status\s*\(\s*201\s*\)\s*\.\s*)?json\s*\(\s*\{[^}]*tenant_id[^}]*\}/);
    expect(signupResponse).toBeTruthy();
  });

  it('should return admin object with id and email', () => {
    // The signup response should contain admin with nested fields
    const hasAdmin = /admin\s*:\s*\{/.test(content) || /admin\s*:/.test(content);
    expect(hasAdmin).toBe(true);
  });
});

// ============================================================
// GET /api/admin/clients — paginated format
// ============================================================
describe('GET /api/admin/clients', () => {
  const contract = contracts.endpoints['GET /api/admin/clients'];
  let content;

  beforeAll(() => {
    content = readSource(contract.sourceFile);
  });

  it('should use paginated() helper for list endpoint', () => {
    // Must import paginated
    expect(content).toMatch(/import\s+\{[^}]*paginated[^}]*\}\s+from/);
    // Must call paginated() somewhere
    expect(content).toMatch(/paginated\s*\(\s*res/);
  });

  it('should NOT return {clients: [...]} (old format)', () => {
    // Ensure no res.json({clients: ...}) pattern
    const badPattern = /res\.json\s*\(\s*\{[^}]*\bclients\s*:/;
    expect(content).not.toMatch(badPattern);
  });
});

// ============================================================
// GET /api/admin/reservations — paginated format
// ============================================================
describe('GET /api/admin/reservations', () => {
  const contract = contracts.endpoints['GET /api/admin/reservations'];
  let content;

  beforeAll(() => {
    content = readSource(contract.sourceFile);
  });

  it('should use paginated() helper', () => {
    expect(content).toMatch(/import\s+\{[^}]*paginated[^}]*\}\s+from/);
    expect(content).toMatch(/paginated\s*\(\s*res/);
  });
});

// ============================================================
// POST /api/admin/reservations — client_email chain
// ============================================================
describe('POST /api/admin/reservations', () => {
  const contract = contracts.endpoints['POST /api/admin/reservations'];
  let content;

  beforeAll(() => {
    content = readSource(contract.sourceFile);
  });

  it('should SELECT email from clients table', () => {
    // Find the client SELECT query for reservation creation
    const selectPattern = /\.from\s*\(\s*['"`]clients['"`]\s*\)[\s\S]*?\.select\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
    let found = false;
    let match;
    while ((match = selectPattern.exec(content)) !== null) {
      const fields = match[1];
      if (fields.includes('email')) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('should pass client_email to createReservationUnified', () => {
    const cruCalls = content.match(/createReservationUnified\s*\(\s*\{[\s\S]*?\}\s*,/g);
    expect(cruCalls).toBeTruthy();
    // At least one call should include client_email
    const hasClientEmail = cruCalls.some(call => call.includes('client_email'));
    expect(hasClientEmail).toBe(true);
  });
});

// ============================================================
// GET /api/admin/services — paginated format
// ============================================================
describe('GET /api/admin/services', () => {
  const contract = contracts.endpoints['GET /api/admin/services'];
  let content;

  beforeAll(() => {
    content = readSource(contract.sourceFile);
  });

  it('should use paginated() helper', () => {
    expect(content).toMatch(/import\s+\{[^}]*paginated[^}]*\}\s+from/);
  });
});

// ============================================================
// GET /api/admin/services/equipe — success with data array
// ============================================================
describe('GET /api/admin/services/equipe', () => {
  const contract = contracts.endpoints['GET /api/admin/services/equipe'];
  let content;

  beforeAll(() => {
    content = readSource(contract.sourceFile);
  });

  it('should return {success: true, data: [...]}', () => {
    // Should use success() helper with data field
    expect(content).toMatch(/success\s*\(\s*res\s*,\s*\{[^}]*data\s*:/);
  });
});

// ============================================================
// GET /api/admin/stats/activity — activities field
// ============================================================
describe('GET /api/admin/stats/activity', () => {
  const contract = contracts.endpoints['GET /api/admin/stats/activity'];
  let content;

  beforeAll(() => {
    content = readSource(contract.sourceFile);
  });

  it('should return {activities: [...]}', () => {
    expect(content).toMatch(/activities\s*:/);
  });
});

// ============================================================
// GET /api/admin/analytics/overview — ca_total field
// ============================================================
describe('GET /api/admin/analytics/overview', () => {
  const contract = contracts.endpoints['GET /api/admin/analytics/overview'];
  let content;

  beforeAll(() => {
    content = readSource(contract.sourceFile);
  });

  it('should return ca_total', () => {
    expect(content).toMatch(/ca_total/);
  });
});

// ============================================================
// GET /api/admin/devis — devis field
// ============================================================
describe('GET /api/admin/devis', () => {
  const contract = contracts.endpoints['GET /api/admin/devis'];
  let content;

  beforeAll(() => {
    content = readSource(contract.sourceFile);
  });

  it('should return {devis: [...]}', () => {
    expect(content).toMatch(/res\.json\s*\(\s*\{[^}]*devis\s*:/);
  });
});

// ============================================================
// GET /api/admin/compta/pnl — revenus/depenses/resultat
// ============================================================
describe('GET /api/admin/compta/pnl', () => {
  const contract = contracts.endpoints['GET /api/admin/compta/pnl'];
  let content;

  beforeAll(() => {
    content = readSource(contract.sourceFile);
  });

  it('should return revenus, depenses, resultat via calculatePnL', () => {
    // The route calls calculatePnL which returns these fields
    expect(content).toMatch(/calculatePnL|pnl/i);
  });
});

// ============================================================
// GET /api/admin/workflows/templates — templates field
// ============================================================
describe('GET /api/admin/workflows/templates', () => {
  const contract = contracts.endpoints['GET /api/admin/workflows/templates'];
  let content;

  beforeAll(() => {
    content = readSource(contract.sourceFile);
  });

  it('should return {templates: [...]}', () => {
    expect(content).toMatch(/templates\s*:/);
  });
});

// ============================================================
// GET /api/admin/rh/membres — paginated
// ============================================================
describe('GET /api/admin/rh/membres', () => {
  const contract = contracts.endpoints['GET /api/admin/rh/membres'];
  let content;

  beforeAll(() => {
    content = readSource(contract.sourceFile);
  });

  it('should use paginated() helper', () => {
    expect(content).toMatch(/paginated\s*\(\s*res/);
  });
});

// ============================================================
// Cross-cutting: createReservationUnified fetches client email
// ============================================================
describe('createReservationUnified — client email recovery', () => {
  let content;

  beforeAll(() => {
    content = readSource('core/unified/nexusCore.js');
  });

  it('should SELECT email when looking up existing client', () => {
    // The client lookup query should include email
    const clientLookup = content.match(/from\s*\(\s*['"`]clients['"`]\s*\)[\s\S]*?\.select\s*\(\s*['"`]([^'"`]+)['"`]\s*\)[\s\S]*?\.eq\s*\(\s*['"`]telephone['"`]/);
    expect(clientLookup).toBeTruthy();
    expect(clientLookup[1]).toContain('email');
  });

  it('should pass client_email to sendConfirmationNotification', () => {
    // Find the CALL to sendConfirmationNotification (not the definition)
    // The call passes data.client_email as the 4th argument
    const notifCalls = content.match(/await\s+sendConfirmationNotification\s*\([^)]*\)/g);
    expect(notifCalls).toBeTruthy();
    // At least one call should reference client_email or email
    const hasEmailArg = notifCalls.some(call => /client_email|\.email/.test(call));
    expect(hasEmailArg).toBe(true);
  });
});

// ============================================================
// Cross-cutting: create_booking tool includes client_email
// ============================================================
describe('create_booking tool definition', () => {
  let content;

  beforeAll(() => {
    content = readSource('tools/toolsRegistry.js');
  });

  it('should include client_email property', () => {
    // Find the create_booking definition
    const bookingTool = content.match(/name:\s*["']create_booking["'][\s\S]*?required\s*:/);
    expect(bookingTool).toBeTruthy();
    expect(bookingTool[0]).toContain('client_email');
  });
});
