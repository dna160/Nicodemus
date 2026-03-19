"""
Modal function: Lightweight student metrics summarization
Called by Supabase Edge Function for pedagogical insights
"""

from modal import App, build, enter

app = App("nicodemus-student-metrics")


@app.function()
async def summarize_study_session(metrics: dict) -> dict:
    """
    Lightweight summarization of student study session

    Input metrics:
    {
        "avg_idle_seconds": 15.2,
        "avg_keystrokes_per_minute": 45,
        "struggle_events_count": 2,
        "focus_score": 78,
        "total_tab_switches": 12,
        "dominant_tab_category": "docs",
        "session_duration_minutes": 30
    }

    Output:
    {
        "summary": "Good focus with minor struggles",
        "focus_level": "high" | "normal" | "low",
        "fatigue_indicator": "none" | "mild" | "moderate" | "severe",
        "recommendations": ["Take a 5-min break", "Try a different subject"],
        "engagement_score": 78
    }
    """

    from anthropic import Anthropic

    client = Anthropic()

    # Build prompt for Claude
    focus_score = metrics.get("focus_score", 50)
    avg_idle = metrics.get("avg_idle_seconds", 30)
    struggle_count = metrics.get("struggle_events_count", 0)
    tab_switches = metrics.get("total_tab_switches", 0)
    session_duration = metrics.get("session_duration_minutes", 0)
    dominant_activity = metrics.get("dominant_tab_category", "unknown")

    prompt = f"""Analyze this student study session data and provide brief pedagogical insights:

Session Data:
- Duration: {session_duration} minutes
- Focus Score: {focus_score}/100
- Average Idle Time: {avg_idle} seconds
- Struggle Events: {struggle_count}
- Tab Switches: {tab_switches}
- Primary Activity: {dominant_activity}

Provide a JSON response with:
1. "summary": 1-2 sentence pedagogical insight (e.g., "Good focus on coding work with minor distractions")
2. "focus_level": "high" (>80), "normal" (50-80), or "low" (<50)
3. "fatigue_indicator": "none", "mild", "moderate", or "severe" based on idle time
4. "recommendations": Array of 1-3 actionable suggestions (e.g., "Take a 5-min break", "Switch to a different subject")
5. "engagement_score": 0-100 estimate of student engagement

Keep recommendations concise and actionable. Focus on what helps the student learn better.

Respond ONLY with valid JSON."""

    # Call Claude API
    message = client.messages.create(
        model="claude-3-5-sonnet-20241022",  # Use latest model
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}],
    )

    # Parse response
    response_text = message.content[0].text
    print(f"[Modal] Claude response: {response_text}")

    # Try to parse JSON
    import json

    try:
        result = json.loads(response_text)
    except json.JSONDecodeError:
        # Fallback if Claude didn't return pure JSON
        print("[Modal] Failed to parse Claude response, using defaults")
        result = {
            "summary": f"Focus on {dominant_activity} with {struggle_count} difficulties",
            "focus_level": "high" if focus_score > 75 else "normal" if focus_score > 50 else "low",
            "fatigue_indicator": (
                "severe"
                if avg_idle > 60
                else "moderate"
                if avg_idle > 40
                else "mild"
                if avg_idle > 20
                else "none"
            ),
            "recommendations": [
                "Take a 5-minute break" if avg_idle > 30 else "Keep up the momentum",
                "Try a different approach" if struggle_count > 3 else "",
            ],
            "engagement_score": focus_score,
        }
        # Remove empty strings
        result["recommendations"] = [r for r in result["recommendations"] if r]

    print(f"[Modal] Summarization complete: {result}")
    return result


@app.local_entrypoint()
def test_summarization():
    """Test the summarization function locally"""

    # Test data: High focus session
    test_metrics = {
        "avg_idle_seconds": 12.5,
        "avg_keystrokes_per_minute": 52,
        "struggle_events_count": 1,
        "focus_score": 85,
        "total_tab_switches": 8,
        "dominant_tab_category": "coding",
        "session_duration_minutes": 30,
    }

    result = summarize_study_session.remote(test_metrics)
    print(f"\n✅ Test Result:\n{result}\n")

    # Test data: Struggling session
    test_metrics_struggling = {
        "avg_idle_seconds": 45.0,
        "avg_keystrokes_per_minute": 18,
        "struggle_events_count": 5,
        "focus_score": 45,
        "total_tab_switches": 25,
        "dominant_tab_category": "other",
        "session_duration_minutes": 30,
    }

    result_struggling = summarize_study_session.remote(test_metrics_struggling)
    print(f"\n❌ Struggling Test Result:\n{result_struggling}\n")
