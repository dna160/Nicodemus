/**
 * POST /api/curriculum/references
 *
 * Generates curriculum-level reference materials (textbooks, academic standards,
 * foundational papers) for the whole curriculum using Claude Sonnet.
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';

export interface CurriculumReference {
  title:       string;
  authors:     string;
  source:      string;
  year:        string;
  url?:        string;
  description: string;
  type:        'textbook' | 'standards' | 'journal' | 'guide' | 'website';
  audience:    'teacher' | 'student' | 'both';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { curriculumTitle, subject, gradeLevel, learningObjectives = [], keyConcepts = [] } = body;

    if (!subject || !gradeLevel) {
      return NextResponse.json({ success: false, error: 'subject and gradeLevel required' }, { status: 400 });
    }

    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'CLAUDE_API_KEY not configured' }, { status: 500 });
    }

    const client = new Anthropic({ apiKey });

    const prompt = `You are a curriculum librarian. Generate reference materials for this curriculum.

Curriculum: "${curriculumTitle}"
Subject: ${subject}
Grade Level: Grade ${gradeLevel}
Learning Objectives: ${learningObjectives.slice(0, 5).join('; ')}
Key Concepts: ${keyConcepts.slice(0, 8).join(', ')}

Output ONLY valid JSON — an array of 6-10 reference objects:
[
  {
    "title": "exact title",
    "authors": "author(s) or organization",
    "source": "publisher / journal / website",
    "year": "year",
    "url": "real URL if confidently known, else omit",
    "description": "2-3 sentences on relevance to this curriculum",
    "type": "textbook" | "standards" | "journal" | "guide" | "website",
    "audience": "teacher" | "student" | "both"
  }
]

Include a mix of: the primary textbook for this grade/subject, national curriculum standards (e.g. Common Core, NGSS), 2-3 teacher resource guides, and 1-2 student-appropriate reference sites. All entries must be real, verifiable works.`;

    const message = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 6000,
      messages:   [{ role: 'user', content: prompt }],
    });

    const rawText = message.content
      .filter((c) => c.type === 'text')
      .map((c) => (c as { type: 'text'; text: string }).text)
      .join('');

    const jsonText = rawText.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
    const references: CurriculumReference[] = JSON.parse(jsonText);

    return NextResponse.json({ success: true, references });
  } catch (err) {
    console.error('[curriculum/references] error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
