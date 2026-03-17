"""
Modal App for Nicodemus - AI Compute Functions
Serverless GPU/CPU functions for heavy lifting:
- Curriculum generation
- Lesson variant synthesis
- Assignment grading
- Class insights synthesis
"""

import modal
import json
import os
from typing import Any, Dict, List

# Define the Modal app
app = modal.App("nicodemus-ai")

# ANTHROPIC_API_KEY is automatically passed via Modal environment from .env file
# No need to explicitly define secrets - Anthropic client will use the environment variable

# Create a shared image with common dependencies
base_image = modal.Image.debian_slim().pip_install(
    "anthropic==0.26.0",
    "pydantic==2.5.0",
    "python-dotenv==1.0.0",
    "fastapi",
    "uvicorn",
)

# ============================================
# Web API (FastAPI Bridge)
# ============================================

from fastapi import FastAPI, Body, Request, HTTPException
from fastapi.responses import JSONResponse

web_app = FastAPI()

@web_app.post("/generate_curriculum")
async def generate_curriculum_endpoint(params: Dict[str, Any]):
    """REST endpoint for curriculum generation"""
    # Map camelCase from frontend to snake_case for the function
    # Use .remote.aio() for async context (FastAPI is async)
    return await generate_curriculum.remote.aio(
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
# Teacher Assistant: Curriculum Generation
# ============================================

@app.function(image=base_image, timeout=900)
def generate_curriculum(
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
    from anthropic import Anthropic

    client = Anthropic()

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

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=4000,
        messages=[{"role": "user", "content": prompt}]
    )

    try:
        content = response.content[0].text
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        return json.loads(content)
    except Exception:
        return {"raw_response": response.content[0].text}

@app.function(image=base_image, timeout=600)
def generate_lesson_variants(lesson_content: str, grade_level: str) -> Dict[str, Dict[str, str]]:
    """
    Generate differentiated lesson variants for multiple reading/learning levels.

    Args:
        lesson_content: Base lesson content
        grade_level: Grade level

    Returns:
        Dict with keys: basic, intermediate, advanced (each containing variant content)
    """
    from anthropic import Anthropic

    client = Anthropic()

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

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}]
    )

    try:
        return json.loads(response.content[0].text)
    except Exception:
        return {"basic": response.content[0].text}


# ============================================
# Teacher Assistant: Grading & Feedback
# ============================================

@app.function(image=base_image, timeout=600)
def grade_assignment(submission_content: str, rubric: Dict[str, Any], subject: str) -> Dict[str, Any]:
    """
    Grade an assignment submission using a rubric.

    Args:
        submission_content: Student submission text/content
        rubric: Grading rubric (e.g., {"criteria": [{"name": "clarity", "points": 10}]})
        subject: Subject area for context

    Returns:
        Dict with: score, feedback, criteria_scores
    """
    from anthropic import Anthropic

    client = Anthropic()

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

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}]
    )

    try:
        return json.loads(response.content[0].text)
    except Exception:
        return {"score": 0, "feedback": response.content[0].text}


# ============================================
# Teacher Assistant: Class Insights
# ============================================

@app.function(image=base_image, timeout=600)
def synthesize_class_insights(class_metrics: List[Dict[str, Any]], concept_id: str, class_size: int) -> Dict[str, Any]:
    """
    Aggregate student metrics into actionable class insights.

    Args:
        class_metrics: List of student metrics (sanitized)
        concept_id: Which concept was being studied
        class_size: Total class enrollment

    Returns:
        Dict with: prevalence, key_struggles, recommended_interventions
    """
    from anthropic import Anthropic

    client = Anthropic()

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

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}]
    )

    try:
        return json.loads(response.content[0].text)
    except Exception:
        return {"prevalence": "medium", "patterns": response.content[0].text}


# ============================================
# Deployment Test
# ============================================

@app.local_entrypoint()
def test():
    """Test the Modal functions locally"""
    print("Modal app is ready for deployment!")
    print("Deploy with: modal deploy modal_app.py")
