/**
 * Contract Sync Tests
 *
 * Verifie que le frontend lit les bons champs des reponses API backend.
 * Previent les regressions de type: frontend lit .clients quand backend renvoie .data
 *
 * Ces tests analysent STATIQUEMENT le code source TypeScript.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

const SRC_DIR = path.resolve(__dirname, '..');
const PAGES_DIR = path.join(SRC_DIR, 'pages');
const COMPONENTS_DIR = path.join(SRC_DIR, 'components');

function readFile(relPath: string): string {
  const fullPath = path.join(SRC_DIR, relPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${relPath}`);
  }
  return fs.readFileSync(fullPath, 'utf-8');
}

function findFile(name: string, searchDirs: string[]): string | null {
  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    const entries = fs.readdirSync(dir, { recursive: true, encoding: 'utf-8' });
    for (const entry of entries) {
      if (typeof entry === 'string' && entry.endsWith(name)) {
        return path.join(dir, entry);
      }
    }
  }
  return null;
}

function readAbsolute(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

// ============================================================
// Signup — verified_token (NOT token)
// ============================================================
describe('Signup — verified_token contract', () => {
  let content: string;

  beforeAll(() => {
    content = readFile('pages/Signup.tsx');
  });

  it('should read data.verified_token after SMS verify', () => {
    expect(content).toContain('verified_token');
  });

  it('should NOT read bare data.token for SMS verify', () => {
    // Check that there's no pattern like `data.token` that's not `data.verified_token`
    // in the SMS verification section
    const smsSection = content.match(/sms.*verify[\s\S]*?verified_token/i);
    expect(smsSection).toBeTruthy();
  });

  it('should store sms_verified_token in form state', () => {
    expect(content).toContain('sms_verified_token');
  });
});

// ============================================================
// DevisFormModal — reads .data (NOT .clients)
// ============================================================
describe('DevisFormModal — clients list contract', () => {
  let content: string;

  beforeAll(() => {
    const file = findFile('DevisFormModal.tsx', [COMPONENTS_DIR]);
    expect(file).toBeTruthy();
    content = readAbsolute(file!);
  });

  it('should type clients response as { data: Client[] }', () => {
    expect(content).toMatch(/data:\s*Client\[\]/);
  });

  it('should read clientsData.data (NOT .clients)', () => {
    expect(content).toMatch(/clientsData\??\.\s*data/);
  });

  it('should NOT read clientsData.clients', () => {
    expect(content).not.toMatch(/clientsData\??\.\s*clients/);
  });
});

// ============================================================
// Pipeline — reads .data (NOT .clients) for client search
// ============================================================
describe('Pipeline — clients search contract', () => {
  let content: string;

  beforeAll(() => {
    content = readFile('pages/Pipeline.tsx');
  });

  it('should type search response as { data: Client[] }', () => {
    // The useQuery for clients-search should use data type
    const searchQuery = content.match(/clients-search[\s\S]*?api\.get/);
    expect(searchQuery).toBeTruthy();
    expect(content).toMatch(/useQuery<\{\s*data:\s*Client\[\]\s*\}>/);
  });

  it('should read .data from clients search response', () => {
    expect(content).toMatch(/clientsData[\s\S]*?\.data\b/);
  });

  it('should NOT read .clients from /admin/clients response', () => {
    // clientsData?.clients or clientsData!.clients = BUG (backend returns .data)
    // But opp.clients.prenom = OK (Supabase join)
    const badPattern = /clientsData[?!]*\.clients\b/;
    expect(content).not.toMatch(badPattern);
  });
});

// ============================================================
// getPaginated — normalizes to .items
// ============================================================
describe('api.getPaginated — normalization contract', () => {
  let content: string;

  beforeAll(() => {
    content = readFile('lib/api.ts');
  });

  it('should return { items, pagination } from getPaginated', () => {
    expect(content).toMatch(/items:\s*raw\.data/);
  });

  it('should read raw.data from backend (NOT raw.items)', () => {
    const getPaginatedSection = content.match(/getPaginated[\s\S]*?return\s*\{[\s\S]*?\}/);
    expect(getPaginatedSection).toBeTruthy();
    expect(getPaginatedSection![0]).toContain('raw.data');
  });
});

// ============================================================
// All pages using /admin/clients — must use .data format
// ============================================================
describe('All /admin/clients consumers — .data format', () => {
  it('should not have any page reading clientsData.clients from /admin/clients', () => {
    // Scan all pages for the anti-pattern
    if (!fs.existsSync(PAGES_DIR)) return;

    const pages = fs.readdirSync(PAGES_DIR).filter(f => f.endsWith('.tsx'));
    const violations: string[] = [];

    for (const page of pages) {
      const content = fs.readFileSync(path.join(PAGES_DIR, page), 'utf-8');
      // Check for: fetches /admin/clients AND reads .clients on the response
      const fetchesClients = content.includes('/admin/clients');
      const readsClientsField = /clientsData[\s!]*\.clients\b/.test(content);
      if (fetchesClients && readsClientsField) {
        violations.push(page);
      }
    }

    expect(violations).toEqual([]);
  });
});
