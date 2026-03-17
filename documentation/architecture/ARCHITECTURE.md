# Nicodemus Architecture Document
**Enterprise Educational AI Suite - System Design & Technical Specifications**

---

## 1. System Overview

Nicodemus is a **federated, event-driven AI multi-agent system** designed to operate across two computational domains:
- **Edge (Student Devices):** Local, privacy-first data processing (Tauri app, Phase 2+)
- **Cloud (Serverless):** Lightweight AI compute, workflows, and dashboards

The system is bound together by an **event-driven architecture**:
- **Supabase Webhooks** trigger on database changes
- **Inngest** orchestrates multi-step workflows (no queues, no infrastructure)
- **Modal** runs serverless AI tasks (Claude API, Python compute)
- **No Kafka** - eliminated for solo developer simplicity and instant scaling

---

## 2. Architectural Principles

### 2.1 Privacy-First by Design
- **Raw behavioral data never leaves the edge.**
- **Sanitization happens locally** before any cloud sync.
- **Transparency & Auditability:** Every data transformation is logged and auditable by parents/compliance teams.
- **Minimal Data Retention:** Raw data deleted after synthesis; only vectors retained.

### 2.2 Event-Driven (Pub/Sub)
- **No request-response chains.** Agents are autonomous publishers and subscribers.
- **Temporal Decoupling:** Agents don't need to know about each other.
- **Scalability:** Easy to add new agents or subscribers to existing events.
- **Replay-ability:** Events are immutable; full audit trail exists.

### 2.3 Serverless & FaaS
- **No servers to manage.** All compute is serverless (Vercel, Modal, Supabase).
- **Instant scaling:** Requests automatically scale from 1 to 10,000+.
- **Pay-per-use:** No infrastructure cost during idle time.
- **Language agnostic:** API routes in TypeScript, Modal functions in Python, workflows in TypeScript.

### 2.4 Human-in-the-Loop (HITL)
- **High-stakes actions require human approval:**
  - Sending parent emails
  - Finalizing grades
  - Triggering interventions
- **Transparent decision-making:** All agent recommendations show reasoning/confidence scores.

---

## 3. Cloud Architecture (Serverless & FaaS)

### 3.1 High-Level Topology (Lean Solo-Dev Edition)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js Dashboard (Vercel)                    │
│              (Frontend + API Routes, auto-deployed)              │
└────┬────────────────────────────┬────────────────────────────────┘
     │                            │
     ▼                            ▼
┌──────────────────┐      ┌──────────────────┐
│ Supabase Auth    │      │ Supabase REST    │
│ (OAuth 2.0)      │      │ API              │
│                  │      │                  │
│ - Teacher login  │      │ - CRUD ops       │
│ - Parent login   │      │ - RLS enforced   │
└──────────────────┘      └────────┬─────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
          ┌─────────▼────────────┐     ┌─────────▼─────────┐
          │  Supabase Database   │     │  Supabase Webhooks│
          │  (PostgreSQL + RLS)  │     │                   │
          │                      │     │ Triggers Inngest  │
          │ - curricula          │     │ on:               │
          │ - grades             │     │ - INSERT grades   │
          │ - submissions        │     │ - UPDATE student  │
          │ - teachers           │     │ - DELETE old data │
          │ - students           │     │                   │
          │ - audit_log          │     └────────┬──────────┘
          │                      │              │
          │ RLS Policy:          │              ▼
          │ - Teachers see own   │     ┌──────────────────┐
          │   roster only        │     │  Inngest         │
          │ - Students see own   │     │  (Workflows)     │
          │   data only          │     │                  │
          │ - Audit logs all     │     │ Orchestrates:    │
          │   access             │     │ - Multi-step     │
          └──────────────────────┘     │   jobs           │
                    ▲                  │ - Human approval │
                    │                  │ - Error retries  │
                    │                  │ - Scheduling     │
          ┌─────────┴────────────┐     │                  │
          │                      │     └────────┬─────────┘
          │                      │              │
    ┌─────▼──────┐      ┌────────▼─────┐      │
    │  Supabase  │      │   Modal      │      │
    │ Realtime   │      │  (Serverless │      ▼
    │            │      │   GPU/CPU)   │   ┌─────────────┐
    │ Live       │      │              │   │ Vercel      │
    │ subscr.    │      │ Handles:     │   │ Secrets +   │
    │ for        │      │ - Curriculum │   │ Environment │
    │ real-time  │      │   generation │   │             │
    │ UI updates │      │ - Grade      │   │ Stores:     │
    │            │      │   feedback   │   │ - API keys  │
    └────────────┘      │ - Inference  │   │ - DB URL    │
                        │              │   │ - JWT keys  │
                        └──────────────┘   └─────────────┘
