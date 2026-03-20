// Shared constants used across all apps

export const SUPABASE_TABLES = {
  // Phase 1 - Core
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
  COMMUNICATION_LOG: 'communication_log',
  STUDENT_PARENTS: 'student_parents',
  AUDIT_LOG: 'audit_log',
  SUBSTITUTES: 'substitutes',
  ABSENCES: 'absences',
  SUBSTITUTE_AVAILABILITY: 'substitute_availability',
  SUBSTITUTE_ASSIGNMENTS: 'substitute_assignments',
  SUBSTITUTE_FEEDBACK: 'substitute_feedback',
  INVENTORY: 'inventory',
  INVENTORY_USAGE: 'inventory_usage',
  // Phase 2 - Admissions CRM
  PROSPECTIVE_STUDENTS: 'prospective_students',
  INQUIRY_FORMS: 'inquiry_forms',
  GLOBAL_ADMINS: 'global_admins',
  FEE_SCHEDULE: 'fee_schedule',
  // Phase 2 - Financial
  STRIPE_CUSTOMERS: 'stripe_customers',
  INVOICES: 'invoices',
  PAYMENT_RECEIPTS: 'payment_receipts',
  // Phase 2 - Onboarding
  ONBOARDING_CHECKLIST: 'onboarding_checklist',
} as const;

export const INNGEST_EVENTS = {
  // Phase 1 - Academic
  CONCEPT_STRUGGLE: 'concept/struggle',
  CURRICULUM_PUBLISHED: 'curriculum/published',
  MILESTONE_ACHIEVED: 'student/milestone_achieved',
  TEACHER_ABSENCE: 'teacher/absence',
  PARENT_NOTIFICATION_TRIGGERED: 'parent/notification_triggered',
  PARENT_NOTIFICATION_APPROVED: 'parent/notification_approved',
  WEEKLY_DIGEST_TRIGGERED: 'parent/weekly_digest_triggered',
  ABSENCE_CREATED: 'erp/absence_created',
  SUBSTITUTE_INVITATION_SENT: 'erp/substitute_invitation_sent',
  SUBSTITUTE_ACCEPTED: 'erp/substitute_accepted',
  SUBSTITUTE_ASSIGNMENT_COMPLETED: 'erp/substitute_assignment_completed',
  // Phase 2 - Admissions CRM
  INQUIRY_RECEIVED: 'admissions/inquiry_received',
  WELCOME_EMAIL_APPROVED: 'admissions/welcome_email_approved',
  PROSPECT_STAGE_CHANGED: 'admissions/prospect_stage_changed',
  // Phase 2 - Enrollment & Billing
  ENROLLMENT_TRIGGERED: 'enrollment/triggered',
  STRIPE_PAYMENT_SUCCEEDED: 'stripe/payment_succeeded',
  STRIPE_PAYMENT_FAILED: 'stripe/payment_failed',
  // Phase 2 - Onboarding
  DOCUMENT_SUBMITTED: 'onboarding/document_submitted',
  MISSING_DOCS_CRON: 'onboarding/missing_docs_cron',
} as const;

export const MODAL_FUNCTIONS = {
  // Phase 1
  GENERATE_CURRICULUM: 'generate_curriculum',
  GENERATE_LESSON_VARIANTS: 'generate_lesson_variants',
  GRADE_ASSIGNMENT: 'grade_assignment',
  SYNTHESIZE_CLASS_INSIGHTS: 'synthesize_class_insights',
  GENERATE_PARENT_EMAIL: 'generate_parent_email',
  GENERATE_SUB_LESSON_PLAN: 'generate_sub_lesson_plan',
  // Phase 2
  GENERATE_ADMISSIONS_WELCOME: 'generate_admissions_welcome',
  GENERATE_ONBOARDING_REMINDER: 'generate_onboarding_reminder',
  GENERATE_INVOICE_EMAIL: 'generate_invoice_email',
} as const;

// Phase 2 - Admissions pipeline stages
export const PROSPECT_STAGES = {
  INQUIRY_RECEIVED: 'inquiry_received',
  TOUR_SCHEDULED: 'tour_scheduled',
  WAITLISTED: 'waitlisted',
  ENROLLED: 'enrolled',
  CHURNED: 'churned',
} as const;

