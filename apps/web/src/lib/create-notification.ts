/**
 * Server-side helper to create an activity notification.
 * Import this in API routes to emit events into the notification feed.
 */

import { createClient } from '@supabase/supabase-js';

type NotificationType =
  | 'approval_needed'
  | 'approved'
  | 'rejected'
  | 'homework'
  | 'communication'
  | 'milestone'
  | 'admission'
  | 'payment'
  | 'system'
  | 'alert';

type UserRole = 'teacher' | 'student' | 'parent' | 'admin';

interface CreateNotificationParams {
  userId: string;
  userRole: UserRole;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Creates a single activity notification for a user.
 * Uses the service role key — safe to call from any server-side API route.
 * Errors are swallowed so notification failures never break the main action.
 */
export async function createActivityNotification(params: CreateNotificationParams): Promise<void> {
  try {
    const supabase = getAdminClient();
    await supabase.from('activity_notifications').insert({
      user_id:   params.userId,
      user_role: params.userRole,
      type:      params.type,
      title:     params.title,
      message:   params.message,
      link:      params.link ?? null,
      read:      false,
    });
  } catch {
    // Intentionally silent — notification creation is non-critical
  }
}

/**
 * Creates notifications for multiple users at once (e.g. broadcast to all teachers).
 */
export async function createActivityNotifications(
  notifications: CreateNotificationParams[]
): Promise<void> {
  if (notifications.length === 0) return;
  try {
    const supabase = getAdminClient();
    await supabase.from('activity_notifications').insert(
      notifications.map((p) => ({
        user_id:   p.userId,
        user_role: p.userRole,
        type:      p.type,
        title:     p.title,
        message:   p.message,
        link:      p.link ?? null,
        read:      false,
      }))
    );
  } catch {
    // Intentionally silent
  }
}
