# CLAUDE.md: Development Guidance for Nicodemus Project

**For Claude Code Assistant: How to assist with this project**

---

## Project Context

**Project Name:** Nicodemus, Teacher of Teachers (Enterprise Educational AI Suite)

**Core Vision:** A federated, multi-agent AI ecosystem for schools with strict privacy protection (Edge-to-Cloud architecture). Automates admin work, personalizes student learning, supports families—all while keeping sensitive student data local on student devices.

**Current Status:** Phase 1 Architectural Planning (documentation complete, infrastructure setup coming next)

**Key Documents:**
- `README.md` - Project overview
- `implementation.md` - Sprint-by-sprint roadmap (24 weeks)
- `ARCHITECTURE.md` - System design, cloud topology, data flows
- `SECURITY.md` - FERPA/COPPA/GDPR compliance, encryption, incident response

---

## Principles & Philosophy

### 1. Privacy-First
- ✅ Raw student behavioral data stays on student devices (Edge), never transmitted raw
- ✅ Data sanitization (raw → pedagogical vectors) happens locally
- ✅ Cloud agents only process encrypted, aggregated, anonymized data
- ❌ Never propose "just store everything in cloud" shortcuts
- ❌ Never suggest collecting data we don't explicitly need

### 2. Human-in-the-Loop (HITL) for High-Stakes Actions
- ✅ Grades: Agent suggests, teacher approves before finalization
- ✅ Parent Communication: Agent drafts, teacher reviews + approves before send
- ✅ Interventions: Agent detects trend, teacher decides action
- ❌ Never auto-send emails to parents (agent draft only)
- ❌ Never finalize grades without teacher approval

### 3. Event-Driven, Loosely-Coupled Architecture
- ✅ Agents communicate via Kafka topics (pub/sub), not direct HTTP calls
- ✅ Events are immutable and auditable
- ✅ Easy to add new agents without modifying existing ones
- ❌ Never suggest tightly-coupled REST calls between agents
- ❌ Never use request-response when pub/sub fits better

### 4. Compliance-First
- ✅ FERPA (US), COPPA (US, <13), GDPR (EU), CCPA (CA) by design
- ✅ Audit logs for all data access
- ✅ Data deletion on request (with legal holds)
- ❌ Never "we'll add compliance later"
- ❌ Never suggest storing PII in plain-text logs

### 5. Transparency & Auditability
- ✅ Every agent decision is logged with reasoning/confidence
- ✅ Parents/students can see what data was collected + how it was used
- ✅ Cryptographic signatures on all high-stakes decisions
- ❌ Never use "black box" models without explanation layer
- ❌ Never hide agent reasoning from humans

---

## Implementation Patterns & Best Practices

### Agent Development

**Pattern: Base Agent Class**
```python
from nicodemus.agents.base import BaseAgent
from nicodemus.events import EventBus

class TeacherAssistantAgent(BaseAgent):
    def __init__(self, event_bus: EventBus):
        super().__init__("TEACHER_ASSISTANT", event_bus)

        # Subscribe to events
        self.event_bus.subscribe('student_rep.concept_struggle',
                                  self.on_concept_struggle)
        self.event_bus.subscribe('teacher_asst.curriculum_requested',
                                  self.on_curriculum_requested)

    async def on_concept_struggle(self, event: Event):
        """React to student struggle event"""
        concept_id = event.payload['concept_id']
        # ... process and publish new event
        await self.event_bus.publish('teacher_asst.classroom_insight', {...})

    async def on_curriculum_requested(self, event: Event):
        """Generate curriculum on request"""
        # ... CPU-intensive work
        # Log decision reasoning for audit trail
        self.log_decision('CURRICULUM_GENERATED',
                         confidence=0.92,
                         reasoning="State standard match + student data")
```

**Anti-patterns:**
- ❌ Don't use blocking synchronous calls (always async/await)
- ❌ Don't make database queries without permission checks (RBAC)
- ❌ Don't publish raw sensitive data in events
- ❌ Don't forget to log decisions for audit trails

