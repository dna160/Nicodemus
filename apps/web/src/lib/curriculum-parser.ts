/**
 * Curriculum Content Parser
 * Extracts key teaching points from Claude-generated curriculum JSON
 * Transforms raw JSONB content into structured, scannable display format
 *
 * Handles two formats:
 * 1. Text format: raw_response contains plain text with section headers
 * 2. JSON format: raw_response contains a JSON string (legacy Modal output)
 */

export interface Unit {
  dayNumber?: number;
  dayLabel?: string;
  title: string;
  keyTopics: string[];
  activities?: string[];
}

export interface ParsedCurriculum {
  title: string;
  subject: string;
  gradeLevel: string;
  gradingSystem?: string;
  learningObjectives: string[];
  units: Unit[];
  keyConcepts: string[];
  assessmentMethods: string[];
  standards?: string[];
}

/**
 * Parse curriculum content from Claude's response
 * Handles both plain-text and JSON-structured formats
 */
export function parseCurriculumContent(
  content: Record<string, any>,
  metadata?: {
    title?: string;
    subject?: string;
    gradeLevel?: string;
    gradingSystem?: string;
  }
): ParsedCurriculum {
  // Start with metadata if provided
  const parsed: ParsedCurriculum = {
    title: metadata?.title || 'Untitled Curriculum',
    subject: metadata?.subject || 'Unknown',
    gradeLevel: metadata?.gradeLevel || 'Unknown',
    gradingSystem: metadata?.gradingSystem,
    learningObjectives: [],
    units: [],
    keyConcepts: [],
    assessmentMethods: [],
  };

  // Extract raw string from the content object
  let rawResponse = '';
  if (content.raw_response && typeof content.raw_response === 'string') {
    rawResponse = content.raw_response;
  } else if (content.content && typeof content.content === 'string') {
    rawResponse = content.content;
  } else if (content.text && typeof content.text === 'string') {
    rawResponse = content.text;
  } else if (typeof content === 'string') {
    rawResponse = content as unknown as string;
  }

  if (!rawResponse) return parsed;

  // Try to detect if raw_response is JSON
  const trimmed = rawResponse.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const jsonContent = JSON.parse(rawResponse);
      return parseFromJson(jsonContent, parsed);
    } catch {
      // JSON is malformed/truncated — try regex extraction from partial JSON
      return extractFromPartialJson(rawResponse, parsed);
    }
  }

  // Text-based parsing — handles both plain text and Markdown headers (##, **)
  parsed.learningObjectives = extractSection(rawResponse, 'LEARNING OBJECTIVES');
  parsed.units = extractDailyBreakdown(rawResponse);
  parsed.keyConcepts = extractSection(rawResponse, 'KEY CONCEPTS');
  // Try multiple names for assessment section
  parsed.assessmentMethods = extractSection(rawResponse, 'ASSESSMENT METHODS');
  if (parsed.assessmentMethods.length === 0) {
    parsed.assessmentMethods = extractSection(rawResponse, 'ASSESSMENT STRATEGIES');
  }
  if (parsed.assessmentMethods.length === 0) {
    parsed.assessmentMethods = extractSection(rawResponse, 'ASSESSMENT');
  }

  return parsed;
}

/**
 * Extract content from partial/truncated JSON using regex patterns.
 * Used as fallback when JSON.parse fails on incomplete content.
 */
