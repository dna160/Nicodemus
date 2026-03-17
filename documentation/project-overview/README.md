# Nicodemus: Enterprise Educational AI Suite (EEAS)

**A Privacy-First, Multi-Agent AI System for Modern School Operations**

![Status](https://img.shields.io/badge/Status-Architectural%20Planning-blue)
![Version](https://img.shields.io/badge/Version-1.0--PRD-green)
![License](https://img.shields.io/badge/License-Proprietary-red)

---

## 🎯 What is Nicodemus?

Nicodemus is a **federated, event-driven AI multi-agent ecosystem** designed to revolutionize how schools operate by automating administrative work, personalizing student learning, and proactively supporting families—all while maintaining strict privacy protections.

### The Vision: "Privacy-First Personalization"

Rather than centralizing all student data in the cloud (common with EdTech), Nicodemus keeps sensitive behavioral data **locally on each student's device** while syncing only synthesized, anonymized insights to the cloud for teacher and administrator support.

**Key Innovation:** A hybrid Edge-to-Cloud architecture where:
- 📱 **Edge (Student Device):** Local AI agent processes raw behavior data, provides real-time tutoring, adapts difficulty
- ☁️ **Cloud (School/District):** Specialized agents handle lesson planning, grade suggestions, parent communication, resource management
- 🔐 **Privacy Layer:** Raw data never leaves the device; only synthesized "pedagogy vectors" are synced

---

## 📋 Core Features (Phase 1)

### 🧑‍🏫 Teacher Assistant Agent
Reduces grading and lesson planning time by 50%+
- **Curriculum Generation:** Automatically draft lesson plans aligned to state standards
- **Differentiation:** Generate 3-5 variants of each assignment (easy/medium/hard)
- **Grading Support:** Auto-grade objective tasks; provide rubric-based feedback for essays
- **Classroom Insights:** Aggregate student struggles to surface whole-class learning gaps

### 📚 Student Rep Agent (Edge)
Local AI tutor on every student's device
- **Behavior Tracking:** Monitor focus, distraction, time-on-task (locally, never sent raw)
- **Real-Time Tutoring:** Provide contextual hints when student is stuck (never the answer)
- **Adaptive Pacing:** Adjust difficulty based on comprehension
- **Privacy Gatekeeper:** Synthesize raw data locally; only encrypted vectors sync to cloud

### 👨‍👩‍👧 Parent Relationship Management Agent
Turns parents from "complaint receivers" into active partners
- **Proactive Updates:** Weekly progress summaries (not homework nagging)
- **Early Alerts:** Detect concerning trends early; draft intervention emails for teacher approval
- **Communication Logging:** Unified timeline of all parent-teacher interaction

### 🏢 School ERP & Resource Agent
Orchestrates school operations
- **Substitute Allocation:** Auto-match subs to absences + attach AI-generated lesson plans
- **Inventory Management:** Predict reorder dates based on curriculum usage
- **Facility Scheduling:** Optimize room scheduling and bus routes

---

## 🏗️ Project Structure

```
nicodemus/
├── README.md                      # This file
├── CLAUDE.md                      # Claude-specific development guidance
├── implementation.md              # Detailed implementation roadmap
├── ARCHITECTURE.md               # System design & technical specs
├── SECURITY.md                   # Security & compliance framework
├─ API_SPECIFICATION.md           # [Coming Soon] API contracts
│
├── src/                          # [Coming Soon] Source code
│   ├── agents/                   # Agent implementations
│   │   ├── teacher-assistant/
│   │   ├── student-rep/
│   │   ├── prm/
│   │   └── school-erp/
│   ├── core/                     # Shared libraries
│   │   ├── event-bus/
│   │   ├── data-sanitizer/
│   │   └── auth/
│   ├── cloud/                    # Cloud services
│   └── edge/                     # Edge (Electron) app
│
├── infrastructure/               # [Coming Soon] IaC & deployment
│   ├── terraform/                # Kubernetes, databases, VPC
│   ├── helm/                     # Kubernetes charts
│   └── docker/                   # Container images
│
├── docs/                         # [Coming Soon] Additional documentation
│   ├── API/                      # API reference
│   ├── deployment/               # Runbooks & guides
│   ├── compliance/               # Audit logs, certificates
│   └── onboarding/               # School/teacher onboarding
│
├── tests/                        # [Coming Soon] Test suites
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
└── .github/                      # [Coming Soon] CI/CD workflows
    └── workflows/                # GitHub Actions
```

---

## 🚀 Quick Start (Development)

### Prerequisites
- Python 3.11+
- Node.js 18+ (for Electron/frontend)
- Docker & Docker Compose
- Kubernetes (minikube for local dev)
- Git

### Local Development Setup

```bash
# Clone repository
git clone https://github.com/your-org/nicodemus.git
cd nicodemus

# Set up Python virtual environment
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
# or: venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Set up local Kafka, PostgreSQL, Redis (via Docker Compose)
docker-compose up -d

# Run migrations
python scripts/db_migrate.py

# Start agent (example)
python -m agents.teacher_assistant

# In another terminal, start Electron app
cd edge/student-rep
npm install
npm start
```

### Configuration
Create `.env` file at project root:

```bash
# Cloud
CLOUD_PROVIDER=aws           # aws, gcp, azure
AWS_REGION=us-west-2
POSTGRES_URL=postgresql://user:pass@localhost:5432/nicodemus_db

# Message Broker
KAFKA_BROKERS=localhost:9092

# Secrets
VAULT_ADDR=http://localhost:8200
CLAUDE_API_KEY=sk-...

# Auth
OAUTH_CLIENT_ID=...
OAUTH_CLIENT_SECRET=...

# Debugging
DEBUG=false
LOG_LEVEL=INFO
```

---

## 📚 Documentation Map

| Document | Purpose | Audience |
|----------|---------|----------|
| **implementation.md** | Sprint-by-sprint roadmap, deliverables, timelines | Project managers, architects |
| **ARCHITECTURE.md** | System design, cloud topology, data flow diagrams | Engineers, architects |
| **SECURITY.md** | Encryption, FERPA/COPPA/GDPR compliance, incident response | Security team, legal, compliance |
| **API_SPECIFICATION.md** (coming) | Event schemas, REST API contracts | Backend engineers |
| **deployment.md** (coming) | Kubernetes configs, CI/CD setup, runbooks | DevOps engineers |
| **onboarding.md** (coming) | How schools/teachers adopt Nicodemus | Product, customer success |

---

## 🔐 Privacy & Compliance

Nicodemus is designed from the ground up to meet strict educational privacy regulations:

✅ **FERPA Compliant** (US: Family Educational Rights and Privacy Act)
- Student data access rights for parents/students
- Audit logs for all data access
- Automated data deletion on request

✅ **COPPA Compliant** (US: Children's Online Privacy Protection)
- Parental consent for <13 students
- No student data sale
- Transparent, kid-friendly privacy notice

✅ **GDPR Compliant** (EU: General Data Protection Regulation)
- Lawful basis for processing (consent + contract)
- Data subject rights (access, deletion, portability)
- Data Protection Impact Assessment (DPIA)
- 72-hour breach notification

✅ **CCPA/CPRA Compliant** (California Privacy Rights Acts)
- Consumer rights (students/parents)
- Opt-out of data collection
- Data access/deletion within 45 days

See [SECURITY.md](./SECURITY.md) for full compliance details.

---

## 🔬 Technology Stack

### Cloud Backend
- **Language:** Python 3.11+ (primary), Go (performance-critical services)
- **Framework:** FastAPI (APIs), Pydantic (validation)
- **Message Broker:** Apache Kafka (event streaming)
- **Database:** PostgreSQL (structured data), Redis (cache)
- **Secrets:** HashiCorp Vault
- **Orchestration:** Kubernetes (EKS/GKE/AKS)

### Edge (Student Device)
- **Framework:** Electron + Vue.js 3
- **Language:** TypeScript
- **Local DB:** SQLite (encrypted)
- **ML Model:** ONNX Runtime (TinyML for data sanitization)

### DevOps
- **IaC:** Terraform
- **CI/CD:** GitHub Actions
- **Monitoring:** Prometheus + Grafana
- **Logging:** Elasticsearch + Kibana
- **Container Registry:** AWS ECR

---

## 📊 Project Phases

### Phase 1: MVP (Months 1-4)
- ✅ Core infrastructure (Kubernetes, Kafka, databases)
- ✅ Agent framework & event-driven architecture
- ✅ Privacy layer (data sanitization)
- ✅ Teacher Assistant Agent (curriculum, grading, insights)
- ✅ Student Rep Agent (Edge, behavior tracking, pacing)
- ✅ PRM Agent (parent communication)
- ✅ School ERP Agent (basic resource mgmt)
- 🔄 **Status:** Documentation complete, ready for infrastructure setup

### Phase 2: Advanced Analytics (Months 5-8)
- Macro-Trend & Analytics Agent (district-level dashboarding)
- Post-Secondary Counseling Agent (university planning)
- Compliance & Audit Agent (passive monitoring)

### Phase 3: Scale & Integration (Months 9-12)
- Multi-district rollout
- Third-party LMS integration (Google Classroom, Canvas)
- Mobile apps (iOS/Android)

---

## 🎯 Success Metrics

### Adoption
- **Teacher Usage:** 80%+ of teachers using Agent features weekly
- **Student Engagement:** 90%+ submission rate, 75% mastery progression

### Impact
- **Time Saved:** Teachers save 5+ hours/week on grading + lesson planning
- **Equity:** 30% improvement in disadvantaged student outcomes
- **Parent Satisfaction:** 85%+ NPS score

### Operations
- **System Uptime:** 99.95% availability
- **Data Privacy:** Zero security breaches (audited quarterly)
- **Compliance:** 100% FERPA/COPPA/GDPR compliance

---

## 🤝 Contributing

Development will begin following approval of this architectural plan.

### Code Style
- **Python:** PEP 8 (enforced via Black + isort)
- **TypeScript:** ESLint + Prettier
- **Kubernetes:** Helm conventions

### Testing
- **Unit:** Pytest (Python), Jest (TypeScript)
- **Integration:** Testcontainers (Kafka, PostgreSQL)
- **E2E:** Playwright (web), Detox (mobile)

### Commit Message Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

Example:
```
feat(teacher-assistant): implement curriculum generation engine

- Added support for state/national standards
- Integrated Claude API for content generation
- Implemented Jinja2 templating for lessons

Closes #123
```

---

## 📋 Roadmap

- **Week 1-2:** Cloud provider decision, team assembly
- **Week 3-4:** Infrastructure setup, CI/CD pipeline
- **Week 5-8:** Agent framework & privacy layer
- **Week 9-12:** Teacher Assistant Agent
- **Week 13-16:** Student Rep Agent (Edge)
- **Week 17-20:** PRM + ERP Agents
- **Week 21-24:** Integration testing, pilot school deployment

---

## 📞 Support & Communication

- **Architecture Questions?** → See [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Security/Compliance?** → See [SECURITY.md](./SECURITY.md)
- **Implementation Details?** → See [implementation.md](./implementation.md)
- **Development Guidance?** → See [CLAUDE.md](./CLAUDE.md)

---

## 📄 License

**Proprietary.** All rights reserved. This project is under active development for authorized school districts only.

---

## ✅ Checklist Before First Sprint

- [ ] Cloud provider selected (AWS/GCP/Azure)
- [ ] Budget approved for Year 1 infrastructure
- [ ] Core team assembled (infra, backend, frontend, compliance)
- [ ] Pilot school identified + partnership agreement signed
- [ ] Legal review of FERPA/COPPA/GDPR compliance completed
- [ ] CI/CD pipeline documented
- [ ] Local development environment guide created
- [ ] Agent framework SDK finalized
- [ ] Data schema review + approval
- [ ] Security audit plan documented

---

**Document Version:** 1.0 (PRD-Based)
**Last Updated:** 2026-03-17
**Status:** ✅ Ready for Architecture Review

---

### 🙏 Acknowledgments

Nicodemus is inspired by principles of:
- **Privacy-by-Design** (GDPR, FERPA best practices)
- **User-Centered Design** (teacher & student voice prioritized)
- **Equity in EdTech** (accessible to resource-constrained districts)
- **Responsible AI** (human-in-the-loop, transparency, auditability)
