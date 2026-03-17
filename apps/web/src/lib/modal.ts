/**
 * Modal Client Helper
 * Note: Modal functions are typically Python-based.
 * In this lean stack, we call them via their served endpoints or a bridge.
 */

export const modal = {
  async generateCurriculum(params: {
    title: string;
    gradeLevel: string;
    subject: string;
    standards: string[];
    durationWeeks: number;
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