### Data Sanitization (Edge ↔ Cloud)

**Pattern: Sanitization Pipeline**
```python
class SanitizationPipeline:
    """Converts raw behavioral data to pedagogical vectors"""

    # Raw data (edge device ONLY)
    raw_data = {
        'keystrokes_per_minute': 45,
        'app_switches': 12,
        'focus_duration_seconds': 1200,
        'time_until_first_help_request': 180
    }

    # Sanitized output (safe to sync to cloud)
    sanitized = {
        'engagement_index': 0.72,  # 0-1 score
        'distraction_index': 0.28,
        'concept_gap': 'CCSS.MATH.3.NF.A.1',  # Learning standard ID
        'hint_timing': 'optimal'  # Categorical
    }

    # Student identity: NEVER in vectors
    # Device ID: Hashed, rotated regularly
    # Timestamp: Anonymized to date-only (not exact time)
```

**Anti-patterns:**
- ❌ Don't send timestamps with minute/second precision (privacy)
- ❌ Don't include student IDs in vectors (use anonymized hash)
- ❌ Don't send raw keystroke timings or app names
- ❌ Don't sync data without encryption

### Encryption & Secrets

**Pattern: Vault Integration**
```python
from nicodemus.secrets import VaultClient

class DatabaseService:
    def __init__(self, vault: VaultClient):
        # Never hardcode secrets
        db_url = vault.get_secret('db-url', ttl='1h')
        encryption_key = vault.get_secret('db-encryption-key', rotate=True)
        self.db = connect(db_url, encryption_key)
```

**Anti-patterns:**
- ❌ Don't hardcode secrets in code
- ❌ Don't commit `.env` files with real credentials
- ❌ Don't use same encryption key for >30 days
- ❌ Don't log encryption keys or passwords

### API & Communication

**Pattern: Event Publication**
```python
# Publish events via Kafka, not HTTP
event = Event(
    type='teacher_asst.grade_finalized',
    payload={
        'submission_id': 'uuid-xyz',
        'grade': 92,
        'feedback': '...',
        'teacher_approval': True,
        'timestamp': '2026-03-17T14:30:00Z'
    },
    signature='cryptographic-signature',  # For high-stakes events
    trace_id='trace-uuid'  # For audit trail
)
await event_bus.publish(event)
```

**Anti-patterns:**
- ❌ Don't use request-response HTTP for inter-agent communication
- ❌ Don't wait for synchronous replies (use event replies instead)
- ❌ Don't include sensitive data in event logging
- ❌ Don't forget signatures on high-stakes events

### Testing

**Pattern: Privacy-Respecting Tests**
```python
import pytest
from nicodemus.testing import TestDatabase, TestEventBus

@pytest.fixture
def test_env():
    db = TestDatabase()  # In-memory, no real student data
    event_bus = TestEventBus()
    yield db, event_bus
    # Cleanup: no data persists after test

def test_concept_struggle_detection(test_env):
    """Test that concept struggles are detected WITHOUT raw data"""
    db, event_bus = test_env

    # Insert sanitized vectors only (never raw)
    db.insert('sanitized_vectors', {
        'student_id': 'hash-xyz',
        'engagement_index': 0.4,  # Low engagement
        'concept_gap': 'CCSS.MATH.3.NF.A.1'
    })

    # Trigger concept struggle detection
    event_bus.publish('student_rep.behavioral_sync', {...})

    # Verify agent reacted
    assert event_bus.has_event('teacher_asst.classroom_insight')
```

**Anti-patterns:**
- ❌ Don't use real student data in tests
- ❌ Don't test with actual raw behavioral data
- ❌ Don't leave test data in production databases
- ❌ Don't skip security/privacy checks in tests

---

## Decision-Making Framework

### When to Propose Architecture Changes

✅ **YES**, propose if:
- Increases privacy protection
- Simplifies compliance auditing
- Improves teacher/student experience
- Reduces operational overhead (legitimate automation)
- Follows established patterns in this codebase