```

**Key Differences from Enterprise Stack:**
- ✅ No Kubernetes cluster to maintain
- ✅ No Kafka brokers to monitor
- ✅ No Redis servers to manage
- ✅ No Elasticsearch cluster
- ✅ No infrastructure costs during idle time
- ✅ Auto-scaling from 0 to 10,000+ concurrent requests

### 3.2 Serverless Function Specifications

#### Vercel Edge Functions (API Routes)

```typescript
// app/api/curriculum/generate/route.ts
// Runs on Vercel (auto-deployed from GitHub)

import { inngest } from '@/lib/inngest';

export async function POST(req: Request) {
  const { grade_level, subject, standards } = await req.json();

  // Trigger Inngest workflow (durable, auto-retries)
  const result = await inngest.send({
    name: 'teacher_assistant.curriculum.requested',
    data: {
      grade_level,
      subject,
      standards,
      teacher_id: req.user.id, // Auth enforced by Supabase
    },
  });

  return Response.json({ workflow_id: result[0].ids[0] });
}
```

**Key Features:**
- Auto-deployed on `git push` (GitHub → Vercel)
- Scales instantly from 0 to 10,000+ requests/sec
- Free tier: 100GB bandwidth, unlimited functions
- Production-grade with automatic error tracking

#### Modal Serverless Functions (GPU/CPU Tasks)

```python
# modal_app.py
# Runs on Modal (GPU/CPU available on-demand)

import modal
from anthropic import Anthropic

app = modal.App("nicodemus")

@app.function(
    image=modal.Image.debian_slim().pip_install("anthropic"),
    secrets=[modal.Secret.from_name("claude-api-key")]
)
async def generate_curriculum(
    grade_level: int,
    subject: str,
    standards: list[str]
) -> dict:
    """
    Serverless function running on Modal.
    Scales from 0 to 1000+ concurrent calls.
    Costs: ~$0.10/GPU hour or $0 for CPU tasks.
    """
    client = Anthropic()

    prompt = f"Generate lesson plan for {grade_level} grade {subject}..."

    message = await client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}]
    )

    return {"lesson_plan": message.content[0].text}

@app.local_entrypoint()
def main():
    # Call from anywhere:
    # python modal_app.py --grade-level 3 --subject math
    result = generate_curriculum.remote(3, "math", ["CCSS.MATH.3.NF.A.1"])
    print(result)
```

**Key Features:**
- Serverless GPU (pay-per-second, no upfront cost)
- Auto-scaling (instant, no warm-up time)
- Perfect for: LLM calls, image processing, heavy compute
- Python-native (vs. JavaScript in Vercel)

#### Inngest Durable Workflows

```typescript
// lib/inngest/workflows/approval.ts
// Runs on Inngest (durable, survives infrastructure failures)

import { inngest } from '@/lib/inngest';

