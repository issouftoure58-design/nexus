#!/usr/bin/env node
/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     CONTRACT LINTER                                      ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║                                                                           ║
 * ║  Verifie que les routes API respectent les contrats definis dans          ║
 * ║  tests/contracts/contracts.json AVANT le commit.                         ║
 * ║                                                                           ║
 * ║  VIOLATIONS DETECTEES:                                                    ║
 * ║  1. res.json() avec champs interdits (ex: token au lieu de verified_token)║
 * ║  2. Endpoints pagines qui n'utilisent pas paginated() helper             ║
 * ║  3. SELECT clients sans email pour reservation (notification cassee)     ║
 * ║  4. createReservationUnified appele sans client_email                    ║
 * ║                                                                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const CONTRACTS_PATH = path.join(ROOT_DIR, 'tests', 'contracts', 'contracts.json');

let totalErrors = 0;
let totalWarnings = 0;
const results = [];

// Load contracts
let contracts;
try {
  contracts = JSON.parse(fs.readFileSync(CONTRACTS_PATH, 'utf-8'));
} catch (err) {
  console.error(`Cannot load contracts: ${err.message}`);
  process.exit(1);
}

// Build a map: sourceFile -> list of contracts
const contractsByFile = {};
for (const [endpoint, contract] of Object.entries(contracts.endpoints)) {
  if (!contract.sourceFile) continue;
  if (!contractsByFile[contract.sourceFile]) {
    contractsByFile[contract.sourceFile] = [];
  }
  contractsByFile[contract.sourceFile].push({ endpoint, ...contract });
}

/**
 * Check a route file against its contracts
 */
