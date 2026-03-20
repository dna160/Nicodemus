/**
 * Modal Client Helper
 * Note: Modal functions are typically Python-based.
 * In this lean stack, we call them via their served endpoints or a bridge.
 *
 * All Modal functions use Claude Haiku for cost efficiency and speed:
 * - Curriculum generation: claude-haiku-4-5-20251001
 * - Lesson variants: claude-haiku-4-5-20251001
 * - Assignment grading: claude-haiku-4-5-20251001
 * - Class insights: claude-haiku-4-5-20251001
 * - Parent email drafting: claude-haiku-4-5-20251001
 *
 * Haiku is ideal for Nicodemus because:
 * - Fast responses (curriculum in ~5-10 seconds)
 * - Low cost (~$0.01 per curriculum generation)
 * - Sufficient capability for structured task (lesson planning, grading)
 */

// ============================================================
// Grade Level Context Helper
// Provides detailed guidance for LLM to ensure age-appropriate content
// ============================================================

function getGradeContext(gradeLevel: string): string {
  const gradeContextMap: Record<string, string> = {
    K: 'Kindergarten (age 5-6): Focus on foundational concepts, concrete examples, hands-on activities, short attention span (10-15 min lessons), visual/sensory learning, very simple vocabulary, no reading required.',
    '1': 'Grade 1 (age 6-7): Beginning readers, simple sentences, concrete concepts before abstract, play-based learning, short activities (15-20 min), phonics-based, high engagement needed.',
    '2': 'Grade 2 (age 7-8): Early independent readers, simple word problems, basic addition/subtraction, story-based lessons, 20-30 min activities, visual aids important.',
    '3': 'Grade 3 (age 8-9): Independent readers, multi-digit arithmetic, simple fractions, introduction to multiplication, can follow 2-3 step instructions, 30-40 min lessons, more independent work.',
    '4': 'Grade 4 (age 9-10): Proficient readers, multi-digit multiplication/division, decimal introduction, research skills developing, can engage with abstract concepts, 40-45 min lessons, increased rigor.',
    '5': 'Grade 5 (age 10-11): Strong readers, fractions and decimals, basic algebra introduction, scientific method, critical thinking beginning, 45-50 min lessons, problem-solving emphasis.',
    '6': 'Grade 6 (age 11-12): Middle school transition, pre-algebra, ratios and proportions, abstract thinking developing, independent projects, 45-50 min lessons, peer collaboration important.',
    '7': 'Grade 7 (age 12-13): Algebra basics, scientific thinking, abstract concepts developing well, social awareness in examples, 50 min lessons, complex problem-solving.',
    '8': 'Grade 8 (age 13-14): Algebra and geometry, scientific inquiry, abstract reasoning, real-world applications, 50 min lessons, long-term projects.',
    '9': 'Grade 9 (age 14-15): High school freshman, advanced algebra/geometry, complex analysis, abstract thinking strong, 50-90 min periods, college prep focus.',
    '10': 'Grade 10 (age 15-16): Geometry/Algebra II level, advanced reasoning, real-world applications critical, 50-90 min periods, academic rigor increases.',
    '11': 'Grade 11 (age 16-17): Pre-calculus/AP-level concepts, critical analysis, complex problem-solving, college-level rigor, 50-90 min periods.',
    '12': 'Grade 12 (age 17-18): College-ready content, calculus/advanced topics possible, research and synthesis skills, independent learning, 50-90 min periods, career/college focus.',
  };

  return gradeContextMap[gradeLevel] || `Grade ${gradeLevel}: Provide age-appropriate content with clear learning objectives.`;
}

