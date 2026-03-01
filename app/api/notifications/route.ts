import { supabaseAdmin } from '@/lib/supabase/admin';
import { withAuth, apiOk, apiError } from '@/lib/api/helpers';
import type { SessionPayload } from '@/lib/auth/session';

/**
 * GET /api/notifications — Fetch user's notifications
 */
async function handler(_req: Request, session: SessionPayload) {
  // Fetch recent notifications (last 50)
  const { data: notifications, error } = await supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('user_id', session.userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[notifications] Fetch error:', error);
    return apiError('Failed to fetch notifications', 500);
  }

  // Count unread
  const { count } = await supabaseAdmin
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', session.userId)
    .eq('read', false);

  return apiOk({
    notifications: notifications || [],
    unreadCount: count || 0,
  });
}

export const GET = withAuth(handler);
