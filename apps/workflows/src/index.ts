import 'dotenv/config';
import { Inngest } from 'inngest';
import { serve } from 'inngest/next';
import { createClient } from '@supabase/supabase-js';
import {
  ConceptStruggleEventPayloadSchema,
  CurriculumPublishedEventPayloadSchema,
  MilestoneAchievedEventPayloadSchema,
  INNGEST_EVENTS,
  NOTIFICATION_STATUS,
  SUPABASE_TABLES,
  SUBSTITUTE_ASSIGNMENT_STATUS,
} from 'shared';

// ============================================
// Initialize Inngest
// ============================================

export const inngest = new Inngest({
  id: 'nicodemus',
  eventKey: process.env.INNGEST_EVENT_KEY,
});

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// Event Type Definitions
// ============================================

type ConceptStruggleEvent = {
  name: typeof INNGEST_EVENTS.CONCEPT_STRUGGLE;
  data: ConceptStruggleEventPayloadSchema;
};

type CurriculumPublishedEvent = {
  name: typeof INNGEST_EVENTS.CURRICULUM_PUBLISHED;
  data: CurriculumPublishedEventPayloadSchema;
};

type MilestoneAchievedEvent = {
  name: typeof INNGEST_EVENTS.MILESTONE_ACHIEVED;
  data: MilestoneAchievedEventPayloadSchema;
};

// ============================================
// Workflow 1: Concept Struggle Detection
// ============================================
// When a student struggles with a concept, flag it for the class and notify parents

export const handleConceptStruggle = inngest.createFunction(
  {
    id: 'concept-struggle-handler',
    name: 'Handle Concept Struggle',
  },
  { event: INNGEST_EVENTS.CONCEPT_STRUGGLE },
  async ({ event, step }) => {
    const { studentId, conceptId, classId, thresholdSeconds } = event.data;

    // Step 1: Check if this is class-wide struggle
    const classWideStruggle = await step.run('check-class-struggle', async () => {
      const { data: metrics } = await supabase
        .from('student_metrics')
        .select('*')
        .eq('class_id', classId)
        .eq('concept_id', conceptId)
        .gte('recorded_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (!metrics) return false;

      const struggleCount = metrics.filter((m) => (m.time_spent_seconds || 0) > thresholdSeconds).length;
      const prevalence = struggleCount / (metrics.length || 1);

      return prevalence > 0.3; // >30% of class
    });

    // Step 2: If class-wide, notify teacher to review whole-class lesson
    if (classWideStruggle) {
      await step.run('notify-teacher-class-wide', async () => {
        // TODO: Send email or notification to teacher
        console.log(`Class-wide struggle detected for ${conceptId} in class ${classId}`);
      });
    }

    // Step 3: Draft parent notification for individual student
    const parentNotif = await step.run('draft-parent-notification', async () => {
      const { data: student } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentId)
        .single();

      if (!student) throw new Error(`Student ${studentId} not found`);

      const notification = {
        parent_id: null, // Will fetch from student_parents
        student_id: studentId,
        type: 'alert',
        subject: `${student.name} needs support with ${conceptId}`,
        body: `Your child is spending extra time on ${conceptId}. We're providing additional support in class.`,
        status: 'draft',
      };

      const { data } = await supabase
        .from('parent_notifications')
        .insert([notification])
        .select()
        .single();

      return data;
    });

    return {
      studentId,
      conceptId,
      classWideStruggle,
      notificationId: parentNotif?.id,
    };
  }
);

// ============================================
// Workflow 2: Curriculum Published
// ============================================
// When a teacher publishes a lesson, check physical inventory and notify ERP

export const handleCurriculumPublished = inngest.createFunction(
  {
    id: 'curriculum-published-handler',
    name: 'Handle Curriculum Published',
  },
  { event: INNGEST_EVENTS.CURRICULUM_PUBLISHED },
  async ({ event, step }) => {
    const { teacherId, lessonId, classId, requiredResources } = event.data;

    // Step 1: Check resource availability
    const resourceStatus = await step.run('check-resources', async () => {
      // TODO: Query inventory management system
      console.log(`Checking resources for ${requiredResources.join(', ')}`);
      return { available: true, shortages: [] };
    });

    // Step 2: If resources shortage, alert admin
    if (resourceStatus.shortages.length > 0) {
      await step.run('alert-admin-shortage', async () => {
        console.log(`Resource shortage detected for lesson ${lessonId}`);
        // TODO: Notify admin
      });
    }

    return {
      lessonId,
      resourcesReady: resourceStatus.available,
    };
  }
);