export const gradeApprovalWorkflow = inngest.createFunction(
  { id: 'grade.approval-workflow' },
  { event: 'grade/drafted' },
  async ({ event, step }) => {
    const { submission_id, feedback_draft } = event.data;

    // Step 1: Feedback generated and visible in dashboard
    // Teacher clicks "approve" in Next.js UI

    // Step 2: Wait for webhook callback (with timeout)
    const approval = await step.waitForEvent('grade/approved', {
      timeout: '7d',
      match: `data.submission_id == '${submission_id}'`,
    });

    if (!approval) {
      // Escalate if not approved within 7 days
      await step.sendEvent('escalate', {
        name: 'admin/grade.pending-approval',
        data: { submission_id, days: 7 },
      });
      return;
    }

    // Step 3: Grade approved → finalize and notify parent
    await step.run('finalize-grade', async () => {
      await supabase
        .from('grades')
        .update({ status: 'finalized' })
        .eq('submission_id', submission_id);
    });

    // Step 4: Trigger PRM workflow
    await step.sendEvent('notify-parent', {
      name: 'prm.parent-notification.grade-finalized',
      data: { submission_id },
    });

    return { status: 'approved' };
  }
);
```

**Key Features:**
- Durable (survives infrastructure failures)
- Human-in-the-loop (wait for webhook, then resume)
- Error handling (automatic retries, exponential backoff)
- Visible execution history (debugging)

---

## 4. Edge Architecture (Student Devices)

### 4.1 Electron App Structure

```
nicodemus-student-rep/
├── src/
│   ├── main/
│   │   ├── index.ts (entry point, window mgmt)
│   │   ├── preload.ts (IPC bridge)
│   │   └── app-lifecycle.ts (auto-update, background tasks)
│   │
│   ├── renderer/
│   │   ├── components/
│   │   │   ├── StudentDashboard.vue
│   │   │   ├── AssignmentViewer.vue
│   │   │   ├── HintProvider.vue
│   │   │   └── PrivacyPanel.vue
│   │   ├── stores/
│   │   │   ├── assignmentStore.ts
│   │   │   ├── progressStore.ts
│   │   │   └── settingsStore.ts
│   │   └── App.vue
│   │
│   ├── core/
│   │   ├── activity-monitor/
│   │   │   ├── ActivityCollector.ts (OS hooks)
│   │   │   ├── WindowTracker.ts
│   │   │   └── KeyboardMonitor.ts
│   │   │
│   │   ├── database/
│   │   │   ├── sqlite-client.ts
│   │   │   ├── migrations.ts
│   │   │   └── encryption.ts
│   │   │
│   │   ├── sanitization/
│   │   │   ├── SanitizationPipeline.ts
│   │   │   ├── BehaviorVectorizer.ts
│   │   │   └── ml-model.onnx (TinyML sanitizer)
│   │   │
│   │   ├── sync/
│   │   │   ├── CloudSyncClient.ts
│   │   │   ├── encryption.ts
│   │   │   └── conflict-resolution.ts
│   │   │
│   │   ├── adaptive-engine/
│   │   │   ├── PacingController.ts
│   │   │   ├── HintManager.ts
│   │   │   └── ComprehensionDetector.ts
│   │   │
│   │   └── offline-support/
│   │       ├── SyncQueue.ts
│   │       └── LocalFallback.ts
│   │
│   └── utils/
│       ├── logger.ts
│       ├── crypto.ts
│       └── config-loader.ts
│
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### 4.2 Data Flow (Edge)

```
┌──────────────────────────────────────┐
│      Student Using App               │
│  (typing, clicking, switching apps)  │
└────────────────┬─────────────────────┘
                 │
        ┌────────▼────────┐
        │ Activity        │
        │ Collectors      │
        │                 │
        │ - Window        │
        │   Tracker       │
        │ - Keyboard      │
        │   Monitor       │
        │ - Focus events  │
        └────────┬────────┘
                 │
                 ├─► Raw Data (never leaves device)
                 │   └─ SQLite (encrypted)
                 │
        ┌────────▼──────────┐
        │ Sanitization      │
        │ Pipeline          │
        │                   │
        │ Raw data →        │
        │ Behavior Vectors  │
        │ (on-device ML)    │
        └────────┬──────────┘
                 │
                 │ Synthesized Vectors:
                 │ - Engagement Index
                 │ - Distraction Index
                 │ - Concept Gaps
                 │ - Productivity Window
                 │
        ┌────────▼──────────┐
        │ Adaptive Engine   │
        │                   │
        │ - Pacing Control  │
        │ - Hint Triggers   │
        │ - Difficulty Adj  │
        └────────┬──────────┘
                 │
                 ├─► Real-time Feedback
                 │   (shown to student)
                 │
        ┌────────▼──────────┐
        │ Sync Client       │
        │ (Periodic)        │
        │                   │
        │ - Encrypt vectors │
        │ - Compress        │
        │ - Queue for send  │
        │ - Delete raw data │
        └────────┬──────────┘
                 │
        ┌────────▼──────────┐
        │ Cloud Upload      │
        │ (hourly / on-idle)│
        │                   │
        │ POST /sync        │
        │ {encrypted_payload}
        └────────────────────┘
```

---

## 5. Event-Driven Communication

### 5.1 Event Topics & Subscriptions

