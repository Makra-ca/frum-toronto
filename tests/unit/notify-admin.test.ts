import { describe, it, expect, vi, beforeEach } from 'vitest';

// Shared mutable state for the hoisted mocks
const mocks = vi.hoisted(() => {
  const state = {
    admins: [{ id: 1 }, { id: 2 }] as { id: number }[],
    recipients: [{ email: 'rav@frumtoronto.com' }] as { email: string }[],
    inserted: [] as unknown[],
    selectThrows: false,
    insertThrows: false,
    sendThrows: false,
    sendError: null as unknown,
    pusherThrows: false,
    pusherEnabled: true,
  };

  const sendMock = vi.fn(async () => {
    if (state.sendThrows) throw new Error('resend exploded');
    return { error: state.sendError };
  });

  const triggerMock = vi.fn(async () => {
    if (state.pusherThrows) throw new Error('pusher exploded');
  });

  return { state, sendMock, triggerMock };
});

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn((table: Record<string, unknown>) => ({
        where: vi.fn(async () => {
          if (mocks.state.selectThrows) throw new Error('db select down');
          // users table has a `role` column; formEmailRecipients does not
          return 'role' in table ? mocks.state.admins : mocks.state.recipients;
        }),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(async (vals: unknown) => {
        if (mocks.state.insertThrows) throw new Error('db insert down');
        mocks.state.inserted.push(vals);
      }),
    })),
  },
}));

vi.mock('@/lib/email/resend', () => ({
  resend: { emails: { send: mocks.sendMock } },
  EMAIL_FROM: 'FrumToronto <noreply@frumtoronto.com>',
}));

vi.mock('@/lib/pusher', () => ({
  ADMIN_NOTIFICATIONS_CHANNEL: 'private-admin-notifications',
  NEW_NOTIFICATION_EVENT: 'new-notification',
  getPusherServer: vi.fn(() =>
    mocks.state.pusherEnabled ? { trigger: mocks.triggerMock } : null
  ),
}));

import { notifyAdminOfSubmission } from '@/lib/notifications';

function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    contentType: 'contact_form' as const,
    title: 'New contact form message',
    body: 'From: Test User\n\nHello',
    linkUrl: '/admin/contacts',
    status: 'pending' as const,
    ...overrides,
  };
}

