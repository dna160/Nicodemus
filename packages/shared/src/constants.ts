// Shared constants used across all apps

export const SUPABASE_TABLES = {
  USERS: 'users',
  STUDENTS: 'students',
  TEACHERS: 'teachers',
  PARENTS: 'parents',
  CLASSES: 'classes',
  ENROLLMENTS: 'enrollments',
  LESSONS: 'lessons',
  ASSIGNMENTS: 'assignments',
  SUBMISSIONS: 'submissions',
  STUDENT_METRICS: 'student_metrics',
  PARENT_NOTIFICATIONS: 'parent_notifications',
  AUDIT_LOG: 'audit_log',
} as const;

export const INNGEST_EVENTS = {
  CONCEPT_STRUGGLE: 'concept/struggle',
  CURRICULUM_PUBLISHED: 'curriculum/published',
  MILESTONE_ACHIEVED: 'student/milestone_achieved',
  TEACHER_ABSENCE: 'teacher/absence',
  PARENT_NOTIFICATION_TRIGGERED: 'parent/notification_triggered',
} as const;

export const MODAL_FUNCTIONS = {
  GENERATE_CURRICULUM: 'generate_curriculum',
  GENERATE_LESSON_VARIANTS: 'generate_lesson_variants',
  GRADE_ASSIGNMENT: 'grade_assignment',
  SYNTHESIZE_CLASS_INSIGHTS: 'synthesize_class_insights',
} as const;

export const CONCEPT_STRUGGLE_THRESHOLD_SECONDS = 180; // 3 minutes

export const STUDY_METRICS_SYNC_INTERVAL_MS = 60000; // 1 minute