| Topic | Publisher | Subscribers | Payload | Frequency |
|-------|-----------|-------------|---------|-----------|
| `student_rep.behavioral_sync` | Student Rep (Edge) | Teacher Asst, PRM | Sanitized behavior vectors + session metadata | Hourly / on-demand |
| `student_rep.concept_struggle` | Student Rep (Edge) | Teacher Asst | Concept ID, student ID, struggle type, timestamp | Real-time |
| `student_rep.milestone_achieved` | Student Rep (Edge) | Teacher Asst, PRM | Student ID, concept ID, mastery level, achievement timestamp | Real-time |
| `teacher_asst.curriculum_published` | Teacher Asst | School ERP, Student Rep Sync | Curriculum ID, required materials, lesson objectives | On publish |
| `teacher_asst.grade_finalized` | Teacher Asst | PRM, Cloud DB | Student ID, assignment ID, grade, teacher approval status | On grade submit |
| `teacher_asst.classroom_insight` | Teacher Asst | PRM, Reporting Dashboard | Class ID, insight type, confidence, recommended action | Daily |
| `prm.parent_outreach_drafted` | PRM Agent | Teacher approval queue | Parent ID, student ID, email body, reason flag | On trigger |
| `prm.communication_logged` | PRM Agent | Audit service, compliance dashboard | Communication ID, type, parties, timestamp | On send |
| `school_erp.teacher_absence` | School ERP | Teacher Asst, PRM, Staff Allocation | Teacher ID, absence date range, reason | On submission |
| `school_erp.inventory_low` | School ERP | Procurement team | Item ID, current qty, reorder level, recommended qty | On threshold |
| `school_erp.sub_assigned` | School ERP | Teacher, Sub, Curriculum Service | Sub ID, assignment details, lesson plan attachment | On assignment |

### 5.2 Event Schema Example

```json
{
  "event_type": "student_rep.behavioral_sync",
  "event_id": "uuid-v4",
  "source": "student-rep-edge-instance-001",
  "timestamp": "2026-03-17T14:30:00Z",
  "version": "1.0",
  "encryption": {
    "algorithm": "AES-256-GCM",
    "key_id": "key-rotation-2026-03-01",
    "iv": "base64-encoded-iv"
  },
  "payload": {
    "student_id": "anonymized-hash", // Never raw UUID
    "session_id": "uuid-v4",
    "sanitized_vectors": {
      "engagement_index": 75.5,
      "distraction_index": 22.3,
      "time_on_task_seconds": 1840,
      "concept_gaps": ["CCSS.MATH.3.NF.A.1"],
      "productivity_window": {
        "start_hour": 9,
        "end_hour": 11,
        "confidence": 0.78
      }
    },
    "session_metadata": {
      "device_id": "device-hash",
      "curriculum_unit_id": "unit-xyz",
      "assignments_completed": 3
    }
  },
  "signature": "RSA-SHA256-signature-for-integrity"
}
```

---

## 6. Data Security & Encryption

### 6.1 Encryption Strategy

| Data Location | At-Rest Encryption | In-Transit Encryption | Key Rotation |
|---------------|-------------------|----------------------|--------------|
| Edge Device (SQLite) | AES-256-CBC + PBKDF2 salt | N/A (local only) | On app update or 90 days |
| Cloud Database (PostgreSQL) | AES-256-GCM (native) | N/A (within VPC) | Every 30 days |
| Event Bus (Kafka) | Optional (transparent) | TLS 1.3 | Every 90 days |
| In-Transit (Edge → Cloud) | N/A | TLS 1.3 + message-level AES-256-GCM | Every 90 days |
| Vault (Secrets) | Shamir Secret Sharing | TLS 1.3 | Every 7 days (automatic) |

### 6.2 Key Management

```
┌─────────────────────────────────────┐
│   HashiCorp Vault (HA Setup)        │
├─────────────────────────────────────┤
│                                     │
│ Secrets Stored:                     │
│ - Database credentials              │
│ - API keys (Claude, AWS, etc.)      │
│ - Encryption keys                   │
│ - OAuth secrets                     │
│ - TLS certificates                  │
│                                     │
│ Access Control:                     │
│ - RBAC per agent/service            │
│ - Audit logging                     │
│ - TTL-based leases                  │
│                                     │
│ Rotation:                           │
│ - Automatic every 90 days           │
│ - Emergency rotation on demand      │
└─────────────────────────────────────┘
```

### 6.3 Sensitive Data Classification