// ============================================
// Workflow 3: Milestone Achieved
// ============================================
// When a student achieves a milestone, draft celebratory email for parent approval

export const handleMilestoneAchieved = inngest.createFunction(
  {
    id: 'milestone-achieved-handler',
    name: 'Handle Milestone Achieved',
  },
  { event: INNGEST_EVENTS.MILESTONE_ACHIEVED },
  async ({ event, step }) => {
    const { studentId, milestoneName, details } = event.data;

    // Step 1: Get student and parent info
    const { data: student, error } = await step.run('fetch-student', async () => {
      return supabase
        .from('students')
        .select('*, student_parents(parent_id)')
        .eq('id', studentId)
        .single();
    });

    if (error || !student) throw error;

    // Step 2: Draft celebratory email
    const notificationId = await step.run('draft-celebration-email', async () => {
      const body = `🎉 Great news! ${student.name} just achieved the "${milestoneName}" milestone!`;

      const { data } = await supabase
        .from('parent_notifications')
        .insert({
          student_id: studentId,
          type: 'milestone',
          subject: `${student.name} achieved a milestone!`,
          body,
          status: 'pending_approval', // Teacher must approve before sending
        })
        .select()
        .single();

      return data?.id;
    });

    // Step 3: Wait for teacher approval (via human-in-loop)
    // In practice, this would be triggered when teacher clicks "approve" in UI
    // For now, we just create the draft

    return {
      studentId,
      notificationId,
      status: 'pending_teacher_approval',
    };
  }
);

// ============================================
// Workflow 4: Parent Notification Approved (PRM HITL)
// ============================================
// When a teacher approves a draft notification, send it to the parent
// and log it to communication_log for audit trail.

type ParentNotificationApprovedEvent = {
  name: typeof INNGEST_EVENTS.PARENT_NOTIFICATION_APPROVED;
  data: {
    notificationId: string;
    teacherId: string;
  };
};

export const handleParentNotificationApproved = inngest.createFunction(
  {
    id: 'parent-notification-approved-handler',
    name: 'Send Approved Parent Notification',
  },
  { event: INNGEST_EVENTS.PARENT_NOTIFICATION_APPROVED },
  async ({ event, step }) => {
    const { notificationId, teacherId } = event.data;

    // Step 1: Fetch notification + parent contact info
    const notification = await step.run('fetch-notification', async () => {
      const { data, error } = await supabase
        .from('parent_notifications')
        .select(`
          *,
          student_parents!inner(parent_id, parents!inner(email, name))
        `)
        .eq('id', notificationId)
        .single();

      if (error || !data) throw new Error(`Notification ${notificationId} not found`);
      return data;
    });

    // Step 2: Mark notification as sent
    await step.run('mark-as-sent', async () => {
      const { error } = await supabase
        .from('parent_notifications')
        .update({
          status: NOTIFICATION_STATUS.SENT,
          sent_at: new Date().toISOString(),
        })
        .eq('id', notificationId);

      if (error) throw error;
    });

    // Step 3: Log to communication_log for FERPA audit trail
    await step.run('log-communication', async () => {
      const { error } = await supabase
        .from('communication_log')
        .insert({
          teacher_id: teacherId,
          notification_id: notificationId,
          student_id: notification.student_id,
          channel: 'email',
          status: 'sent',
          sent_at: new Date().toISOString(),
          // Note: No PII in log body — subject only for audit
          subject_summary: notification.subject,
        });

      if (error) throw error;
    });

    // Step 4: TODO — integrate with school email system (Phase 2)
    // For now, logging confirms delivery intent; actual send via email provider TBD
    await step.run('send-email-placeholder', async () => {
      console.log(
        `[PRM] Email queued for parent of student ${notification.student_id}: "${notification.subject}"`
      );
    });

    return {
      notificationId,
      status: NOTIFICATION_STATUS.SENT,
    };
  }
);