❌ **NO**, don't propose if:
- Centralizes sensitive data in cloud
- Removes human-in-the-loop from high-stakes actions
- Increases surveillance (more tracking, longer retention)
- Bypasses encryption or security controls
- Breaks FERPA/COPPA/GDPR compliance

### When to Add New Features

✅ **YES**, add if:
- Explicitly requested by project leadership
- Solves a real problem for teachers/students/admins
- Doesn't increase privacy risks
- Fits within Phase 1 (MVP) scope
- Is explicitly scoped (not open-ended)

❌ **NO**, don't add if:
- "Nice to have" but not requested
- Increases system complexity without clear ROI
- Expands data collection without justification
- Is out of scope for current phase
- Defers actual requested work

### When to Skip/Defer

Defer (Phase 2 or later) if:
- District-level analytics (Phase 2 analytics agent)
- Post-secondary counseling (Phase 2 counseling agent)
- Mobile apps (Phase 3)
- Third-party LMS integrations (Phase 3)
- Advanced ML models (Phase 2+)

---

## Code Review Checklist (For Claude)

When implementing features, verify:

### Security & Privacy
- [ ] No raw student data in logs or events
- [ ] All sensitive data encrypted at rest
- [ ] TLS 1.3 used for all network communication
- [ ] Secrets retrieved from Vault, never hardcoded
- [ ] All data access logged with user/agent ID
- [ ] RBAC checks performed before data access
- [ ] No personally identifiable info in metrics/traces
- [ ] Cryptographic signatures on high-stakes decisions

### Compliance
- [ ] FERPA audit trail maintained
- [ ] COPPA consent checked (if <13 students involved)
- [ ] GDPR data subject rights supported (if EU)
- [ ] CCPA compliance verified (if California)
- [ ] Data retention policy enforced
- [ ] Deletion requests can be fulfilled

### Event-Driven Design
- [ ] Agent uses pub/sub, not direct HTTP calls
- [ ] Events are immutable and versioned
- [ ] Event schema registered in schema registry
- [ ] Event ordering guaranteed where needed (Kafka partitions)
- [ ] Dead-letter queue for failed events
- [ ] Replay-ability verified (events not time-dependent)

### Human-in-the-Loop
- [ ] High-stakes actions (grades, emails) marked for approval
- [ ] Agent reasoning/confidence logged
- [ ] Human can override agent decisions
- [ ] Audit trail shows who approved what

### Testing & Documentation
- [ ] Unit tests with 80%+ coverage
- [ ] Integration tests use test databases (not prod)
- [ ] No real student data in tests
- [ ] API endpoints documented (OpenAPI/Swagger)
- [ ] Async operations have timeouts
- [ ] Error messages user-friendly (not stack traces)

### Performance & Scalability
- [ ] No blocking I/O in async functions
- [ ] Database queries use connection pools
- [ ] Caching strategy defined (Redis)
- [ ] Concurrent requests handled (Kubernetes scaling)
- [ ] Event processing latency <500ms (P95)

---

## Troubleshooting Guide for Claude

### "This seems like it violates privacy"
→ Check SECURITY.md section on data classification and sanitization. If unsure, ask: "Is raw PII being transmitted?" If yes, reject.

### "Should I add feature X?"
→ Check implementation.md Phase 1 deliverables. If X is there, proceed. If X is Phase 2+, defer and document. If X is not in PRD, ask user.

### "What about FERPA/COPPA compliance?"
→ Check SECURITY.md sections 2.1-2.4 for specific requirements. When in doubt, audit logging is always safe.

### "Should this be an agent or a function?"
→ If it communicates with other components → agent (pub/sub). If it's utility/helper → function in shared library. Pattern: agents are long-lived, subscribe to events; functions are stateless.

### "What encryption should I use?"
→ At-rest: AES-256-GCM (via PostgreSQL or Vault). In-transit: TLS 1.3. Message-level: AES-256-GCM + HMAC. See SECURITY.md section 3.1.