export const modal = {
  async generateCurriculum(params: {
    title: string;
    gradeLevel: string;
    subject: string;
    gradingSystem: string;
    durationWeeks: number;
    apiKey?: string;  // Optional API key passed from backend
    customPrompt?: string;  // Optional custom prompt for variants
  }) {
    // In a production scenario, this would call the Modal webhook or project endpoint
    // For now, we point to the expected workspace/function path

    // Build grade-level context to ensure LLM considerations
    const gradeContext = getGradeContext(params.gradeLevel);

    const response = await fetch(`${process.env.MODAL_API_URL}/generate_curriculum`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MODAL_TOKEN_SECRET}`,
      },
      body: JSON.stringify({
        ...params,
        grade_context: gradeContext, // Additional context for the LLM
      }),
    });

    if (!response.ok) {
      throw new Error(`Modal function failed: ${response.statusText}`);
    }

    return response.json();
  },

  async generateLessonVariants(lessonContent: string, gradeLevel: string) {
    const gradeContext = getGradeContext(gradeLevel);

    const response = await fetch(`${process.env.MODAL_API_URL}/generate_lesson_variants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MODAL_TOKEN_SECRET}`,
      },
      body: JSON.stringify({
        lesson_content: lessonContent,
        grade_level: gradeLevel,
        grade_context: gradeContext, // Additional context for the LLM
      }),
    });

    if (!response.ok) {
      throw new Error(`Modal function failed: ${response.statusText}`);
    }

    return response.json();
  },

  async generateParentEmail(params: {
    notificationType: string;
    studentName: string;
    teacherName: string;
    schoolName: string;
    details: Record<string, unknown>;
    apiKey?: string;
  }): Promise<{ subject: string; body: string }> {
    const response = await fetch(`${process.env.MODAL_API_URL}/generate_parent_email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MODAL_TOKEN_SECRET}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`Modal parent email function failed: ${response.statusText}`);
    }

    return response.json();
  },

  async generateHomework(params: {
    curriculumContent: string;
    subject: string;
    gradeLevel: string;
    gradingSystem: string;
    numAssignments?: number;
    apiKey?: string;
  }): Promise<{
    assignments: Array<{
      title: string;
      description: string;
      due_offset_days: number;
      points_possible: number;
      content: { questions: Array<{ id: string; prompt: string; type: string; points: number }> };
      rubric: { criteria: Array<{ name: string; points: number; description: string }>; total_points: number };
    }>;
  }> {
    const gradeContext = getGradeContext(params.gradeLevel);

    const response = await fetch(`${process.env.MODAL_API_URL}/generate_homework`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MODAL_TOKEN_SECRET}`,
      },
      body: JSON.stringify({
        curriculum_content: params.curriculumContent,
        subject: params.subject,
        gradeLevel: params.gradeLevel,
        grade_context: gradeContext, // Additional context for the LLM
        gradingSystem: params.gradingSystem,
        num_assignments: params.numAssignments ?? 3,
        apiKey: params.apiKey,
      }),
    });
    if (!response.ok) throw new Error(`Modal generate_homework failed: ${response.statusText}`);
    return response.json();
  },

  async gradeHomework(params: {
    submissionContent: string;
    rubric: Record<string, unknown>;
    subject: string;
    gradeLevel?: string;
    apiKey?: string;
  }): Promise<{ score: number; feedback: string; next_steps: string }> {
    const gradeContext = params.gradeLevel ? getGradeContext(params.gradeLevel) : '';

    const response = await fetch(`${process.env.MODAL_API_URL}/grade_assignment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MODAL_TOKEN_SECRET}`,
      },
      body: JSON.stringify({
        submission_content: params.submissionContent,
        rubric: params.rubric,
        subject: params.subject,
        grade_level: params.gradeLevel,
        grade_context: gradeContext, // Additional context for appropriate grading standards
        apiKey: params.apiKey,
      }),
    });
    if (!response.ok) throw new Error(`Modal grade_assignment failed: ${response.statusText}`);
    return response.json();
  },

  async generateSubLessonPlan(params: {
    className: string;
    gradeLevel: string;
    subject: string;
    lessonObjectives: string;
    studentCount: number;
    materialsAvailable: string[];
    specialInstructions?: string;
    apiKey?: string;
  }): Promise<Record<string, unknown>> {
    const response = await fetch(`${process.env.MODAL_API_URL}/generate_sub_lesson_plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MODAL_TOKEN_SECRET}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`Modal substitute lesson plan generation failed: ${response.statusText}`);
    }

    return response.json();
  },

  async generateCustomHomework(params: {
    topic: string;
    subject: string;
    gradeLevel: string;
    gradingSystem: string;
    curriculumContext?: string;
    apiKey?: string;
  }): Promise<{
    assignment: {
      title: string;
      description: string;
      due_offset_days: number;
      points_possible: number;
      content: { questions: Array<{ id: string; prompt: string; type: string; points: number }> };
      rubric: { criteria: Array<{ name: string; points: number; description: string }>; total_points: number };
    };
  }> {
    const gradeContext = getGradeContext(params.gradeLevel);

    const response = await fetch(`${process.env.MODAL_API_URL}/generate_custom_homework`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MODAL_TOKEN_SECRET}`,
      },
      body: JSON.stringify({
        topic: params.topic,
        subject: params.subject,
        grade_level: params.gradeLevel,
        grade_context: gradeContext,
        grading_system: params.gradingSystem,
        curriculum_context: params.curriculumContext,
        apiKey: params.apiKey,
      }),
    });
    if (!response.ok) throw new Error(`Modal generate_custom_homework failed: ${response.statusText}`);
    return response.json();
  },

  // ============================================================
  // Phase 2: Admissions — Personalized welcome email for prospects
  // ============================================================

  async generateAdmissionsWelcome(params: {
    parentName: string;
    childName: string;
    gradeInterested: string;
    schoolName: string;
    inquiryResponses: Array<{ question: string; answer: string }>;
    suggestedTourTimes?: string[];
    apiKey?: string;
  }): Promise<{ subject: string; body: string }> {
    const response = await fetch(`${process.env.MODAL_API_URL}/generate_admissions_welcome`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MODAL_TOKEN_SECRET}`,
      },
      body: JSON.stringify({
        parent_name: params.parentName,
        child_name: params.childName,
        grade_interested: params.gradeInterested,
        school_name: params.schoolName,
        inquiry_responses: params.inquiryResponses,
        suggested_tour_times: params.suggestedTourTimes ?? [],
        apiKey: params.apiKey,
      }),
    });

    if (!response.ok) {
      throw new Error(`Modal admissions welcome failed: ${response.statusText}`);
    }

    return response.json();
  },

  // ============================================================
  // Phase 2: Onboarding — Reminder email for missing documents
  // ============================================================

  async generateOnboardingReminder(params: {
    parentName: string;
    childName: string;
    schoolName: string;
    missingDocuments: string[]; // Human-readable doc names
    enrollmentDate: string;
    portalUrl?: string;
    apiKey?: string;
  }): Promise<{ subject: string; body: string }> {
    const response = await fetch(`${process.env.MODAL_API_URL}/generate_onboarding_reminder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MODAL_TOKEN_SECRET}`,
      },
      body: JSON.stringify({
        parent_name: params.parentName,
        child_name: params.childName,
        school_name: params.schoolName,
        missing_documents: params.missingDocuments,
        enrollment_date: params.enrollmentDate,
        portal_url: params.portalUrl ?? '',
        apiKey: params.apiKey,
      }),
    });

    if (!response.ok) {
      throw new Error(`Modal onboarding reminder failed: ${response.statusText}`);
    }

    return response.json();
  },

  // ============================================================
  // Phase 2: Financial — Invoice notification email with fee breakdown
  // ============================================================

  async generateInvoiceEmail(params: {
    parentName: string;
    childName: string;
    schoolName: string;
    feeBreakdown: {
      registration_fee_cents: number;
      monthly_tuition_cents: number;
      activity_fees_cents: number;
    };
    totalAmountCents: number;
    paymentLink: string;
    dueDate: string;
    apiKey?: string;
  }): Promise<{ subject: string; body: string }> {
    const response = await fetch(`${process.env.MODAL_API_URL}/generate_invoice_email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MODAL_TOKEN_SECRET}`,
      },
      body: JSON.stringify({
        parent_name: params.parentName,
        child_name: params.childName,
        school_name: params.schoolName,
        fee_breakdown: params.feeBreakdown,
        total_amount_cents: params.totalAmountCents,
        payment_link: params.paymentLink,
        due_date: params.dueDate,
        apiKey: params.apiKey,
      }),
    });

    if (!response.ok) {
      throw new Error(`Modal invoice email failed: ${response.statusText}`);
    }

    return response.json();
  },
};