function extractFromPartialJson(rawResponse: string, base: ParsedCurriculum): ParsedCurriculum {
  // Extract day topics — matches: {"day": N, "topic": "..."} or "day1": {"topic": "..."}
  const topicPatterns = [
    /"topic":\s*"([^"]+)"/g,                         // "topic": "..."
    /"title":\s*"([A-Z][^"]{5,80})"/g,               // "title": "Long Title..."
  ];

  const topics: string[] = [];
  for (const pattern of topicPatterns) {
    const matches = [...rawResponse.matchAll(pattern)];
    matches.forEach((m) => {
      const val = m[1].trim();
      // Filter out metadata-like short strings
      if (val.length > 5 && !val.includes('\\n') && !/^\d/.test(val)) {
        topics.push(val);
      }
    });
    if (topics.length > 0) break;
  }

  // Deduplicate and build units
  const seen = new Set<string>();
  topics.forEach((topic, i) => {
    if (!seen.has(topic)) {
      seen.add(topic);
      base.units.push({
        dayNumber: base.units.length + 1,
        dayLabel: `Day ${base.units.length + 1}`,
        title: topic,
        keyTopics: [],
        activities: [],
      });
    }
  });

  // Extract objectives from JSON-like arrays
  const objPatterns = [
    /"(?:learning_objectives?|objectives?|goals?|learning_goals?)":\s*\[([^\]]{0,3000})/s,
  ];
  for (const pattern of objPatterns) {
    const match = rawResponse.match(pattern);
    if (match) {
      const items = [...match[1].matchAll(/"([^"\\]{10,200})"/g)].map((m) => m[1]);
      base.learningObjectives = items.slice(0, 20);
      break;
    }
  }

  // Extract key concepts
  const conceptPattern = rawResponse.match(
    /"(?:key_concepts?|keyConcepts?|vocabulary|core_concepts?|concepts?)":\s*\[([^\]]{0,2000})/s
  );
  if (conceptPattern) {
    const items = [...conceptPattern[1].matchAll(/"([^"\\]{3,80})"/g)].map((m) => m[1]);
    base.keyConcepts = items.slice(0, 20);
  }

  // Extract assessment info
  const assessPattern = rawResponse.match(
    /"(?:assessment|assessments?|grading|evaluation)":\s*\{([^}]{0,1000})/s
  );
  if (assessPattern) {
    const methods = [...assessPattern[1].matchAll(/"(?:type|method|description)":\s*"([^"]{5,200})"/g)].map(
      (m) => m[1]
    );
    base.assessmentMethods = methods.slice(0, 10);
  }

  return base;
}

/**
 * Parse from structured JSON (legacy Modal output that returned JSON instead of text)
 */
function parseFromJson(json: Record<string, any>, base: ParsedCurriculum): ParsedCurriculum {
  // Unwrap nested curriculum object if present
  const root: Record<string, any> =
    json.curriculum_unit || json.unit || json.curriculum || json;

  // --- Learning Objectives ---
  const objectives = root.learning_objectives || root.objectives || root.goals || [];
  if (Array.isArray(objectives)) {
    base.learningObjectives = objectives.slice(0, 20).map(String);
  } else if (objectives && typeof objectives === 'object') {
    // Objectives keyed by week: { week1: [...], week2: [...] }
    const allObjs: string[] = [];
    Object.values(objectives).forEach((weekObjs) => {
      if (Array.isArray(weekObjs)) {
        weekObjs.forEach((o) => {
          // Strip CCSS-style prefixes like "CCSS.MATH.5.NF.A.1: ..."
          const text = String(o).replace(/^[A-Z0-9.]+:\s*/, '');
          allObjs.push(text);
        });
      }
    });
    base.learningObjectives = allObjs.slice(0, 20);
  }

  // --- Daily / Weekly Breakdown ---
  base.units = extractUnitsFromJson(root);

  // --- Key Concepts ---
  const concepts =
    root.key_concepts ||
    root.keyConcepts ||
    root.vocabulary ||
    root.concepts ||
    root.topics ||
    [];
  if (Array.isArray(concepts)) {
    base.keyConcepts = concepts.slice(0, 20).map((c) =>
      typeof c === 'string' ? c : c.term || c.name || String(c)
    );
  }

  // --- Assessment Methods ---
  const assessment =
    root.assessment ||
    root.assessments ||
    root.grading ||
    root.evaluation ||
    {};
  if (Array.isArray(assessment)) {
    base.assessmentMethods = assessment.slice(0, 10).map(String);
  } else if (assessment && typeof assessment === 'object') {
    const methods: string[] = [];
    Object.entries(assessment).forEach(([key, val]) => {
      if (typeof val === 'string') {
        methods.push(`${key}: ${val}`);
      } else if (typeof val === 'object' && val !== null) {
        const desc = (val as any).description || (val as any).type || key;
        methods.push(String(desc));
      }
    });
    base.assessmentMethods = methods.slice(0, 10);
  }

  return base;
}