function analyzeFile(filePath) {
  const relativePath = path.relative(SRC_DIR, filePath);
  const fileName = path.basename(filePath);

  // Only check files that have contracts
  const fileContracts = contractsByFile[relativePath] || contractsByFile[`src/${relativePath}`];
  if (!fileContracts) return;

  const content = fs.readFileSync(filePath, 'utf-8');
  const fileViolations = [];

  for (const contract of fileContracts) {
    // Skip virtual contracts (they are meta-checks)
    if (contract.virtual) {
      checkVirtualContract(content, contract, fileViolations, filePath);
      continue;
    }

    // Rule 1: Check forbidden fields in res.json()
    if (contract.forbiddenFields) {
      for (const field of contract.forbiddenFields) {
        // Look for res.json({ ... field: ... }) or success(res, { field: ... })
        const patterns = [
          new RegExp(`res\\.json\\s*\\(\\s*\\{[^}]*\\b${field}\\b\\s*:`, 'g'),
          new RegExp(`success\\s*\\(\\s*res\\s*,\\s*\\{[^}]*\\b${field}\\b\\s*:`, 'g'),
        ];
        for (const pattern of patterns) {
          let match;
          while ((match = pattern.exec(content)) !== null) {
            // Make sure it's the right endpoint context
            const lineNum = content.slice(0, match.index).split('\n').length;
            fileViolations.push({
              line: lineNum,
              type: 'ERROR',
              message: `[${contract.endpoint}] Champ interdit '${field}' dans la reponse. Contrat exige: ${contract.fields?.join(', ')}`,
              code: match[0].slice(0, 80),
            });
            totalErrors++;
          }
        }
      }
    }

    // Rule 2: Paginated endpoints must use paginated() helper, NOT res.json({data:...})
    if (contract.format === 'paginated') {
      // Check if the file imports paginated
      const importsPaginated = /import\s+\{[^}]*paginated[^}]*\}\s+from/.test(content);
      if (!importsPaginated) {
        fileViolations.push({
          line: 1,
          type: 'WARNING',
          message: `[${contract.endpoint}] Endpoint pagine mais paginated() non importe`,
          code: 'import { paginated } from \'../utils/response.js\'',
        });
        totalWarnings++;
      }
    }

    // Rule 3: Check that client SELECT includes required fields
    if (contract.clientSelectMustInclude) {
      // Find .from('clients').select('...') patterns
      const selectPattern = /\.from\s*\(\s*['"`]clients['"`]\s*\)[\s\S]*?\.select\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
      let selectMatch;
      while ((selectMatch = selectPattern.exec(content)) !== null) {
        const selectedFields = selectMatch[1].split(',').map(f => f.trim());
        for (const requiredField of contract.clientSelectMustInclude) {
          if (!selectedFields.includes(requiredField) && !selectedFields.includes('*')) {
            const lineNum = content.slice(0, selectMatch.index).split('\n').length;
            fileViolations.push({
              line: lineNum,
              type: 'ERROR',
              message: `[${contract.endpoint}] SELECT clients manque '${requiredField}' — notifications seront cassees`,
              code: selectMatch[0].slice(0, 80),
            });
            totalErrors++;
          }
        }
      }
    }

    // Rule 4: Check that createReservationUnified receives required fields
    if (contract.mustCallCreateReservationUnifiedWith) {
      const cruPattern = /createReservationUnified\s*\(\s*\{([\s\S]*?)\}\s*,/g;
      let cruMatch;
      while ((cruMatch = cruPattern.exec(content)) !== null) {
        const callBody = cruMatch[1];
        for (const requiredField of contract.mustCallCreateReservationUnifiedWith) {
          if (!callBody.includes(requiredField)) {
            const lineNum = content.slice(0, cruMatch.index).split('\n').length;
            fileViolations.push({
              line: lineNum,
              type: 'ERROR',
              message: `[${contract.endpoint}] createReservationUnified() manque '${requiredField}' — cascade notification cassee`,
              code: `createReservationUnified({...}) sans ${requiredField}`,
            });
            totalErrors++;
          }
        }
      }
    }
  }

  if (fileViolations.length > 0) {
    results.push({
      file: relativePath,
      violations: fileViolations,
    });
  }
}

/**
 * Check virtual contracts (cross-cutting concerns)
 */
function checkVirtualContract(content, contract, fileViolations, filePath) {
  // Check that notification calls pass required fields
  if (contract.mustPassToNotification) {
    const notifPattern = /sendConfirmationNotification\s*\([^)]*\)/g;
    let match;
    while ((match = notifPattern.exec(content)) !== null) {
      const callStr = match[0];
      for (const field of contract.mustPassToNotification) {
        // Simple heuristic: the field name should appear somewhere in the arguments
        if (!callStr.includes(field) && !callStr.includes('client_email') && field === 'client_email') {
          // Check broader context (the 4th argument should be the email)
          const args = callStr.split(',');
          if (args.length < 4 || !args[3]?.includes('email')) {
            const lineNum = content.slice(0, match.index).split('\n').length;
            fileViolations.push({
              line: lineNum,
              type: 'WARNING',
              message: `[${contract.endpoint}] sendConfirmationNotification() pourrait manquer '${field}'`,
              code: callStr.slice(0, 80),
            });
            totalWarnings++;
          }
        }
      }
    }
  }
}

/**
 * Walk directory recursively
 */
function walkDir(dir) {
  let files;
  try {
    files = fs.readdirSync(dir);
  } catch {
    return;
  }

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        walkDir(filePath);
      }
    } else if (file.endsWith('.js') || file.endsWith('.ts')) {
      analyzeFile(filePath);
    }
  }
}

// Main
console.log('');
console.log('CONTRACT LINTER');
console.log(''.repeat(60));
console.log('');

walkDir(SRC_DIR);

// Display results
if (results.length === 0) {
  console.log('Aucune violation de contrat detectee');
  console.log(`${Object.keys(contracts.endpoints).length} contrats verifies`);
  console.log('');
  process.exit(0);
}

for (const result of results) {
  console.log(`${result.file}`);
  for (const v of result.violations) {
    const icon = v.type === 'ERROR' ? 'ERR' : 'WARN';
    console.log(`   [${icon}] Ligne ${v.line}: ${v.message}`);
    if (v.code) console.log(`      ${v.code}`);
  }
  console.log('');
}

console.log(''.repeat(60));
console.log(`Resultat: ${totalErrors} erreur(s), ${totalWarnings} warning(s)`);
console.log('');

if (totalErrors > 0) {
  console.log('ECHEC - Violations de contrat API detectees');
  console.log('Contrats: tests/contracts/contracts.json');
  console.log('');
  process.exit(1);
}

process.exit(0);