### "Should this be a cloud agent or edge agent?"
→ Cloud: computationally expensive, not real-time (lesson planning, grading, analytics). Edge: low-latency, privacy-sensitive (tutoring, behavior tracking). See ARCHITECTURE.md section 4.

---

## Key Files & Where to Find Things

| Question | File | Section |
|----------|------|---------|
| How do I implement a new agent? | ARCHITECTURE.md | Section 5 (Agent Framework) |
| What's the event schema? | ARCHITECTURE.md | Section 5.1 (Event Topics) |
| How does data flow? | ARCHITECTURE.md | Section 4 (Data Flow Diagrams) |
| What are compliance requirements? | SECURITY.md | Sections 2.1-2.4 |
| How do I handle encryption? | SECURITY.md | Section 3 |
| What's the development timeline? | implementation.md | Section V |
| What's the project scope (Phase 1)? | implementation.md | Section III |
| How do I handle RBAC? | ARCHITECTURE.md | Section 4.2 |

---

## Communication Style with User

When working on this project:

✅ **DO:**
- Be concise and direct
- Explain privacy implications clearly
- Reference specific sections of ARCHITECTURE.md/SECURITY.md when relevant
- Ask clarifying questions if requirements are ambiguous
- Summarize decisions in ADR (Architecture Decision Record) format

❌ **DON'T:**
- Propose shortcuts that weaken privacy
- Over-engineer (follow YAGNI principle)
- Ignore compliance requirements
- Make assumptions about school workflows
- Skip audit logging for "convenience"

---

## Questions to Ask User

Before implementing any feature:

1. **"Is this in Phase 1 scope?"** (Check implementation.md)
2. **"Who is the user? Teacher/student/parent/admin?"** (Affects data access rules)
3. **"Does this involve student data?"** (If yes, requires privacy review)
4. **"Is this high-stakes?"** (If yes, needs HITL approval)
5. **"What event(s) trigger this?"** (Forces event-driven thinking)

---

## Example: Implementing a New Feature

### User Request
"Add a feature that lets teachers see which students are most likely to drop out."

### Questions Claude Should Ask
1. Is this a Phase 1 feature? (probably Phase 2 analytics)
2. What data would indicate "dropout risk"? (attendance? grades? engagement?)
3. Is this being surfaced to individual teachers or administrators? (affects RBAC)
4. Are parents notified if they're flagged? (FERPA consideration)
5. Can students opt-out? (student autonomy)

### Response to User
"This sounds like a Phase 2 analytics feature (beyond MVP scope). Before we implement it:

1. **Scope clarification:** Should this predict at the student-level (per teacher) or district-level (admin only)?
2. **Privacy review:** Using engagement data + grades is reasonable, but we need explicit parent consent for predictive modeling.
3. **Human-in-the-loop:** Predictions should be flagged to counselors/admins for review, not auto-actioned.
4. **Data retention:** How long should this prediction score be retained?
5. **Fairness audit:** We need to verify this model isn't biased against socioeconomic/racial groups.

See [SECURITY.md](./SECURITY.md) section 2 for compliance requirements. I'd recommend we defer this to Phase 2 after we launch Phase 1 MVP and have real data to work with."

---

## Final Reminders

🎯 **Remember:** Every decision about Nicodemus impacts real students and families. Privacy breaches, unfair algorithms, and broken promises about data handling can cause real harm.

🔒 **Principle:** When in doubt, ask "Is this the minimum data we need to solve the problem?" If not, reduce scope.

📚 **Documentation:** This codebase will be audited by legal, security, and compliance teams. Code should be obvious; comments should explain *why*, not *what*.

🤝 **Partnership:** We're building tools to support (not replace) teachers and educators. Always ask: "Does this reduce teacher workload or increase surveillance?"

---

**Version:** 1.0
**Last Updated:** 2026-03-17
**Questions?** Refer to README.md or specific architecture documents