| Data Type | Classification | Retention | Encryption | Access |
|-----------|----------------|-----------|-----------|--------|
| Student raw keystrokes/activity | HIGHLY SENSITIVE | 7 days (then purged) | AES-256 | Edge only |
| Synthesized behavior vectors | SENSITIVE | Until graduation + 1 year | AES-256 | Teacher Asst, PRM |
| Grades & assignments | SENSITIVE | Until graduation + 7 years | AES-256 | Teacher, Parent, Student |
| Parent communication | SENSITIVE | Until graduation + 3 years | AES-256 | Parent, Teacher |
| Aggregate classroom insights | INTERNAL | Until end of school year + 2 years | AES-256 | Teacher, Admin |
| Teacher profile & schedule | INTERNAL | Active employment + 1 year | TLS in transit | Admin, Teacher |
| Inventory & ERP data | INTERNAL | Current fiscal year + 1 year | Optional | Admin, Staff |

---

## 7. Deployment Architecture

### 7.1 Infrastructure as Code (Terraform)

```hcl
# Kubernetes Cluster
resource "aws_eks_cluster" "nicodemus" {
  name            = "nicodemus-prod"
  role_arn        = aws_iam_role.eks_cluster.arn
  vpc_config {
    subnet_ids = aws_subnet.nicodemus[*].id
  }
}

# Kafka Cluster (via Helm)
resource "helm_release" "kafka" {
  name       = "kafka"
  repository = "https://charts.bitnami.com/bitnami"
  chart      = "kafka"
  namespace  = "nicodemus"

  set {
    name  = "replicaCount"
    value = "3"
  }

  set {
    name  = "persistence.enabled"
    value = "true"
  }
}

# PostgreSQL (AWS RDS)
resource "aws_db_instance" "nicodemus_db" {
  identifier     = "nicodemus-prod-db"
  engine         = "postgres"
  engine_version = "14.5"
  instance_class = "db.r6i.xlarge"

  allocated_storage    = "500"
  storage_encrypted    = true
  deletion_protection  = true
  backup_retention_period = "30"
  multi_az            = true
}

# Redis (AWS ElastiCache)
resource "aws_elasticache_cluster" "nicodemus_cache" {
  cluster_id           = "nicodemus-cache"
  engine               = "redis"
  node_type            = "cache.r6g.xlarge"
  num_cache_nodes      = 3
  parameter_group_name = "default.redis7"
  engine_version       = "7.0"
}
```

### 7.2 CI/CD Pipeline (GitHub Actions)

```yaml
name: Nicodemus CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run unit tests
        run: make test
      - name: Run security scan
        run: make security-scan
      - name: Run compliance checks
        run: make compliance-check

  build:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v3
      - name: Build Docker images
        run: make docker-build
      - name: Push to ECR
        run: make docker-push
      - name: Update Kubernetes manifests
        run: make update-k8s-manifests

  deploy:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to staging
        run: kubectl apply -f k8s/staging/ --kubeconfig=${{ secrets.KUBE_CONFIG_STAGING }}
      - name: Run smoke tests
        run: make smoke-tests-staging
      - name: Deploy to production
        run: kubectl apply -f k8s/production/ --kubeconfig=${{ secrets.KUBE_CONFIG_PROD }}
      - name: Health check
        run: make health-check-prod
```

---

## 8. Monitoring & Observability

### 8.1 Metrics (Prometheus)

```yaml
# Agent Health
nicodemus_agent_health{agent="teacher_assistant", status="healthy"} 1
nicodemus_agent_events_processed_total{agent="teacher_assistant"} 15000
nicodemus_agent_event_latency_seconds{agent="teacher_assistant", quantile="0.95"} 0.45

# Event Bus
nicodemus_kafka_messages_published_total{topic="student_rep.behavioral_sync"} 850000
nicodemus_kafka_consumer_lag{topic="teacher_asst.curriculum_published", consumer_group="prm_agent"} 52

# Database
nicodemus_db_connection_pool_usage{instance="primary"} 45
nicodemus_db_query_latency_seconds{query="fetch_student_progress", quantile="0.99"} 0.18

# Edge Sync
nicodemus_edge_sync_success_rate{device_type="electron_windows"} 0.997
nicodemus_edge_sync_payload_size_bytes{device_type="electron_macos"} 125000
```

### 8.2 Logging (ELK Stack)

```json
{
  "timestamp": "2026-03-17T14:30:00.000Z",
  "level": "INFO",
  "service": "teacher-assistant",
  "pod_name": "teacher-assistant-0",
  "namespace": "nicodemus",
  "event_type": "curriculum_generated",
  "event_id": "event-uuid-xyz",
  "user_id": "teacher-id-hash",
  "school_id": "school-id-hash",
  "message": "Generated differentiated lesson plan for grade 3 math",
  "metadata": {
    "curriculum_id": "curriculum-uuid",
    "variants_generated": 3,
    "generation_time_ms": 1250,
    "model_used": "claude-3.5-sonnet"
  },
  "trace_id": "trace-uuid-abc"
}
```

