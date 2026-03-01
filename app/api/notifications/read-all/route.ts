import { supabaseAdmin } from '@/lib/supabase/admin';
import { withAuth, apiOk, apiError } from '@/lib/api/helpers';
import type { SessionPayload } from '@/lib/auth/session';

/**
 * POST /api/notifications/read-all — Mark all notifications as read
 */
async function handler(_req: Request, session: SessionPayload) {
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ read: true })
    .eq('user_id', session.userId)
    .eq('read', false);

  if (error) {
    console.error('[notifications] Mark all read error:', error);
    return apiError('Failed to mark notifications as read', 500);
  }

  return apiOk({ success: true });
}

export const POST = withAuth(handler);