// ============================================
// Workflow 5: Weekly Parent Digest (Cron)
// ============================================
// Every Friday, generate a weekly progress email draft for each active class.
// Teachers review + approve before sending — HITL enforced.

export const weeklyParentDigest = inngest.createFunction(
  {
    id: 'weekly-parent-digest',
    name: 'Weekly Parent Progress Digest',
  },
  // Runs every Friday at 8:00 AM UTC
  { cron: '0 8 * * 5' },
  async ({ step }) => {
    // Step 1: Get all active classes with enrolled students
    const classes = await step.run('fetch-active-classes', async () => {
      const { data, error } = await supabase
        .from('classes')
        .select(`
          id,
          name,
          teacher_id,
          teachers!inner(name, school_id, schools!inner(name)),
          enrollments!inner(student_id)
        `)
        .eq('is_active', true);

      if (error) throw error;
      return data ?? [];
    });

    // Step 2: For each class, create a draft digest notification
    // Teacher will review + approve in the Communications tab
    const drafts = await step.run('create-draft-digests', async () => {
      const created: string[] = [];

      for (const cls of classes) {
        const studentCount = (cls as any).enrollments?.length ?? 0;
        if (studentCount === 0) continue;

        const { data } = await supabase
          .from('parent_notifications')
          .insert({
            teacher_id: (cls as any).teacher_id,
            type: 'progress',
            subject: `Weekly Update — ${(cls as any).name}`,
            body: `Weekly digest for ${studentCount} student(s) in ${(cls as any).name}. Review and personalize before sending.`,
            status: NOTIFICATION_STATUS.DRAFT,
            // student_id null = class-level digest (teacher will personalize per student)
            student_id: null,
          })
          .select()
          .single();

        if (data) created.push(data.id);
      }

      return created;
    });

    return {
      digestsCreated: drafts.length,
      weekOf: new Date().toISOString().split('T')[0],
    };
  }
);

// ============================================
// Workflow 6: Absence Created (ERP Agent)
// ============================================
// When teacher logs an absence:
// 1. Generate substitute-friendly lesson plan
// 2. Find available substitutes
// 3. Send invitation emails to substitutes

type AbsenceCreatedEvent = {
  name: typeof INNGEST_EVENTS.ABSENCE_CREATED;
  data: {
    absenceId: string;
    teacherId: string;
    classId: string;
    className: string;
    gradeLevel: string;
    subject: string;
    studentCount: number;
    dateStart: string;
    dateEnd: string;
    lessonObjectives: string;
    materialsAvailable: string[];
    specialInstructions: string;
  };
};