---

## 9. Disaster Recovery & High Availability

### 9.1 RTO/RPO Targets

| Component | RTO | RPO |
|-----------|-----|-----|
| Kubernetes Cluster | 30 minutes | 0 (auto-failover) |
| PostgreSQL | 15 minutes | 1 minute (automated backups) |
| Kafka | 10 minutes | 0 (replicated) |
| Edge Sync Endpoint | 5 minutes | 0 (queued on edge) |

### 9.2 Backup Strategy

```
Daily Backup Schedule:
├── 02:00 UTC: PostgreSQL full backup → S3 (with encryption)
├── 03:00 UTC: Kafka cluster snapshot → S3
├── 04:00 UTC: Elasticsearch cluster snapshot → S3
├── 05:00 UTC: Verify all backups (integrity check)
└── Weekly: Off-site replication to secondary region

Recovery Procedures:
├── Database Corruption: Point-in-time restore (PiTR) to 5-min granularity
├── Regional Failure: Failover to secondary region (RDS Multi-AZ + Route 53)
├── Kafka Data Loss: Restore from snapshot, replay events from edge queues
└── Complete Cluster Failure: Kubernetes backup (etcd) + IaC redeploy
```

---

## 10. Scalability Considerations

### 10.1 Horizontal Scaling

| Component | Min Replicas | Max Replicas | Scale Trigger |
|-----------|--------------|--------------|---------------|
| Teacher Assistant Agent | 2 | 10 | CPU >70% |
| Student Rep Sync | 1 | 5 | Request latency >500ms |
| PRM Agent | 1 | 4 | Message queue depth >1000 |
| Kafka Brokers | 3 | 9 | Disk usage >75% |
| PostgreSQL | N/A | N/A | Vertical scaling only |
| Redis Cluster | 3 | 6 | Eviction rate >5% |

### 10.2 Projected Capacity (Year 1)

```
Target: 100 schools, 50,000 students, 5,000 teachers

Kafka:
├── Throughput: ~50k messages/minute
├── Storage: ~500GB (7-day retention)
└── Brokers: 3-5 nodes (t3.large)

PostgreSQL:
├── Size: ~100GB
├── Connections: ~200 (pooled)
└── Instance: db.r6i.xlarge (2 vCPU, 16GB RAM)

Redis Cache:
├── Hot data: ~2GB
├── Nodes: 3 (cache.r6g.xlarge)
└── Hit rate target: >90%

Edge Devices:
├── Concurrent syncs: ~5,000
├── Sync endpoint load: 10 req/sec
└── Payload size: ~100KB per sync
```

---

## Appendix A: Technology Stack Summary

```yaml
Cloud Infrastructure:
  Cloud Provider: AWS / GCP / Azure (TBD)
  Orchestration: Kubernetes (EKS/GKE/AKS)
  Infrastructure as Code: Terraform

Core Services:
  Message Broker: Apache Kafka (3+ nodes)
  Primary Database: PostgreSQL 14+ (HA)
  Cache: Redis 7+ (cluster)
  Secret Management: HashiCorp Vault

Microservices:
  Language: Python 3.11+ (primary), Go (optional)
  Framework: FastAPI (APIs), Pydantic (schemas)
  Agent Framework: Custom async event-driven base class

Data & Analytics:
  Data Warehouse: Snowflake / BigQuery (Phase 2)
  Logging: Elasticsearch + Kibana
  Metrics: Prometheus + Grafana
  Tracing: Jaeger / Datadog

Edge Client:
  Framework: Electron + Vue.js 3
  Language: TypeScript
  Local Database: SQLite with encryption
  ML Model: ONNX Runtime (TinyML)

Security & Compliance:
  Encryption: AES-256 (at rest), TLS 1.3 (in transit)
  Authentication: OAuth 2.0 + SAML
  Authorization: RBAC (Casbin)
  Audit Logging: Elasticsearch
  Compliance: FERPA, COPPA, GDPR

CI/CD & DevOps:
  Repository: GitHub
  CI/CD: GitHub Actions
  Container Registry: AWS ECR / GCP Artifact Registry
  Configuration Management: Helm (Kubernetes)
```

---

**Document Version:** 1.0
**Last Updated:** 2026-03-17
**Next Review:** After cloud provider finalization
