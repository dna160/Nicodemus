/**
 * GET  /api/notifications?userId=xxx   — fetch latest 30 notifications for a user
 * POST /api/notifications/read-all     — handled in read-all/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ success: false, error: 'userId required' }, { status: 400 });
  }

  // Demo mode — return empty list rather than hitting the DB
  if (userId === 'demo') {
    return NextResponse.json({ success: true, notifications: [] });
  }

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('activity_notifications')
    .select('id, type, title, message, link, read, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, notifications: data ?? [] });
}
