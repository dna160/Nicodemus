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
    return await grade_assignment.remote.aio(
        submission_content=params.get("submission_content"),
        rubric=params.get("rubric"),
        subject=params.get("subject")
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
Generate a comprehensive {duration_weeks}-week curriculum unit for:

Title: {title}
Grade Level: {grade_level}
Subject: {subject}
Grading System: {grading_desc}

IMPORTANT: Adapt all assessments and grading rubrics to the {grading_desc} system.

Provide:
1. Weekly lesson outline with learning objectives
2. Daily activity suggestions
3. Formative assessment ideas (graded on {grading_desc})
4. Summative assessment with rubric (graded on {grading_desc})
5. Required resources and materials
6. Differentiation strategies for diverse learners

Format as JSON with keys: outline, objectives, activities, assessments, resources, differentiation
"""

    try:
        content = await call_claude_api(
            api_key=api_key,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=4000
        )

        # Try to extract JSON from response
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()

        return json.loads(content)
    except json.JSONDecodeError:
        # Return raw response if JSON parsing fails
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
# Deployment Test
# ============================================

@app.local_entrypoint()
def test():
    """Test the Modal functions locally"""
    print("Modal app is ready for deployment!")
    print("Deploy with: modal deploy modal_app.py")
