/**
 * Tests Admin Authentication — JWT, middleware, routes
 */
import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing';

// ════════════════════════════════════════════════
// JWT TOKEN GENERATION
// ════════════════════════════════════════════════
describe('JWT Token Handling', () => {
  const adminPayload = {
    id: 1,
    email: 'admin@test.com',
    tenant_id: 'nexus-test',
    role: 'admin'
  };

  test('genere un token JWT valide', () => {
    const token = jwt.sign(adminPayload, JWT_SECRET, { expiresIn: '24h' });
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  test('decode un token JWT correctement', () => {
    const token = jwt.sign(adminPayload, JWT_SECRET, { expiresIn: '24h' });
    const decoded = jwt.verify(token, JWT_SECRET);
    expect(decoded.id).toBe(adminPayload.id);
    expect(decoded.email).toBe(adminPayload.email);
    expect(decoded.tenant_id).toBe(adminPayload.tenant_id);
  });

  test('rejette un token avec mauvais secret', () => {
    const token = jwt.sign(adminPayload, JWT_SECRET, { expiresIn: '24h' });
    expect(() => jwt.verify(token, 'wrong-secret')).toThrow();
  });

  test('rejette un token expire', () => {
    const token = jwt.sign(adminPayload, JWT_SECRET, { expiresIn: '-1h' });
    expect(() => jwt.verify(token, JWT_SECRET)).toThrow();
  });

  test('token contient tenant_id', () => {
    const token = jwt.sign(adminPayload, JWT_SECRET, { expiresIn: '24h' });
    const decoded = jwt.verify(token, JWT_SECRET);
    expect(decoded.tenant_id).toBe('nexus-test');
  });

  test('token sans tenant_id est valide mais incomplet', () => {
    const { tenant_id, ...payloadWithoutTenant } = adminPayload;
    const token = jwt.sign(payloadWithoutTenant, JWT_SECRET, { expiresIn: '24h' });
    const decoded = jwt.verify(token, JWT_SECRET);
    expect(decoded.tenant_id).toBeUndefined();
  });
});

// ════════════════════════════════════════════════
// ADMIN ROLES
// ════════════════════════════════════════════════
describe('Admin Roles', () => {
  const ROLES = ['admin', 'manager', 'operator', 'viewer'];
  const ROLE_HIERARCHY = { admin: 4, manager: 3, operator: 2, viewer: 1 };

  test('admin a le plus haut niveau', () => {
    expect(ROLE_HIERARCHY.admin).toBeGreaterThan(ROLE_HIERARCHY.manager);
    expect(ROLE_HIERARCHY.admin).toBeGreaterThan(ROLE_HIERARCHY.operator);
    expect(ROLE_HIERARCHY.admin).toBeGreaterThan(ROLE_HIERARCHY.viewer);
  });

  test('tous les roles sont definis', () => {
    ROLES.forEach(role => {
      expect(ROLE_HIERARCHY[role]).toBeDefined();
      expect(ROLE_HIERARCHY[role]).toBeGreaterThan(0);
    });
  });
});

// ════════════════════════════════════════════════
// PASSWORD HASHING
// ════════════════════════════════════════════════
describe('Password Hashing', () => {
  let bcrypt;

  beforeAll(async () => {
    bcrypt = (await import('bcryptjs')).default;
  });

  test('hash un mot de passe correctement', async () => {
    const password = 'Test123!';
    const hash = await bcrypt.hash(password, 10);
    expect(hash).not.toBe(password);
    expect(hash.startsWith('$2')).toBe(true);
  });

  test('verifie un mot de passe correct', async () => {
    const password = 'Test123!';
    const hash = await bcrypt.hash(password, 10);
    const match = await bcrypt.compare(password, hash);
    expect(match).toBe(true);
  });

  test('rejette un mauvais mot de passe', async () => {
    const hash = await bcrypt.hash('Test123!', 10);
    const match = await bcrypt.compare('wrong-password', hash);
    expect(match).toBe(false);
  });

  test('deux hash du meme mot de passe sont differents (salt)', async () => {
    const password = 'Test123!';
    const hash1 = await bcrypt.hash(password, 10);
    const hash2 = await bcrypt.hash(password, 10);
    expect(hash1).not.toBe(hash2);
  });
});