export type ProspectStage = typeof PROSPECT_STAGES[keyof typeof PROSPECT_STAGES];

export const PROSPECT_STAGE_LABELS: Record<ProspectStage, string> = {
  inquiry_received: 'Inquiry Received',
  tour_scheduled: 'Tour Scheduled',
  waitlisted: 'Waitlisted',
  enrolled: 'Enrolled',
  churned: 'Churned',
};

// Phase 2 - Document types for onboarding checklist
export const DOCUMENT_TYPES = {
  MEDICAL_RECORDS: 'medical_records',
  EMERGENCY_CONTACTS: 'emergency_contacts',
  PROOF_OF_RESIDENCY: 'proof_of_residency',
  IMMUNIZATION_RECORDS: 'immunization_records',
  BIRTH_CERTIFICATE: 'birth_certificate',
} as const;

export type DocumentType = typeof DOCUMENT_TYPES[keyof typeof DOCUMENT_TYPES];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  medical_records: 'Medical Records',
  emergency_contacts: 'Emergency Contacts',
  proof_of_residency: 'Proof of Residency',
  immunization_records: 'Immunization Records',
  birth_certificate: 'Birth Certificate',
};

// Phase 2 - Invoice statuses
export const INVOICE_STATUS = {
  DRAFT: 'draft',
  SENT: 'sent',
  PAID: 'paid',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
} as const;

export type InvoiceStatus = typeof INVOICE_STATUS[keyof typeof INVOICE_STATUS];

// ERP: Substitute assignment statuses
export const SUBSTITUTE_ASSIGNMENT_STATUS = {
  INVITED: 'invited',       // Invitation email sent, awaiting response
  ACCEPTED: 'accepted',     // Sub confirmed availability
  DECLINED: 'declined',     // Sub declined the assignment
  COMPLETED: 'completed',   // Absence completed, awaiting feedback
} as const;

export type SubstituteAssignmentStatus = typeof SUBSTITUTE_ASSIGNMENT_STATUS[keyof typeof SUBSTITUTE_ASSIGNMENT_STATUS];

// PRM: Notification types supported by the parent email generator
export const NOTIFICATION_TYPES = {
  PROGRESS: 'progress',     // Weekly progress update
  ALERT: 'alert',           // Concern requiring parent attention
  MILESTONE: 'milestone',   // Achievement / celebration
  MANUAL: 'manual',         // Teacher-initiated general message
} as const;

export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];

// PRM: Lifecycle status for parent notifications (HITL workflow)
export const NOTIFICATION_STATUS = {
  DRAFT: 'draft',           // AI-generated, awaiting teacher review
  APPROVED: 'approved',     // Teacher approved, ready to send
  SENT: 'sent',             // Delivered to parent
  REJECTED: 'rejected',     // Teacher discarded the draft
} as const;

export type NotificationStatus = typeof NOTIFICATION_STATUS[keyof typeof NOTIFICATION_STATUS];

export const CONCEPT_STRUGGLE_THRESHOLD_SECONDS = 180; // 3 minutes

export const STUDY_METRICS_SYNC_INTERVAL_MS = 60000; // 1 minute

// Grading Systems (Teacher-friendly dropdown options)
export const GRADING_SYSTEMS = {
  LOCAL_ALPHABETICAL: 'local_alphabetical', // A+ through F
  LOCAL_INTEGER: 'local_integer', // 100-0 percentage
  NATIONAL_CCSS: 'national_ccss', // Common Core State Standards
  STATE_STANDARDS: 'state_standards', // State-specific standards
  INTERNATIONAL_IB: 'international_ib', // International Baccalaureate
} as const;

export const GRADING_SYSTEM_LABELS = {
  local_alphabetical: 'Alphabetical (A-F)',
  local_integer: 'Percentage (0-100)',
  national_ccss: 'National Standards (CCSS)',
  state_standards: 'State Standards',
  international_ib: 'International (IB)',
} as const;

export const GRADING_SYSTEM_DESCRIPTIONS = {
  local_alphabetical: 'Standard US grading: A+ through F',
  local_integer: '100% perfect, 0% failing',
  national_ccss: 'Common Core State Standards',
  state_standards: 'Your state\'s education standards',
  international_ib: 'International Baccalaureate',
} as const;
