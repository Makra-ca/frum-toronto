import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * PUT /api/shuls/[id] previously wrote `body.*` into the update with no
 * validation of any kind. The public shul page rendered `href={shul.website}`
 * raw, and the route's own comment notes that shul-manager edits go live without
 * review — so a manager could store `javascript:...` and have it become a
 * clickable link on a public page.
 *
 * These tests assert on what actually reaches the database, because a 200 with a
 * poisoned value written is the failure mode that matters.
 */
const mocks = vi.hoisted(() => {
  const state = {
    session: { user: { id: '7', role: 'shul', name: 'Manager' } } as {
      user: { id: string; role: string; name?: string };
    } | null,
    canManage: true,
    /** What assertCanPost returns: null = allowed, a Response = refused. */
    postBlocked: null as Response | null,
  };
  const setValues = vi.fn();
  return { state, setValues };
});

// The route gained the verified-and-not-blocked gate, which reads the database.
// Mocked here so these tests stay about URL validation; the gate itself is
// covered by tests/shul-document-edit-guards.test.ts and the case below.
vi.mock('@/lib/auth/require-verified', () => ({
  assertCanPost: vi.fn(async () => mocks.state.postBlocked),
}));

vi.mock('@/lib/auth/auth', () => ({
  auth: vi.fn(async () => mocks.state.session),
}));

vi.mock('@/lib/auth/permissions', () => ({
  canUserManageShul: vi.fn(async () => mocks.state.canManage),
}));

vi.mock('@/lib/notifications', () => ({
  notifyAdminOfSubmission: vi.fn(async () => undefined),
}));

vi.mock('@/lib/db', () => ({
  db: {
    update: vi.fn(() => ({
      set: vi.fn((values: Record<string, unknown>) => {
        mocks.setValues(values);
        return { where: vi.fn(async () => undefined) };
      }),
    })),
  },
}));

import { PUT } from '@/app/api/shuls/[id]/route';

const VALID = {
  name: 'Test Shul',
  description: null,
  address: null,
  city: null,
  postalCode: null,
  phone: null,
  email: null,
  website: null,
  rabbi: null,
  denomination: null,
  nusach: null,
  hasMinyan: true,
};

function callPut(body: Record<string, unknown>) {
  const request = new Request('http://localhost:3000/api/shuls/1', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return PUT(request, { params: Promise.resolve({ id: '1' }) });
}

beforeEach(() => {
  mocks.state.session = { user: { id: '7', role: 'shul', name: 'Manager' } };
  mocks.state.canManage = true;
  mocks.state.postBlocked = null;
  mocks.setValues.mockClear();
});

describe('PUT /api/shuls/[id] — blocked and unverified accounts', () => {
  it('refuses the write when assertCanPost refuses', async () => {
    // A shul listing goes live with no admin review, and a JWT outlives a
    // block — so this route was one of the higher-value surfaces a disabled
    // account still controlled.
    mocks.state.postBlocked = new Response(
      JSON.stringify({ error: 'This account has been disabled.' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );

    const response = await callPut({ ...VALID, name: 'Renamed While Blocked' });

    expect(response.status).toBe(403);
    expect(mocks.setValues).not.toHaveBeenCalled();
  });
});

describe('PUT /api/shuls/[id] — website is validated', () => {
  it.each([
    'javascript:alert(1)',
    'JavaScript:alert(document.cookie)',
    'data:text/html,<script>alert(1)</script>',
    'httpevil:payload',
    'vbscript:msgbox(1)',
  ])('rejects the unsafe scheme %s with 400 and writes nothing', async (website) => {
    const response = await callPut({ ...VALID, website });

    expect(response.status).toBe(400);
    // The write must not happen at all — a 400 with the row already updated
    // would be the same vulnerability wearing a different status code.
    expect(mocks.setValues).not.toHaveBeenCalled();
  });

  it('adds the scheme a manager leaves off rather than rejecting it', async () => {
    // "myshul.com" is what people actually type. z.string().url() would reject
    // this while accepting javascript: — exactly backwards.
    const response = await callPut({ ...VALID, website: 'myshul.com' });

    expect(response.status).toBe(200);
    expect(mocks.setValues).toHaveBeenCalledWith(
      expect.objectContaining({ website: 'https://myshul.com/' })
    );
  });

  it('stores a normal https website unchanged', async () => {
    const response = await callPut({ ...VALID, website: 'https://myshul.com/minyanim' });

    expect(response.status).toBe(200);
    expect(mocks.setValues).toHaveBeenCalledWith(
      expect.objectContaining({ website: 'https://myshul.com/minyanim' })
    );
  });

  it('stores null for a blank website', async () => {
    const response = await callPut({ ...VALID, website: '   ' });

    expect(response.status).toBe(200);
    expect(mocks.setValues).toHaveBeenCalledWith(
      expect.objectContaining({ website: null })
    );
  });
});

describe('PUT /api/shuls/[id] — the rest of the body is validated too', () => {
  it('rejects a missing name', async () => {
    const response = await callPut({ ...VALID, name: '' });
    expect(response.status).toBe(400);
    expect(mocks.setValues).not.toHaveBeenCalled();
  });

  it('rejects a malformed email', async () => {
    const response = await callPut({ ...VALID, email: 'not-an-email' });
    expect(response.status).toBe(400);
    expect(mocks.setValues).not.toHaveBeenCalled();
  });

  it('ignores fields that are not part of the schema', async () => {
    // The route used to spread whatever arrived; an unknown key must not reach
    // the update.
    const response = await callPut({ ...VALID, isActive: false, id: 999 });

    expect(response.status).toBe(200);
    const written = mocks.setValues.mock.calls[0][0];
    expect(written).not.toHaveProperty('isActive');
    expect(written).not.toHaveProperty('id');
  });
});

describe('PUT /api/shuls/[id] — authorisation is unchanged', () => {
  it('401s when signed out', async () => {
    mocks.state.session = null;
    const response = await callPut(VALID);
    expect(response.status).toBe(401);
    expect(mocks.setValues).not.toHaveBeenCalled();
  });

  it('403s when the user does not manage this shul', async () => {
    mocks.state.canManage = false;
    const response = await callPut(VALID);
    expect(response.status).toBe(403);
    expect(mocks.setValues).not.toHaveBeenCalled();
  });
});
