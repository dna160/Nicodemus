"""
Modal App for Nicodemus - AI Compute Functions
Serverless GPU/CPU functions for heavy lifting:
- Curriculum generation
- Lesson variant synthesis
- Assignment grading
- Class insights synthesis

Uses direct HTTP calls to Claude API instead of Anthropic SDK
to avoid environment variable conflicts in Modal.
"""

import modal
import json
import os
import httpx
import asyncio
from typing import Any, Dict, List

# Define the Modal app
app = modal.App("nicodemus-ai")

# Create a shared image with common dependencies
base_image = modal.Image.debian_slim().pip_install(
    "httpx==0.25.0",
    "pydantic==2.5.0",
    "python-dotenv==1.0.0",
    "fastapi",
    "uvicorn",
)

# Claude API configuration
CLAUDE_API_URL = "https://api.anthropic.com/v1/messages"
CLAUDE_MODEL = "claude-haiku-4-5-20251001"

# ============================================
# Web API (FastAPI Bridge)
# ============================================

from fastapi import FastAPI, Body, Request, HTTPException
from fastapi.responses import JSONResponse

web_app = FastAPI()

@web_app.post("/generate_curriculum")
async def generate_curriculum_endpoint(params: Dict[str, Any]):
    """REST endpoint for curriculum generation"""
    # Get API key from request or environment
    api_key = params.get("apiKey") or os.environ.get("CLAUDE_API_KEY")
    if not api_key:
        return {"error": "CLAUDE_API_KEY required"}

    # Map camelCase from frontend to snake_case for the function
    return await generate_curriculum.remote.aio(
        api_key=api_key,
        title=params.get("title"),
        grade_level=params.get("gradeLevel", params.get("grade_level")),
        subject=params.get("subject"),
        duration_weeks=params.get("durationWeeks", params.get("duration_weeks", 4)),
        grading_system=params.get("gradingSystem", "local_alphabetical")
    )

@web_app.post("/generate_lesson_variants")
async def generate_lesson_variants_endpoint(params: Dict[str, Any]):
    return await generate_lesson_variants.remote.aio(
        lesson_content=params.get("lesson_content"),
        grade_level=params.get("grade_level")
    )

@web_app.post("/grade_assignment")
async def grade_assignment_endpoint(params: Dict[str, Any]):
    api_key = params.get("apiKey") or os.environ.get("CLAUDE_API_KEY")
    return await grade_assignment.remote.aio(
        api_key=api_key,
        submission_content=params.get("submission_content"),
        rubric=params.get("rubric"),
        subject=params.get("subject")
    )

@web_app.post("/generate_homework")
async def generate_homework_endpoint(params: Dict[str, Any]):
    """Generate homework assignments from a curriculum"""
    api_key = params.get("apiKey") or os.environ.get("CLAUDE_API_KEY")
    if not api_key:
        return {"error": "CLAUDE_API_KEY required"}
    return await generate_homework.remote.aio(
        api_key=api_key,
        curriculum_content=params.get("curriculum_content", ""),
        subject=params.get("subject", "General"),
        grade_level=params.get("gradeLevel", params.get("grade_level", "K")),
        grading_system=params.get("gradingSystem", params.get("grading_system", "local_alphabetical")),
        num_assignments=params.get("num_assignments", 3),
    )

@web_app.post("/generate_parent_email")
async def generate_parent_email_endpoint(params: Dict[str, Any]):
    """REST endpoint for PRM parent email generation"""
    api_key = params.get("apiKey") or os.environ.get("CLAUDE_API_KEY")
    if not api_key:
        return {"error": "CLAUDE_API_KEY required"}

    return await generate_parent_email.remote.aio(
        api_key=api_key,
        notification_type=params.get("notificationType", "progress"),
        student_name=params.get("studentName", "the student"),
        teacher_name=params.get("teacherName", "Your Teacher"),
        school_name=params.get("schoolName", "School"),
        details=params.get("details", {}),
    )

