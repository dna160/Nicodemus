import type { NextApiRequest, NextApiResponse } from 'next';
import { GradingSystem } from 'shared';

/**
 * API Route: POST /api/curriculum/generate
 * Generates a curriculum unit using Modal (serverless)
 *
 * Request body:
 * - title: string (unit title)
 * - gradeLevel: string (e.g., "5", "7", "10")
 * - subject: string (e.g., "Math", "Science")
 * - durationWeeks: number
 * - gradingSystem: GradingSystem (grading standard)
 */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { title, gradeLevel, subject, durationWeeks, gradingSystem } = req.body;

  // Validate input
  if (!title || !gradeLevel || !subject || !durationWeeks) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Call Modal function to generate curriculum
    // In production, this would be: await modal.invoke(...)
    // For now, we'll mock the response while Modal is being set up

    const curriculum = await generateCurriculumWithModal({
      title,
      gradeLevel,
      subject,
      durationWeeks,
      gradingSystem,
    });

    // Optionally: Save to Supabase here
    // await supabase.from('lessons').insert({...})

    return res.status(200).json(curriculum);
  } catch (error) {
    console.error('Curriculum generation error:', error);
    return res.status(500).json({ error: 'Failed to generate curriculum' });
  }
}

/**
 * Call Modal function to generate curriculum
 * TODO: Replace with actual Modal invocation when Modal is deployed
 */
async function generateCurriculumWithModal(params: {
  title: string;
  gradeLevel: string;
  subject: string;
  durationWeeks: number;
  gradingSystem: GradingSystem;
}) {
  const { title, gradeLevel, subject, durationWeeks, gradingSystem } = params;

  // MOCK RESPONSE (replace with actual Modal call)
  // In production:
  // const result = await modal.invoke('generate_curriculum', {
  //   title, gradeLevel, subject, durationWeeks, gradingSystem
  // });

  const mockCurriculum = {
    title,
    gradeLevel,
    subject,
    durationWeeks,
    gradingSystem,
    outline: [
      {
        week: 1,
        title: `Introduction to ${title}`,
        objectives: [
          `Students will understand the basic concepts of ${title}`,
          `Students will be able to explain key terminology`,
        ],
        activities: [
          'Interactive introduction activity',
          'Brainstorming session',
          'Video: Overview of the concept',
        ],
        assessment: 'Pre-assessment quiz',
      },
      {
        week: 2,
        title: `Exploring ${title}`,
        objectives: [`Students will apply ${title} to real-world scenarios`],
        activities: [
          'Case study analysis',
          'Hands-on experiment or project',
          'Group discussion',
        ],
        assessment: 'Formative quiz',
      },
      {
        week: 3,
        title: `Mastering ${title}`,
        objectives: [`Students will demonstrate proficiency with ${title}`],
        activities: ['Problem-solving workshop', 'Peer teaching', 'Practice exercises'],
        assessment: 'Mid-unit assessment',
      },
      {
        week: 4,
        title: `${title} Synthesis & Assessment`,
        objectives: [
          `Students will synthesize their learning about ${title}`,
          `Students will reflect on their growth`,
        ],
        activities: [
          'Capstone project',
          'Reflection journal',
          'Peer presentations',
        ],
        assessment: `Final ${title} assessment (${getGradingScaleLabel(gradingSystem)} scale)`,
      },
    ],
    differentiation: {
      advanced: 'Extension activities with challenging applications',
      standard: 'Core curriculum aligned to standards',
      struggling: 'Scaffolded approach with additional support',
    },
    resources: [
      'Textbook chapters 5-8',
      'Online interactive simulations',
      'Manipulatives for hands-on learning',
      'Assessment templates',
    ],
    notes: `Curriculum generated for ${subject} Grade ${gradeLevel} using ${getGradingSystemLabel(gradingSystem)} grading system.`,
  };

  return mockCurriculum;
}

/**
 * Convert grading system enum to user-friendly label
 */
function getGradingSystemLabel(system: GradingSystem): string {
  const labels: Record<GradingSystem, string> = {
    local_alphabetical: 'Alphabetical (A-F)',
    local_integer: 'Percentage (0-100)',
    national_ccss: 'Common Core State Standards',
    state_standards: 'State Standards',
    international_ib: 'International Baccalaureate',
  };
  return labels[system];
}

/**
 * Convert grading system enum to scale label (for assessments)
 */
function getGradingScaleLabel(system: GradingSystem): string {
  const scales: Record<GradingSystem, string> = {
    local_alphabetical: 'A-F',
    local_integer: '0-100',
    national_ccss: 'CCSS',
    state_standards: 'State Standards',
    international_ib: 'IB',
  };
  return scales[system];
}
