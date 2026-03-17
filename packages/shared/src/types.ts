import { z } from 'zod';

// ============================================
// Core Entity Types
// ============================================

export const UserRoleSchema = z.enum(['teacher', 'student', 'parent', 'admin', 'system']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: UserRoleSchema,
  schoolId: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type User = z.infer<typeof UserSchema>;

// ============================================
// Student Progress & Behavior (Sanitized)
// ============================================

export const StudentMetricsSchema = z.object({
  studentId: z.string().uuid(),
  conceptId: z.string(),
  distractionIndex: z.number().min(0).max(1), // 0-1 scale
  timeSpent: z.number(), // seconds
  attemptCount: z.number(),
  successRate: z.number().min(0).max(1),
  timestamp: z.date(),
});
export type StudentMetrics = z.infer<typeof StudentMetricsSchema>;

export const ConceptStruggleEventSchema = z.object({
  studentId: z.string().uuid(),
  conceptId: z.string(),
  threshold: z.number(), // seconds stuck
  classId: z.string().uuid(),
});
export type ConceptStruggleEvent = z.infer<typeof ConceptStruggleEventSchema>;

// ============================================
// Curriculum & Lessons
// ============================================

export const LessonSchema = z.object({
  id: z.string().uuid(),
  teacherId: z.string().uuid(),
  title: z.string(),
  gradeLevel: z.string(),
  subject: z.string(),
  standardsAligned: z.array(z.string()),
  content: z.string(),
  variants: z.array(z.object({
    readingLevel: z.string(),
    content: z.string(),
  })),
  createdAt: z.date(),
});
export type Lesson = z.infer<typeof LessonSchema>;

// ============================================
// Parent Communication
// ============================================

export const ParentNotificationSchema = z.object({
  id: z.string().uuid(),
  parentId: z.string().uuid(),
  studentId: z.string().uuid(),
  type: z.enum(['progress', 'alert', 'milestone', 'manual']),
  subject: z.string(),
  body: z.string(),
  status: z.enum(['draft', 'pending_approval', 'sent', 'failed']),
  approvedBy: z.string().uuid().optional(),
  approvedAt: z.date().optional(),
  sentAt: z.date().optional(),
  createdAt: z.date(),
});
export type ParentNotification = z.infer<typeof ParentNotificationSchema>;

// ============================================
// Events (for Inngest)
// ============================================

export const ConceptStruggleEventPayloadSchema = z.object({
  studentId: z.string().uuid(),
  conceptId: z.string(),
  classId: z.string().uuid(),
  thresholdSeconds: z.number(),
});

export const CurriculumPublishedEventPayloadSchema = z.object({
  teacherId: z.string().uuid(),
  lessonId: z.string().uuid(),
  classId: z.string().uuid(),
  requiredResources: z.array(z.string()),
});

export const MilestoneAchievedEventPayloadSchema = z.object({
  studentId: z.string().uuid(),
  milestoneName: z.string(),
  details: z.record(z.any()),
});