@web_app.post("/generate_sub_lesson_plan")
async def generate_sub_lesson_plan_endpoint(params: Dict[str, Any]):
    """REST endpoint for ERP substitute lesson plan generation"""
    api_key = params.get("apiKey") or os.environ.get("CLAUDE_API_KEY")
    if not api_key:
        return {"error": "CLAUDE_API_KEY required"}

    return await generate_sub_lesson_plan.remote.aio(
        api_key=api_key,
        class_name=params.get("className", "Class"),
        grade_level=params.get("gradeLevel", "K"),
        subject=params.get("subject", "General"),
        lesson_objectives=params.get("lessonObjectives", ""),
        student_count=params.get("studentCount", 20),
        materials_available=params.get("materialsAvailable", []),
        special_instructions=params.get("specialInstructions", ""),
    )

@app.function(image=base_image)
@modal.asgi_app()
def api():
    return web_app

# ============================================
# Helper: Call Claude API via HTTP
# ============================================

async def call_claude_api(api_key: str, messages: List[Dict[str, str]], max_tokens: int = 2000) -> str:
    """
    Call Claude API directly via HTTP.

    Args:
        api_key: Anthropic API key
        messages: List of message dicts with 'role' and 'content'
        max_tokens: Maximum tokens in response

    Returns:
        Response text from Claude
    """
    if not api_key:
        raise ValueError("CLAUDE_API_KEY is required")

    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }

    payload = {
        "model": CLAUDE_MODEL,
        "max_tokens": max_tokens,
        "messages": messages,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(CLAUDE_API_URL, json=payload, headers=headers)
        response.raise_for_status()

        data = response.json()
        if data.get("content") and len(data["content"]) > 0:
            return data["content"][0].get("text", "")
        return ""

# ============================================
# Teacher Assistant: Curriculum Generation
# ============================================

@app.function(image=base_image, timeout=900)
async def generate_curriculum(
    api_key: str,
    title: str,
    grade_level: str,
    subject: str,
    duration_weeks: int,
    grading_system: str = "local_alphabetical",
) -> Dict[str, Any]:
    """
    Generate a complete curriculum unit adapted to the teacher's grading system.
    Uses Claude Haiku for cost-efficient, fast curriculum generation.
    """
    # Map grading system to description
    grading_descriptions = {
        'local_alphabetical': 'Alphabetical scale (A+, A, A-, B+, B, etc.)',
        'local_integer': 'Percentage scale (0-100)',
        'national_ccss': 'Common Core State Standards (CCSS)',
        'state_standards': 'State-specific education standards',
        'international_ib': 'International Baccalaureate (IB)',
    }
    grading_desc = grading_descriptions.get(grading_system, grading_system)

    prompt = f"""
Generate a comprehensive {duration_weeks}-day curriculum unit for:

Title: {title}
Grade Level: {grade_level}
Subject: {subject}
Grading System: {grading_desc}

IMPORTANT: Adapt all assessments and grading rubrics to the {grading_desc} system.

Use this EXACT structured text format (no JSON):

LEARNING OBJECTIVES:
- Student learning objective 1
- Student learning objective 2
- Student learning objective 3
(list 3-5 clear, measurable objectives)

DAILY BREAKDOWN:
Day 1: Title - Brief topic description
- Key topic or activity
- Related concept
Day 2: Title - Brief topic description
- Key topic or activity
- Related concept
(continue for {duration_weeks} days)

KEY CONCEPTS:
- Concept 1
- Concept 2
- Concept 3
(list 5-10 key concepts students will learn)

ASSESSMENT METHODS:
- Daily problem sets on [topic]
- Daily problem sets on [topic]
- Daily problem sets on [topic]
- Unit assessment covering all topics
- Grading rubric aligned with {grading_desc}
(provide assessment methods including daily problem sets)

Include resources, differentiation strategies, and all teaching recommendations inline within these sections.
"""

    try:
        content = await call_claude_api(
            api_key=api_key,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=4000
        )

        # Return the text content directly - no JSON parsing needed
        return {"raw_response": content}
    except Exception as e:
        return {"error": str(e), "raw_response": content if 'content' in locals() else ""}

@app.function(image=base_image, timeout=600)
async def generate_lesson_variants(api_key: str, lesson_content: str, grade_level: str) -> Dict[str, Dict[str, str]]:
    """
    Generate differentiated lesson variants for multiple reading/learning levels.

    Args:
        lesson_content: Base lesson content
        grade_level: Grade level

    Returns:
        Dict with keys: basic, intermediate, advanced (each containing variant content)
    """
    prompt = f"""
Create 3 differentiated variants of this lesson for {grade_level} grade:

Original Lesson:
{lesson_content}

Provide variants for:
1. Basic (simplified language, shorter, more scaffolding)
2. Intermediate (original complexity)
3. Advanced (deeper content, more challenge)

Format as JSON: {{"basic": "...", "intermediate": "...", "advanced": "..."}}
"""

    try:
        content = await call_claude_api(
            api_key=api_key,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2000
        )

        return json.loads(content)
    except json.JSONDecodeError:
        return {"basic": content, "intermediate": content, "advanced": content}
    except Exception as e:
        return {"error": str(e)}


# ============================================
# Teacher Assistant: Grading & Feedback
# ============================================

@app.function(image=base_image, timeout=600)
async def grade_assignment(api_key: str, submission_content: str, rubric: Dict[str, Any], subject: str) -> Dict[str, Any]:
    """
    Grade an assignment submission using a rubric.

    Args:
        submission_content: Student submission text/content
        rubric: Grading rubric (e.g., {"criteria": [{"name": "clarity", "points": 10}]})
        subject: Subject area for context

    Returns:
        Dict with: score, feedback, criteria_scores
    """
    prompt = f"""
Grade this {subject} assignment against the rubric:

Submission:
{submission_content}

Rubric:
{json.dumps(rubric, indent=2)}

Provide:
1. Score (0-100)
2. Detailed feedback highlighting strengths and areas for improvement
3. Specific next steps for student growth

Format as JSON: {{"score": X, "feedback": "...", "next_steps": "..."}}
"""

    try:
        content = await call_claude_api(
            api_key=api_key,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1500
        )

        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()

        return json.loads(content)
    except json.JSONDecodeError:
        return {"score": 0, "feedback": content}
    except Exception as e:
        return {"score": 0, "error": str(e)}


# ============================================
# Teacher Assistant: Class Insights
# ============================================

@app.function(image=base_image, timeout=600)
async def synthesize_class_insights(api_key: str, class_metrics: List[Dict[str, Any]], concept_id: str, class_size: int) -> Dict[str, Any]:
    """
    Aggregate student metrics into actionable class insights.

    Args:
        class_metrics: List of student metrics (sanitized)
        concept_id: Which concept was being studied
        class_size: Total class enrollment

    Returns:
        Dict with: prevalence, key_struggles, recommended_interventions
    """
    # Calculate aggregated stats
    avg_success_rate = sum(m.get("success_rate", 0) for m in class_metrics) / len(class_metrics) if class_metrics else 0
    avg_time_spent = sum(m.get("time_spent_seconds", 0) for m in class_metrics) / len(class_metrics) if class_metrics else 0
    avg_distraction = sum(m.get("distraction_index", 0) for m in class_metrics) / len(class_metrics) if class_metrics else 0

    prompt = f"""
Analyze class-level metrics for the concept "{concept_id}":

- Class size: {class_size}
- Students with metrics: {len(class_metrics)}
- Average success rate: {avg_success_rate:.1%}
- Average time spent: {avg_time_spent:.0f} seconds
- Average distraction index: {avg_distraction:.2f}

Provide:
1. Is this a widespread struggle? (% of class affected)
2. Key patterns in the struggle
3. Recommended whole-class interventions
4. Which students might need 1-on-1 support

Format as JSON: {{"prevalence": "high/medium/low", "patterns": "...", "interventions": [], "flagged_students": []}}
"""

    try:
        content = await call_claude_api(
            api_key=api_key,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1000
        )

        return json.loads(content)
    except json.JSONDecodeError:
        return {"prevalence": "medium", "patterns": content}
    except Exception as e:
        return {"prevalence": "unknown", "error": str(e)}


# ============================================
# Student Homework Generation
# ============================================

@app.function(image=base_image, timeout=600)
async def generate_homework(
    api_key: str,
    curriculum_content: str,
    subject: str,
    grade_level: str,
    grading_system: str = "local_alphabetical",
    num_assignments: int = 3,
) -> Dict[str, Any]:
    """
    Generate homework assignments from a curriculum's raw content.
    Returns a list of assignments each with questions and a rubric.
    """
    grading_descriptions = {
        'local_alphabetical': 'A-F letter grades',
        'local_integer': '0-100 percentage',
        'national_ccss': 'Common Core Standards',
        'international_ib': 'IB 1-7 scale',
    }
    grading_desc = grading_descriptions.get(grading_system, grading_system)

    prompt = f"""
Based on this {subject} curriculum for grade {grade_level}, generate exactly {num_assignments} homework assignments.

Curriculum:
{curriculum_content[:3000]}

For each assignment create specific, answerable questions that test understanding.
Grading system: {grading_desc}

Return ONLY valid JSON in this exact format:
{{
  "assignments": [
    {{
      "title": "Short assignment title",
      "description": "1-2 sentence description of what students will practice",
      "due_offset_days": 3,
      "points_possible": 100,
      "content": {{
        "questions": [
          {{"id": "q1", "prompt": "Question text here?", "type": "short_answer", "points": 25}},
          {{"id": "q2", "prompt": "Another question?", "type": "short_answer", "points": 25}},
          {{"id": "q3", "prompt": "Explain concept in your own words.", "type": "essay", "points": 50}}
        ]
      }},
      "rubric": {{
        "criteria": [
          {{"name": "Accuracy", "points": 60, "description": "Correct answers to factual questions"}},
          {{"name": "Understanding", "points": 40, "description": "Demonstrates conceptual understanding"}}
        ],
        "total_points": 100
      }}
    }}
  ]
}}
"""

    try:
        content = await call_claude_api(
            api_key=api_key,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=3000
        )

        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()

        return json.loads(content)
    except json.JSONDecodeError:
        return {"error": "Failed to parse JSON", "raw": content if 'content' in locals() else ""}
    except Exception as e:
        return {"error": str(e)}


# ============================================
# PRM Agent: Parent Email Generation
# ============================================

@app.function(image=base_image, timeout=300)
async def generate_parent_email(
    api_key: str,
    notification_type: str,
    student_name: str,
    teacher_name: str,
    school_name: str,
    details: Dict[str, Any],
) -> Dict[str, str]:
    """
    Generate a parent-friendly email draft for teacher review and approval.
    Uses Claude Haiku for warm, concise, professional parent communication.

    Args:
        api_key: Claude API key
        notification_type: One of 'progress', 'alert', 'milestone', 'manual'
        student_name: Student's first name
        teacher_name: Teacher's name for sign-off
        school_name: School name for context
        details: Dict with relevant details (grades, achievements, concerns, etc.)

    Returns:
        Dict with 'subject' and 'body' keys for teacher to review before sending
    """
    type_contexts = {
        "progress": f"a warm weekly progress update for {student_name}",
        "alert": f"a supportive message about a concern with {student_name} that needs parent attention",
        "milestone": f"a celebratory message about {student_name}'s achievement or milestone",
        "manual": f"a general informational message to {student_name}'s parent",
    }
    context = type_contexts.get(notification_type, f"a {notification_type} update")

    prompt = f"""
Write a professional, warm, and concise parent email for {context}.

Teacher: {teacher_name}
School: {school_name}
Student: {student_name}
Details: {json.dumps(details, indent=2)}

Requirements:
- Warm and professional tone (not formal, not casual)
- 3-5 sentences for the body maximum
- Clear, specific subject line
- Avoid educational jargon - speak plain English
- Be specific using the details provided
- End with a positive, collaborative note encouraging partnership
- Do NOT include greetings like "Dear Parent" or signatures - teacher will add those

Format as JSON: {{"subject": "...", "body": "..."}}
"""

    try:
        content = await call_claude_api(
            api_key=api_key,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=600
        )

        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()

        return json.loads(content)
    except json.JSONDecodeError:
        return {"subject": f"Update about {student_name}", "body": content}
    except Exception as e:
        return {"subject": "Parent Notification", "body": f"Error generating email: {str(e)}"}


# ============================================
# ERP Agent: Substitute Lesson Plan Generation
# ============================================

@app.function(image=base_image, timeout=600)
async def generate_sub_lesson_plan(
    api_key: str,
    class_name: str,
    grade_level: str,
    subject: str,
    lesson_objectives: str,
    student_count: int,
    materials_available: List[str],
    special_instructions: str = "",
) -> Dict[str, Any]:
    """
    Generate a substitute-friendly lesson plan that's clear, simple, and executable
    by someone unfamiliar with the class.
    Uses Claude Haiku for structured, actionable guidance.

    Args:
        api_key: Claude API key
        class_name: e.g. "3rd Grade Science"
        grade_level: e.g. "3"
        subject: e.g. "Science"
        lesson_objectives: What students should learn/accomplish
        student_count: Number of students in class
        materials_available: List of materials the sub can use
        special_instructions: Any special notes (behavioral, ELL, etc.)

    Returns:
        Dict with: schedule, activities, materials_needed, classroom_management_tips, emergency_contacts
    """
    prompt = f"""
Generate a clear, structured lesson plan for a substitute teacher for {class_name}.

Grade Level: {grade_level}
Subject: {subject}
Number of Students: {student_count}
Available Materials: {', '.join(materials_available) if materials_available else 'Basic supplies only'}

LESSON OBJECTIVES:
{lesson_objectives}

SPECIAL INSTRUCTIONS/NOTES:
{special_instructions if special_instructions else "None"}

Requirements for the substitute:
- Provide a MINUTE-BY-MINUTE schedule for the {grade_level} grade attention span
- Include 2-3 engaging activities that can be done with minimal prep
- Be VERY specific about materials and setup
- Include classroom management tips (seating, transitions, common issues)
- Suggest a backup activity if students finish early
- NO complex instructions - assume the sub knows the subject but NOT the class
- Format output as practical, immediately actionable steps

Format as JSON:
{{
  "schedule": ["9:00-9:15: Activity description", "..."],
  "activities": [{{"name": "...", "instructions": "...", "duration": "..."}}, ...],
  "materials_needed": ["..."],
  "classroom_management": "Tips for managing this class",
  "backup_activity": "If students finish early",
  "transition_tips": "How to move between activities smoothly"
}}
"""

    try:
        content = await call_claude_api(
            api_key=api_key,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2000
        )

        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()

        return json.loads(content)
    except json.JSONDecodeError:
        return {"raw_response": content, "error": "Failed to parse JSON"}
    except Exception as e:
        return {"error": str(e), "raw_response": content if 'content' in locals() else ""}


# ============================================
# Deployment Test
# ============================================

@app.local_entrypoint()
def test():
    """Test the Modal functions locally"""
    print("Modal app is ready for deployment!")
    print("Deploy with: modal deploy modal_app.py")
