-- Activity Notifications: per-user activity feed / bell notification log
-- Each user (teacher, student, admin, parent) sees their own relevant events

CREATE TABLE IF NOT EXISTS activity_notifications (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL,
  user_role    TEXT NOT NULL CHECK (user_role IN ('teacher', 'student', 'parent', 'admin')),
  type         TEXT NOT NULL DEFAULT 'system' CHECK (type IN (
    'approval_needed',  -- HITL: item needs human review
    'approved',         -- something was approved
    'rejected',         -- something was rejected
    'homework',         -- new assignment posted or graded
    'communication',    -- parent communication sent/received
    'milestone',        -- student milestone achieved
    'admission',        -- admissions pipeline event
    'payment',          -- financial event
    'system',           -- system-level announcement
    'alert'             -- urgent alert
  )),
  title        TEXT NOT NULL,
  message      TEXT NOT NULL,
  link         TEXT,           -- optional route to navigate to on click
  read         BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Fast lookup: user's unread notifications, newest first
CREATE INDEX IF NOT EXISTS idx_activity_notifications_user
  ON activity_notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_notifications_unread
  ON activity_notifications(user_id, read) WHERE read = false;

ALTER TABLE activity_notifications ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (used by API routes with service key)
CREATE POLICY "service_role_all_activity_notifications"
  ON activity_notifications FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can read their own notifications
CREATE POLICY "users_read_own_notifications"
  ON activity_notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Authenticated users can mark their own notifications as read
CREATE POLICY "users_update_own_notifications"
  ON activity_notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
