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
 *
 * Haiku is ideal for Nicodemus because:
 * - Fast responses (curriculum in ~5-10 seconds)
 * - Low cost (~$0.01 per curriculum generation)
 * - Sufficient capability for structured task (lesson planning, grading)
 */

export const modal = {
  async generateCurriculum(params: {
    title: string;
    gradeLevel: string;
    subject: string;
    gradingSystem: string;
    durationWeeks: number;
    apiKey?: string;  // Optional API key passed from backend
  }) {
    // In a production scenario, this would call the Modal webhook or project endpoint
    // For now, we point to the expected workspace/function path
    const response = await fetch(`${process.env.MODAL_API_URL}/generate_curriculum`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MODAL_TOKEN_SECRET}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`Modal function failed: ${response.statusText}`);
    }

    return response.json();
  },

  async generateLessonVariants(lessonContent: string, gradeLevel: string) {
    const response = await fetch(`${process.env.MODAL_API_URL}/generate_lesson_variants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MODAL_TOKEN_SECRET}`,
      },
      body: JSON.stringify({ lesson_content: lessonContent, grade_level: gradeLevel }),
    });

    if (!response.ok) {
      throw new Error(`Modal function failed: ${response.statusText}`);
    }

    return response.json();
  }
};