/**
 * Extract unit/day breakdown from JSON structure
 */
function extractUnitsFromJson(root: Record<string, any>): Unit[] {
  const units: Unit[] = [];

  // Try outline.weekN.days.dayN (common structure)
  const outline = root.outline || root.schedule || root.weeks || root.plan || {};

  if (outline && typeof outline === 'object' && !Array.isArray(outline)) {
    let dayCounter = 1;
    const weekKeys = Object.keys(outline).sort();
    for (const weekKey of weekKeys) {
      const week = outline[weekKey];
      if (!week || typeof week !== 'object') continue;

      const days = week.days || week.lessons || week.sessions || {};
      if (days && typeof days === 'object' && !Array.isArray(days)) {
        const dayKeys = Object.keys(days).sort();
        for (const dayKey of dayKeys) {
          const day = days[dayKey];
          if (!day) continue;
          units.push({
            dayNumber: dayCounter,
            dayLabel: `Day ${dayCounter}`,
            title: day.topic || day.title || day.focus || dayKey,
            keyTopics: day.description ? [day.description] : [],
            activities: day.lessonDuration ? [`${day.lessonDuration} lesson`] : [],
          });
          dayCounter++;
        }
      } else if (Array.isArray(days)) {
        days.forEach((day: any, i: number) => {
          units.push({
            dayNumber: dayCounter,
            dayLabel: `Day ${dayCounter}`,
            title: day.topic || day.title || `Day ${i + 1}`,
            keyTopics: day.description ? [day.description] : [],
            activities: [],
          });
          dayCounter++;
        });
      }
    }
  } else if (Array.isArray(outline)) {
    outline.forEach((item: any, i: number) => {
      units.push({
        dayNumber: i + 1,
        dayLabel: `Day ${i + 1}`,
        title: item.topic || item.title || `Day ${i + 1}`,
        keyTopics: item.description ? [item.description] : [],
        activities: [],
      });
    });
  }

  // Try direct days array
  if (units.length === 0) {
    const daysArray = root.days || root.lessons || [];
    if (Array.isArray(daysArray)) {
      daysArray.forEach((day: any, i: number) => {
        units.push({
          dayNumber: i + 1,
          dayLabel: `Day ${i + 1}`,
          title: day.topic || day.title || `Day ${i + 1}`,
          keyTopics: day.description ? [day.description] : [],
          activities: [],
        });
      });
    }
  }

  return units;
}

/**
 * Strip markdown formatting from a line (##, **, *, __, etc.)
 */
function stripMarkdown(line: string): string {
  return line
    .replace(/^#+\s*/, '')      // Remove leading # headers
    .replace(/\*\*/g, '')       // Remove bold **
    .replace(/\*/g, '')         // Remove italic *
    .replace(/^[-_]{3,}$/, '')  // Remove horizontal rules
    .trim();
}

/**
 * Extract a text section by header
 * Handles both plain text and Markdown-formatted headers (## SECTION:)
 */
function extractSection(text: string, sectionHeader: string): string[] {
  const lines = text.split('\n');
  const items: string[] = [];
  let inSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const stripped = stripMarkdown(trimmed).toUpperCase();

    // Check if this is the target section header (with or without ## prefix, : suffix)
    if (stripped.startsWith(sectionHeader.toUpperCase())) {
      inSection = true;
      continue;
    }

    // Check if we've hit another section header — plain or markdown (##)
    if (inSection && trimmed.length > 0) {
      const isNewSection =
        trimmed.match(/^#{1,3}\s+[A-Z]/) ||          // ## SECTION
        trimmed.match(/^[A-Z][A-Z\s]+:$/) ||          // PLAIN HEADER:
        trimmed.match(/^[A-Z][A-Z\s]+:\s*$/);         // PLAIN HEADER: (trailing space)
      if (isNewSection && !stripped.startsWith(sectionHeader.toUpperCase())) {
        break;
      }
    }

    // Extract items starting with -, •, or numbered list
    if (inSection && trimmed.length > 0) {
      const bulletMatch = trimmed.match(/^[-•*]\s+(.*)/);
      const numberedMatch = trimmed.match(/^\d+[.)]\s+(.*)/);
      if (bulletMatch) {
        items.push(bulletMatch[1].trim());
      } else if (numberedMatch) {
        items.push(numberedMatch[1].trim());
      }
    }
  }

  return items.slice(0, 20);
}

