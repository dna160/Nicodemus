/**
 * POST /api/curriculum/teaching-materials
 *
 * Uses Claude Sonnet to generate rich teaching assistance materials for a
 * specific day's activities in a curriculum unit.
 *
 * Returns:
 *  - academicReferences  — journal articles, textbooks, standards docs
 *  - videoSources        — age-appropriate educational videos / channels
 *  - teachingTips        — pedagogical guidance for the teacher
 *  - activityGuides      — step-by-step facilitation for each activity
 *  - visualAids          — suggested visual / manipulative materials
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface AcademicReference {
  title:     string;
  authors:   string;
  source:    string;   // journal / publisher / website
  year:      string;
  url?:      string;
  relevance: string;   // one-line explanation of why it matters
  type:      'journal' | 'book' | 'standards' | 'website';
}

export interface VideoSource {
  title:       string;
  channel:     string;
  url:         string;
  duration:    string;   // e.g. "8 min"
  ageRange:    string;   // e.g. "Ages 8–12"
  description: string;
  platform:    'YouTube' | 'Khan Academy' | 'PBS Learning Media' | 'National Geographic' | 'TED-Ed' | 'Other';
}

export interface TeachingTip {
  tip:       string;
  rationale: string;
  timing:    'before' | 'during' | 'after';  // when in the lesson to apply it
}

export interface ActivityGuide {
  activityName:    string;
  objective:       string;
  materials:       string[];
  steps:           string[];
  differentation:  string;   // how to adapt for different learners
  estimatedTime:   string;
}

export interface VisualAid {
  type:        'diagram' | 'chart' | 'manipulative' | 'poster' | 'interactive';
  name:        string;
  description: string;
  howToCreate: string;
}

export interface TeachingMaterials {
  dayLabel:             string;
  dayTitle:             string;
  generatedAt:          string;
  academicReferences:   AcademicReference[];
  videoSources:         VideoSource[];
  teachingTips:         TeachingTip[];
  activityGuides:       ActivityGuide[];
  visualAids:           VisualAid[];
}

// ─── Prompt builder ─────────────────────────────────────────────────────────────

function buildPrompt(
  curriculumTitle: string,
  subject: string,
  gradeLevel: string,
  dayLabel: string,
  dayTitle: string,
  keyTopics: string[],
  activities: string[],
): string {
  return `You are an experienced curriculum specialist and instructional designer creating teaching assistance materials for an educator.

## Curriculum Context
- Curriculum: ${curriculumTitle}
- Subject: ${subject}
- Grade Level: Grade ${gradeLevel}
- Day: ${dayLabel} — "${dayTitle}"
- Key Topics: ${keyTopics.join(', ')}
- Activities planned: ${activities.length > 0 ? activities.join('; ') : 'General instruction and practice'}

## Your Task
Generate comprehensive teaching assistance materials for this specific lesson day. Output ONLY valid JSON matching the schema below — no markdown, no explanation, just the JSON object.

## Output Schema
{
  "academicReferences": [
    {
      "title": "string — exact title of the paper, book, or resource",
      "authors": "string — author(s) or organization",
      "source": "string — journal name, publisher, or website",
      "year": "string — publication year",
      "url": "string — direct URL if available (real, working URLs only; omit if uncertain)",
      "relevance": "string — 1-2 sentences on why this is useful for this lesson",
      "type": "journal" | "book" | "standards" | "website"
    }
    // provide 3-4 references mixing journals, books, and standards documents
  ],
  "videoSources": [
    {
      "title": "string — exact video title",
      "channel": "string — channel/creator name",
      "url": "string — full YouTube/Khan Academy/PBS URL (real URLs only)",
      "duration": "string — approximate duration e.g. '6 min'",
      "ageRange": "string — e.g. 'Ages 8–11' or 'Grade 4–6'",
      "description": "string — 2-3 sentences on content and how it supports the lesson",
      "platform": "YouTube" | "Khan Academy" | "PBS Learning Media" | "National Geographic" | "TED-Ed" | "Other"
    }
    // provide 2-3 videos appropriate for Grade ${gradeLevel} students
  ],
  "teachingTips": [
    {
      "tip": "string — specific, actionable teaching strategy",
      "rationale": "string — the pedagogical reasoning behind it",
      "timing": "before" | "during" | "after"
    }
    // provide 3-4 tips covering before/during/after
  ],
  "activityGuides": [
    {
      "activityName": "string",
      "objective": "string — what students will achieve",
      "materials": ["string", ...],
      "steps": ["string", ...] (5-8 clear steps),
      "differentation": "string — how to adapt for struggling or advanced learners",
      "estimatedTime": "string — e.g. '20 minutes'"
    }
    // one guide per activity listed above (or 2-3 if no activities specified)
  ],
  "visualAids": [
    {
      "type": "diagram" | "chart" | "manipulative" | "poster" | "interactive",
      "name": "string",
      "description": "string — what it shows and how it helps learning",
      "howToCreate": "string — simple instructions for the teacher to create or find it"
    }
    // provide 2-4 visual aids
  ]
}

Important:
- All video URLs must be real, working URLs from established educational platforms
- Academic references should be real, verifiable works — if unsure of exact URL, omit the url field
- Teaching tips must be specific to Grade ${gradeLevel} and the subject matter
- Activity guides must be practical and classroom-ready
- Keep student-facing language at an appropriate reading level for Grade ${gradeLevel}`;
}

// ─── Handler ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      curriculumTitle,
      subject,
      gradeLevel,
      dayLabel,
      dayTitle,
      keyTopics = [],
      activities = [],
    } = body;

    if (!subject || !gradeLevel || !dayTitle) {
      return NextResponse.json(
        { success: false, error: 'subject, gradeLevel, and dayTitle are required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'CLAUDE_API_KEY not configured' },
        { status: 500 }
      );
    }

    const client  = new Anthropic({ apiKey });
    const prompt  = buildPrompt(curriculumTitle, subject, gradeLevel, dayLabel, dayTitle, keyTopics, activities);

    const message = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 8096,
      messages:   [{ role: 'user', content: prompt }],
    });

    // Extract text content
    const rawText = message.content
      .filter((c) => c.type === 'text')
      .map((c) => (c as { type: 'text'; text: string }).text)
      .join('');

    // Strip markdown fences if present
    let jsonText = rawText.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();

    // Attempt parse; if truncated, try to recover a partial object
    let materials: Partial<TeachingMaterials>;
    try {
      materials = JSON.parse(jsonText);
    } catch {
      // Truncation recovery: close any open arrays/objects so JSON.parse can succeed
      const stack: string[] = [];
      for (const ch of jsonText) {
        if (ch === '{') stack.push('}');
        else if (ch === '[') stack.push(']');
        else if ((ch === '}' || ch === ']') && stack[stack.length - 1] === ch) stack.pop();
      }
      // Drop trailing incomplete string/value before closing
      const trimmed = jsonText.replace(/,\s*$/, '').replace(/"[^"]*$/, '""');
      const repaired = trimmed + stack.reverse().join('');
      try {
        materials = JSON.parse(repaired);
      } catch {
        throw new Error(`Claude returned malformed JSON. Raw: ${jsonText.slice(0, 200)}`);
      }
    }

    const result: TeachingMaterials = {
      dayLabel:           dayLabel   || '',
      dayTitle:           dayTitle   || '',
      generatedAt:        new Date().toISOString(),
      academicReferences: materials.academicReferences  || [],
      videoSources:       materials.videoSources        || [],
      teachingTips:       materials.teachingTips        || [],
      activityGuides:     materials.activityGuides      || [],
      visualAids:         materials.visualAids          || [],
    };

    return NextResponse.json({ success: true, materials: result });
  } catch (err) {
    console.error('[teaching-materials] error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
