import { Inngest } from 'inngest';
import { serve } from 'inngest/next';
import { createClient } from '@supabase/supabase-js';
import {
  ConceptStruggleEventPayloadSchema,
  CurriculumPublishedEventPayloadSchema,
  MilestoneAchievedEventPayloadSchema,
  INNGEST_EVENTS,
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
// Expose Inngest functions to Next.js API
// ============================================

export const handler = serve({
  client: inngest,
  functions: [
    handleConceptStruggle,
    handleCurriculumPublished,
    handleMilestoneAchieved,
  ],
});