/**
 * Extract daily breakdown (Day 1, Day 2, etc.)
 * Handles Markdown formats: **Day 1: Title**, ### Day 1: Title
 */
function extractDailyBreakdown(text: string): Unit[] {
  const lines = text.split('\n');
  const days: Unit[] = [];
  let currentDay: Unit | null = null;
  let inDailyBreakdown = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const stripped = stripMarkdown(trimmed);

    // Detect the DAILY BREAKDOWN section header
    if (stripped.toUpperCase().includes('DAILY BREAKDOWN') || stripped.toUpperCase().includes('WEEKLY BREAKDOWN')) {
      inDailyBreakdown = true;
      continue;
    }

    // Stop if we hit a new top-level section (## heading that is NOT a day)
    if (inDailyBreakdown && trimmed.match(/^#{1,2}\s+[A-Z]/) && !stripped.match(/^Day\s+\d+/i)) {
      break;
    }

    if (inDailyBreakdown) {
      // Match day headers in multiple formats:
      // **Day 1: Title**, ### Day 1: Title, Day 1: Title
      const dayMatch = stripped.match(/^Day\s+(\d+)[:\s]+(.+?)(?:\s*[-–]\s*(.+))?$/i);
      if (dayMatch) {
        if (currentDay) days.push(currentDay);

        const dayNumber = parseInt(dayMatch[1]);
        // Clean the title — remove trailing ** etc.
        const rawTitle = dayMatch[2].replace(/\*+$/, '').trim();
        const description = dayMatch[3]?.replace(/\*+$/, '').trim();

        currentDay = {
          dayNumber,
          dayLabel: `Day ${dayNumber}`,
          title: rawTitle,
          keyTopics: description ? [description] : [],
          activities: [],
        };
      } else if (currentDay) {
        // Collect bullet points and bold topic lines as activities/keyTopics
        const bulletMatch = trimmed.match(/^[-•*]\s+(.*)/);
        const boldMatch = stripped.match(/^\*\*(.+?)\*\*/) || trimmed.match(/^\*\*(.+?)\*\*/);
        if (bulletMatch) {
          const activity = stripMarkdown(bulletMatch[1]).trim();
          if (activity) currentDay.activities?.push(activity);
        } else if (stripped.length > 5 && stripped.length < 120 && !stripped.startsWith('#')) {
          // Non-empty descriptive lines become keyTopics
          if (currentDay.keyTopics.length < 4) {
            currentDay.keyTopics.push(stripped.replace(/\*+/g, '').trim());
          }
        }
      }
    }
  }

  if (currentDay) days.push(currentDay);

  return days;
}

/**
 * Format curriculum for display - create a summary string
 */
export function formatCurriculumSummary(curriculum: ParsedCurriculum): string {
  const lines: string[] = [];

  lines.push(`${curriculum.title} (${curriculum.subject}, Grade ${curriculum.gradeLevel})`);
  lines.push('');

  if (curriculum.learningObjectives.length > 0) {
    lines.push('Learning Objectives:');
    curriculum.learningObjectives.slice(0, 3).forEach((obj) => {
      lines.push(`  • ${obj}`);
    });
    lines.push('');
  }

  lines.push(
    `${curriculum.units.length} days of instruction covering ${curriculum.keyConcepts.length} key concepts`
  );

  if (curriculum.assessmentMethods.length > 0) {
    lines.push('');
    lines.push('Assessment:');
    curriculum.assessmentMethods.slice(0, 2).forEach((method) => {
      lines.push(`  • ${method}`);
    });
  }

  return lines.join('\n');
}