export const handleAbsenceCreated = inngest.createFunction(
  {
    id: 'absence-created-handler',
    name: 'Handle Absence and Find Substitutes',
  },
  { event: INNGEST_EVENTS.ABSENCE_CREATED },
  async ({ event, step }) => {
    const {
      absenceId,
      teacherId,
      classId,
      className,
      gradeLevel,
      subject,
      studentCount,
      dateStart,
      dateEnd,
      lessonObjectives,
      materialsAvailable,
      specialInstructions,
    } = event.data;

    // Step 1: Generate substitute lesson plan via Modal
    const lessonPlan = await step.run('generate-lesson-plan', async () => {
      try {
        const res = await fetch(
          `${process.env.MODAL_API_URL}/generate_sub_lesson_plan`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.MODAL_TOKEN_SECRET}`,
            },
            body: JSON.stringify({
              apiKey: process.env.CLAUDE_API_KEY,
              className,
              gradeLevel,
              subject,
              lessonObjectives,
              studentCount,
              materialsAvailable,
              specialInstructions,
            }),
          }
        );
        return res.json();
      } catch (e) {
        console.warn('Lesson plan generation failed:', e);
        return null;
      }
    });

    // Step 2: Find available substitutes for this date range and subject
    const availableSubs = await step.run('find-available-subs', async () => {
      const { data, error } = await supabase
        .from(SUPABASE_TABLES.SUBSTITUTES)
        .select(`
          id,
          name,
          email,
          subjects,
          substitute_availability(*)
        `)
        .eq('is_active', true)
        .contains('subjects', [subject])
        .limit(5);

      if (error) {
        console.warn('Substitute lookup failed:', error);
        return [];
      }

      // Filter by actual availability on dateStart
      return (data ?? []).filter((sub: any) => {
        const avail = (sub.substitute_availability ?? []).find(
          (a: any) => a.date_available === dateStart && a.available
        );
        return !!avail;
      });
    });

    // Step 3: Create substitute assignments + send invitations
    const assignmentsSent = await step.run('send-invitations', async () => {
      const assignments = [];
      for (const sub of availableSubs) {
        const { data, error } = await supabase
          .from(SUPABASE_TABLES.SUBSTITUTE_ASSIGNMENTS)
          .insert({
            absence_id: absenceId,
            substitute_id: sub.id,
            status: SUBSTITUTE_ASSIGNMENT_STATUS.INVITED,
            email_sent_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (!error && data) {
          assignments.push(data);
          // TODO: Actual email send via Phase 2 (SendGrid/SMTP)
          console.log(`[ERP] Invitation sent to ${sub.email} for ${className}`);
        }
      }
      return assignments;
    });

    return {
      absenceId,
      invitationsSent: assignmentsSent.length,
      lessonPlanGenerated: !!lessonPlan,
    };
  }
);

// ============================================
// Phase 2 Workflow 7: Enrollment Triggered
// ============================================
// When a prospect is enrolled:
// 1. Log the enrollment
// 2. (Payment gateway steps go here once a provider is chosen)

export const handleEnrollmentTriggered = inngest.createFunction(
  {
    id: 'enrollment-triggered-handler',
    name: 'Handle Student Enrollment',
  },
  { event: INNGEST_EVENTS.ENROLLMENT_TRIGGERED },
  async ({ event, step }) => {
    const {
      studentId,
      invoiceId,
      childName,
      email,
      gradeLevel,
      totalAmountCents,
    } = event.data;

    // Step 1: Log enrollment
    await step.run('log-enrollment', async () => {
      console.log(
        `[ENROLLMENT] ${childName} (grade ${gradeLevel}) enrolled. ` +
        `Fee total: $${(totalAmountCents / 100).toFixed(2)} → ${email}. ` +
        `Invoice ID: ${invoiceId} (status: draft — payment gateway not yet configured).`
      );
    });

    // TODO: Step 2 — once a payment gateway is chosen:
    //   - Create customer + invoice via gateway API
    //   - Update invoice status to 'sent'
    //   - Send payment link to parent via email

    return { studentId, invoiceId, status: 'enrollment_logged' };
  }
);

// NOTE: handleStripePaymentSucceeded removed — payment gateway TBD.
// Restore (or replace with equivalent) once a provider is selected.

// ============================================
// Phase 2 Workflow 9: Missing Docs Cron (Daily)
// ============================================
// Every day at 8AM UTC, check for students with pending
// onboarding documents older than 7 days and trigger reminders.

export const missingDocsCron = inngest.createFunction(
  {
    id: 'missing-docs-cron',
    name: 'Daily Missing Document Reminders',
  },
  { cron: '0 8 * * *' }, // Daily at 8:00 AM UTC
  async ({ step }) => {
    const result = await step.run('trigger-reminder-api', async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL}/api/onboarding/reminder-missing-docs`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-internal-api-key': process.env.INTERNAL_API_KEY ?? '',
            },
            body: JSON.stringify({}),
          }
        );
        return res.json();
      } catch (e: any) {
        console.error('Missing docs cron failed:', e.message);
        return { remindersQueued: 0, error: e.message };
      }
    });

    return {
      weekday: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
      remindersQueued: result.remindersQueued ?? 0,
    };
  }
);

// ============================================
// Expose Inngest functions to Next.js API
// ============================================

export const handler = serve({
  client: inngest,
  functions: [
    // Phase 1
    handleConceptStruggle,
    handleCurriculumPublished,
    handleMilestoneAchieved,
    handleParentNotificationApproved,
    weeklyParentDigest,
    handleAbsenceCreated,
    // Phase 2
    handleEnrollmentTriggered,
    missingDocsCron,
    // handleStripePaymentSucceeded — restore when payment gateway is configured
  ],
});