beforeEach(() => {
  mocks.state.admins = [{ id: 1 }, { id: 2 }];
  mocks.state.recipients = [{ email: 'rav@frumtoronto.com' }];
  mocks.state.inserted = [];
  mocks.state.selectThrows = false;
  mocks.state.insertThrows = false;
  mocks.state.sendThrows = false;
  mocks.state.sendError = null;
  mocks.state.pusherThrows = false;
  mocks.state.pusherEnabled = true;
  mocks.sendMock.mockClear();
  mocks.triggerMock.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('notifyAdminOfSubmission — tier routing', () => {
  it('Tier A pending (contact_form): in-app fan-out per admin + instant email + pusher', async () => {
    await notifyAdminOfSubmission(basePayload());

    // One insert call containing one row per active admin
    expect(mocks.state.inserted).toHaveLength(1);
    const rows = mocks.state.inserted[0] as { userId: number; type: string }[];
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.userId).sort()).toEqual([1, 2]);
    expect(rows[0].type).toBe('contact_form');

    // Instant email to configured recipients
    expect(mocks.sendMock).toHaveBeenCalledTimes(1);
    const sendArgs = (mocks.sendMock.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(sendArgs.to).toEqual(['rav@frumtoronto.com']);
    expect(sendArgs.subject).toBe('New contact form message');

    // Pusher event fired with minimal payload
    expect(mocks.triggerMock).toHaveBeenCalledTimes(1);
    expect(mocks.triggerMock).toHaveBeenCalledWith(
      'private-admin-notifications',
      'new-notification',
      { title: 'New contact form message', linkUrl: '/admin/contacts' }
    );
  });

  it('Tier B pending (event): in-app yes, NO instant email', async () => {
    await notifyAdminOfSubmission(
      basePayload({ contentType: 'event', title: 'New event submitted' })
    );

    expect(mocks.state.inserted).toHaveLength(1);
    expect(mocks.sendMock).not.toHaveBeenCalled();
    expect(mocks.triggerMock).toHaveBeenCalledTimes(1);
  });

  it('Tier A auto_approved (business): in-app FYI only, NO email', async () => {
    await notifyAdminOfSubmission(
      basePayload({ contentType: 'business', status: 'auto_approved' })
    );

    expect(mocks.state.inserted).toHaveLength(1);
    expect(mocks.sendMock).not.toHaveBeenCalled();
  });

  it('tehillim pending keeps its instant email (Tier B exception)', async () => {
    await notifyAdminOfSubmission(
      basePayload({ contentType: 'tehillim', title: 'New tehillim name' })
    );

    expect(mocks.sendMock).toHaveBeenCalledTimes(1);
  });

  it('Tier C (davening_edit) auto_approved: in-app only', async () => {
    await notifyAdminOfSubmission(
      basePayload({ contentType: 'davening_edit', status: 'auto_approved' })
    );

    expect(mocks.state.inserted).toHaveLength(1);
    expect(mocks.sendMock).not.toHaveBeenCalled();
  });

  it('no configured recipients: skips email without error', async () => {
    mocks.state.recipients = [];
    await notifyAdminOfSubmission(basePayload());

    expect(mocks.sendMock).not.toHaveBeenCalled();
    expect(mocks.state.inserted).toHaveLength(1); // in-app still works
  });

  it('no active admins: insert skipped, no crash', async () => {
    mocks.state.admins = [];
    await expect(notifyAdminOfSubmission(basePayload())).resolves.toBeUndefined();
    expect(mocks.state.inserted).toHaveLength(0);
  });

  it('forwards replyTo into the email', async () => {
    await notifyAdminOfSubmission(basePayload({ replyTo: 'asker@example.com' }));

    const sendArgs = (mocks.sendMock.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(sendArgs.replyTo).toBe('asker@example.com');
  });
});

describe('notifyAdminOfSubmission — non-fatality guarantee', () => {
  it('never throws when the in-app insert fails', async () => {
    mocks.state.insertThrows = true;
    await expect(notifyAdminOfSubmission(basePayload())).resolves.toBeUndefined();
    // Email path is independent and still ran
    expect(mocks.sendMock).toHaveBeenCalledTimes(1);
  });

  it('never throws when the DB select fails', async () => {
    mocks.state.selectThrows = true;
    await expect(notifyAdminOfSubmission(basePayload())).resolves.toBeUndefined();
  });

  it('never throws when resend.send throws', async () => {
    mocks.state.sendThrows = true;
    await expect(notifyAdminOfSubmission(basePayload())).resolves.toBeUndefined();
    // Pusher still fired despite the email failure
    expect(mocks.triggerMock).toHaveBeenCalledTimes(1);
  });

  it('never throws when resend returns an error object', async () => {
    mocks.state.sendError = { name: 'validation_error', message: 'bad' };
    await expect(notifyAdminOfSubmission(basePayload())).resolves.toBeUndefined();
  });

  it('never throws when pusher.trigger throws', async () => {
    mocks.state.pusherThrows = true;
    await expect(notifyAdminOfSubmission(basePayload())).resolves.toBeUndefined();
  });

  it('never throws when EVERYTHING fails at once', async () => {
    mocks.state.selectThrows = true;
    mocks.state.insertThrows = true;
    mocks.state.sendThrows = true;
    mocks.state.pusherThrows = true;
    await expect(notifyAdminOfSubmission(basePayload())).resolves.toBeUndefined();
  });

  it('works when Pusher is not configured (returns null)', async () => {
    mocks.state.pusherEnabled = false;
    await expect(notifyAdminOfSubmission(basePayload())).resolves.toBeUndefined();
    expect(mocks.triggerMock).not.toHaveBeenCalled();
    expect(mocks.sendMock).toHaveBeenCalledTimes(1); // email unaffected
  });
});
