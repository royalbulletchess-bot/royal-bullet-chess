import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { withAuth, apiOk, apiError } from '@/lib/api/helpers';
import type { SessionPayload } from '@/lib/auth/session';

/**
 * POST /api/notifications/[id]/read — Mark a notification as read
 */
async function handler(req: NextRequest, session: SessionPayload) {
  const notificationId = req.nextUrl.pathname.split('/')[3]; // /api/notifications/[id]/read

  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId)
    .eq('user_id', session.userId);

  if (error) {
    console.error('[notifications] Mark read error:', error);
    return apiError('Failed to mark notification as read', 500);
  }

  return apiOk({ success: true });
}

export const POST = withAuth(handler);
