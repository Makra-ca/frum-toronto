import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => {
  const state = {
    session: null as { user: { id: string; role: string } } | null,
    pusherEnabled: true,
  };
  const authorizeChannel = vi.fn((socketId: string, channel: string) => ({
    auth: `signed:${socketId}:${channel}`,
  }));
  return { state, authorizeChannel };
});

vi.mock('@/lib/auth/auth', () => ({
  auth: vi.fn(async () => mocks.state.session),
}));

vi.mock('@/lib/pusher', () => ({
  ADMIN_NOTIFICATIONS_CHANNEL: 'private-admin-notifications',
  NEW_NOTIFICATION_EVENT: 'new-notification',
  getPusherServer: vi.fn(() =>
    mocks.state.pusherEnabled ? { authorizeChannel: mocks.authorizeChannel } : null
  ),
}));

import { POST } from '@/app/api/pusher/auth/route';

function makeRequest(body: Record<string, string>) {
  // pusher-js posts application/x-www-form-urlencoded
  return new NextRequest('http://localhost:3000/api/pusher/auth', {
    method: 'POST',
    body: new URLSearchParams(body),
  });
}

const VALID_BODY = {
  socket_id: '123.456',
  channel_name: 'private-admin-notifications',
};

beforeEach(() => {
  mocks.state.session = { user: { id: '1', role: 'admin' } };
  mocks.state.pusherEnabled = true;
  mocks.authorizeChannel.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/pusher/auth', () => {
  it('rejects unauthenticated requests with 401', async () => {
    mocks.state.session = null;
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);
    expect(mocks.authorizeChannel).not.toHaveBeenCalled();
  });

  it('rejects non-admin users with 401', async () => {
    mocks.state.session = { user: { id: '2', role: 'member' } };
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);
    expect(mocks.authorizeChannel).not.toHaveBeenCalled();
  });

  it('rejects shul-role users with 401 (only admin may subscribe)', async () => {
    mocks.state.session = { user: { id: '3', role: 'shul' } };
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it('returns 503 when Pusher is not configured', async () => {
    mocks.state.pusherEnabled = false;
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(503);
  });

  it('rejects any channel other than the admin channel with 403', async () => {
    const res = await POST(
      makeRequest({ ...VALID_BODY, channel_name: 'private-user-1' })
    );
    expect(res.status).toBe(403);
    expect(mocks.authorizeChannel).not.toHaveBeenCalled();
  });

  it('rejects a missing socket_id with 400', async () => {
    const res = await POST(
      makeRequest({ channel_name: 'private-admin-notifications' })
    );
    expect(res.status).toBe(400);
  });

  it('authorizes an admin on the correct channel', async () => {
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    expect(mocks.authorizeChannel).toHaveBeenCalledWith(
      '123.456',
      'private-admin-notifications'
    );
    const json = await res.json();
    expect(json).toEqual({
      auth: 'signed:123.456:private-admin-notifications',
    });
  });

  it('returns 500 (not a crash) when authorizeChannel throws', async () => {
    mocks.authorizeChannel.mockImplementationOnce(() => {
      throw new Error('bad signature');
    });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(500);
  });
});
