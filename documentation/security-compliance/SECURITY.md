# Nicodemus Security & Compliance Framework
**Enterprise Educational AI Suite - Security Architecture & Regulatory Alignment**

---

## 1. Executive Security Summary

Nicodemus implements **Privacy-by-Design** with multiple layers of protection for one of the most sensitive data types: student behavioral and academic information. This document outlines:

1. **Data Security:** Encryption, key management, and data flow protection
2. **Compliance Frameworks:** FERPA, COPPA, GDPR, CCPA alignment
3. **Access Control:** Role-based access, authentication, authorization
4. **Incident Response:** Detection, reporting, and remediation protocols
5. **Continuous Security:** Monitoring, auditing, and vulnerability management

---

## 2. Regulatory Compliance

### 2.1 FERPA (Family Educational Rights and Privacy Act)

**Applicability:** All U.S. school districts using Nicodemus

**Key Requirements:**
- Students have right to access their records
- Parents (custodians) have right to access student records until age 18
- Records cannot be disclosed without written consent (with exceptions)
- Schools must maintain audit logs of access
- Data breach notification required

**Nicodemus Implementation:**

| FERPA Requirement | Implementation |
|------------------|-----------------|
| Student data access rights | Portal: students/parents can download all their data in machine-readable format (JSON) |
| Parental consent management | Consent module: schools manage permissions per student per parent (divorced parents, guardians) |
| Third-party disclosure | API: AI agents are "school officials" under FERPA; logs capture all agent access to student data |
| Audit trails | All access logged with user ID, timestamp, data accessed, reason code |
| Data deletion upon request | Automated scrubbing: parental request triggers purge of raw/derived data (except legally mandated records) |
| Secure transport | TLS 1.3 for all data in motion |
| Minimal data retention | Raw behavioral data: 7 days; derived vectors: 3+ years (configurable); logs: 7 years |

**FERPA Compliance Checklist:**
- [ ] Privacy notice provided at school enrollment
- [ ] Parent opt-out mechanism for non-critical tracking
- [ ] Student access portal live and tested
- [ ] Audit logs stored in Elasticsearch with 7+ year retention
- [ ] Data deletion workflow documented and tested
- [ ] Third-party (agent) access restrictions enforced
- [ ] Breach notification plan documented and tested
- [ ] Annual FERPA training for school administrators

---

### 2.2 COPPA (Children's Online Privacy Protection Act)

**Applicability:** Any student under age 13

**Key Requirements:**
- Verifiable parental consent before collecting personal information
- Clear, understandable privacy notice
- Parental access/deletion rights
- No behavioral tracking without consent
- No sale of student data
- Reasonable security measures

**Nicodemus Implementation:**

| COPPA Requirement | Implementation |
|------------------|-----------------|
| Parental consent | Parent-verified email + SMS double-opt-in before age 13 data collection |
| Privacy notice | In-app privacy notice: plain language, <8th grade reading level, visual icons |
| Behavioral tracking | Edge-based tracking only; no data leaves device without parent consent |
| Data sale prohibition | Contract explicitly prohibits all data monetization |
| Parental access | Parent portal: can download child's data, see all collection events |
| Parental deletion | Parent can request permanent deletion; marked as "COPPA delete" in logs (not recoverable) |
| Reasonable security | AES-256, TLS 1.3, encryption key rotation, access controls |
| Vendor compliance | All third-party vendors (cloud, AI models) contractually bound to COPPA |

**COPPA Compliance Checklist:**
- [ ] Age verification on enrollment (for <13 students)
- [ ] Parental consent system tested with minor cohort
- [ ] Privacy notice in child-friendly language (A/B tested)
- [ ] Parental portal tested for data download
- [ ] Deletion workflow tested (especially for <13 data)
- [ ] Contract riders added to all vendor agreements
- [ ] Annual COPPA compliance audit

---

### 2.3 GDPR (General Data Protection Regulation)

**Applicability:** EU schools, EU students in international schools, any EU data processing

**Key Requirements:**
- Lawful basis for processing (consent, legal obligation, etc.)
- Data minimization (collect only what's necessary)
- Purpose limitation (use data only for stated purpose)
- Data subject rights (access, rectification, erasure, portability, objection)
- Data breach notification within 72 hours
- Data Protection Impact Assessment (DPIA)
- Data Processing Agreement (DPA) with vendors

**Nicodemus Implementation:**

| GDPR Requirement | Implementation |
|------------------|-----------------|
| Lawful basis | Consent (schools collect from parents/students) + contract (school-to-Nicodemus DPA) |
| Data minimization | Only collect behavioral metrics; never student names/IDs in edge data; anonymized in cloud |
| Purpose limitation | Contract specifies use for "educational support only"; no marketing/profiling |
| Data subject rights | Subject access request (SAR) portal; 30-day response SLA |
| DPIA | Completed before deployment; updated annually |
| DPA in place | Standard template; includes data location, processing restrictions, sub-processors |
| Data breach notification | <72 hour notice to school + Data Protection Authority (if applicable) |
| Privacy by design | Edge-first architecture ensures PII stays local |

**GDPR Compliance Checklist:**
- [ ] DPA signed with school + Nicodemus
- [ ] DPIA completed and documented
- [ ] Subject access request (SAR) workflow tested
- [ ] Data breach response plan includes 72-hour notification
- [ ] Data sub-processor list documented (Claude API, AWS, etc.)
- [ ] Cross-border data transfer compliance verified (if applicable)
- [ ] Annual GDPR compliance audit + legal review
- [ ] Privacy notice updated to GDPR standards

---

### 2.4 CCPA & CPRA (California Privacy Rights Acts)

**Applicability:** California schools, California students

**Key Requirements:**
- "Consumer" rights (which include students/parents)
- Disclosure of what data is collected
- Opt-out rights for data sale (though we don't sell)
- Right to know, delete, correct, port
- Non-discrimination for exercising rights

**Nicodemus Implementation:**

| CCPA/CPRA Requirement | Implementation |
|------|---|
| Consumer notice | Privacy policy includes CCPA-specific section |
| Opt-out mechanisms | Students/parents can opt-out of behavioral tracking (fallback: manual tutoring mode) |
| Data access/portability | Data download portal (JSON export) available within 45 days |
| Deletion requests | Purge script executed within 45 days; certified by compliance officer |
| Correction requests | Parents can dispute data through portal; manual review + correction |
| Non-discrimination | No price/service differences for exercising rights |

**CCPA/CPRA Compliance Checklist:**
- [ ] California privacy notice created
- [ ] Opt-out mechanism functional
- [ ] Data access SLA (45 days) enforced
- [ ] Deletion SLA (45 days) enforced
- [ ] Annual CCPA/CPRA audit

---

## 3. Data Security Architecture

### 3.1 Encryption Standards

#### At-Rest Encryption

**Edge Device (Student Laptop/Tablet)**
- Algorithm: AES-256-CBC
- Key Derivation: PBKDF2 (100,000 iterations, SHA-256 salt)
- Master Key: Device-unique, derived from student identity + OS keychain
- Scope: All data in SQLite (raw behavioral data, synced vectors, curriculum)
- Rotation: On app update or every 90 days (automatic)

```python
# Example: Edge encryption
import cryptography.fernet

def encrypt_local_data(plaintext: str, device_key: bytes) -> str:
    fernet = Fernet(device_key)
    ciphertext = fernet.encrypt(plaintext.encode())
    return ciphertext.decode()

def decrypt_local_data(ciphertext: str, device_key: bytes) -> str:
    fernet = Fernet(device_key)
    plaintext = fernet.decrypt(ciphertext.encode())
    return plaintext.decode()
```

**Cloud Database (PostgreSQL)**
- Algorithm: AES-256-GCM (pgcrypto extension)
- Key Storage: HashiCorp Vault
- Key Rotation: Every 30 days (automatic, no downtime)
- Scope: Sensitive columns marked with `encrypted: true` in schema
- Transparent Encryption: Built into PostgreSQL (TDE-like layer)

```sql
-- Example: Cloud encryption at column level
CREATE TABLE student_progress (
    id UUID PRIMARY KEY,
    student_id UUID NOT NULL ENCRYPTED,
    engagement_index FLOAT ENCRYPTED,
    concept_gaps TEXT[] ENCRYPTED,
    created_at TIMESTAMP NOT NULL
);
```

**Vault Secret Storage**
- Algorithm: Shamir Secret Sharing (3-of-5 threshold)
- Key Rotation: Every 7 days (automatic)
- Access Control: RBAC per agent/service
- Audit: Every access logged

#### In-Transit Encryption

**Edge ↔ Cloud Communication**
- Protocol: TLS 1.3 (minimum)
- Certificate: Wildcard cert for `*.nicodemus.edu` (example domain)
- Certificate Pinning: Public key pinning in Electron app
- Message-Level: AES-256-GCM envelope (extra layer)
- Payload Authentication: HMAC-SHA256 signature

```
Edge Sync Payload Structure:
┌─────────────────────────────────────────┐
│ TLS 1.3 Encrypted Channel               │
├─────────────────────────────────────────┤
│  {                                      │
│    "encrypted_payload": "...",  (AES-256-GCM)
│    "iv": "...",                         │
│    "signature": "..."          (HMAC)   │
│  }                                      │
└─────────────────────────────────────────┘
```

**Internal (Cloud-to-Cloud)**
- Kafka → TLS 1.3 between brokers
- PostgreSQL → Encrypted connections (SSL/TLS enforced)
- Redis → TLS 1.3 + AUTH password
- Vault → TLS 1.3 (mutual TLS)

### 3.2 Key Management & Rotation

**Key Hierarchy**

```
┌─────────────────────────────────────┐
│ Master Key (Vault, Shamir Split)    │
└────────────────┬────────────────────┘
                 │
      ┌──────────┼──────────┐
      │          │          │
 ┌────▼───┐ ┌───▼────┐ ┌───▼────┐
 │Database│ │ Events │ │Secrets │
 │ Key    │ │ Key    │ │ Key    │
 └────┬───┘ └───┬────┘ └───┬────┘
      │         │          │
   [90d]    [30d]      [7d]
```

**Rotation Schedule**

```
┌─────────────────────────────────────────────────────────────┐
│              Key Rotation Schedule                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Master Key:                                                  │
│ └─ Manual rotation (emergency only) + Shamir re-split      │
│                                                              │
│ Database Encryption Key (AES-256):                          │
│ └─ Every 30 days, automatic, no downtime (dual-key period) │
│                                                              │
│ Event/Message Keys (TLS certificates):                      │
│ └─ Every 90 days, automatic, 30-day pre-issuance overlap  │
│                                                              │
│ Vault Transit Encryption Key:                               │
│ └─ Every 7 days, automatic, transparent to services        │
│                                                              │
│ Incident-Triggered Rotation:                                │
│ └─ On suspected compromise: IMMEDIATE (30-min SLA)         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Key Rotation Process**

```python
# Example: Key rotation workflow
def rotate_database_key():
    """
    1. Generate new key in Vault
    2. Double-key period: old + new keys active
    3. Gradually re-encrypt data with new key
    4. Deactivate old key after grace period
    """
    old_key = vault.get_current_key('db-encryption')
    new_key = vault.generate_key('db-encryption')

    # Dual-key period (24 hours)
    vault.set_active_keys(['db-encryption'], [old_key, new_key])

    # Batch re-encryption (low-priority background job)
    reencrypt_job = schedule_reencryption_task(old_key, new_key)

    # Monitor job progress
    while reencrypt_job.progress < 100:
        log_progress(reencrypt_job)
        sleep(300)  # Check every 5 minutes

    # After re-encryption complete (SLA: 24 hours), deactivate old key
    vault.deactivate_key(old_key)
```

---

## 4. Access Control & Authentication

### 4.1 Authentication

**Cloud Services (Web/API)**
- Primary: OAuth 2.0 (Google, Microsoft, Clever for schools)
- Enterprise: SAML 2.0 (for large districts)
- MFA: TOTP (Google Authenticator) or FIDO2 (required for admins)
- Session: JWT tokens (15-minute expiry, refresh tokens)

**Edge Device (Electron App)**
- Local: Device login → stored fingerprint (biometric or PIN)
- Cloud Sync: OAuth token (via browser redirect)
- Offline: Cached OAuth token with fallback to local auth

**Service-to-Service (Internal)**
- Method: Mutual TLS (mTLS) + service account tokens
- Token Lifetime: 1 hour (auto-refreshed)
- Revocation: Real-time (via Vault webhook)

### 4.2 Authorization (RBAC)

**Role Definitions**

```yaml
Roles:

  STUDENT:
    Permissions:
      - view:own_assignments
      - view:own_grades
      - view:own_progress
      - submit:assignment
      - request:help
      - download:own_data (GDPR/FERPA)
    Constraints:
      - Can only view own data
      - Cannot delete submissions

  PARENT:
    Permissions:
      - view:child_progress_summary
      - view:child_grades
      - view:communications (parent-teacher)
      - request:parent_conference
      - download:child_data (GDPR/FERPA)
      - submit:privacy_deletion_request
    Constraints:
      - Can only view linked children
      - Cannot see raw behavioral data
      - Cannot modify grades/assignments

  TEACHER:
    Permissions:
      - create:lesson_plan
      - view:class_roster
      - view:aggregated_student_data (sanitized)
      - submit:grades
      - create:assignment
      - send:parent_communication (draft, teacher-approved)
      - view:classroom_insights
      - request:curriculum_materials
    Constraints:
      - Can only view students in own roster
      - Cannot access other teacher's students
      - Grades must be submitted by deadline (configurable)

  ADMIN:
    Permissions:
      - all (unrestricted)
      - view:audit_logs
      - manage:users
      - manage:school_settings
      - approve:curriculum
      - generate:compliance_reports
    Constraints:
      - Limited number of admins (per school)
      - All actions logged
      - Cannot see raw student behavioral data (privacy breach protection)

  AGENT_TEACHER_ASSISTANT:
    Permissions:
      - read:teacher_roster (restricted to school)
      - read:sanitized_student_data (limited fields)
      - read:curriculum
      - write:lesson_plans
      - write:grade_suggestions
      - publish:classroom_insights
    Constraints:
      - Cannot modify grades (suggestions only)
      - Cannot access raw behavioral data
      - Cannot send communications directly
      - Automatic throttling (rate limits per agent)

  AGENT_STUDENT_REP:
    Permissions:
      - read:local_curriculum
      - write:local_behavior_data (edge only)
      - read:hint_library
      - publish:concept_struggle (local trigger)
      - publish:milestone_achieved
    Constraints:
      - Edge-only (no cloud access)
      - Cannot read other student data
      - Automatic throttling

  AGENT_PRM:
    Permissions:
      - read:aggregated_student_health (anonymized)
      - read:grade_data
      - read:communication_history
      - write:communication_draft
      - publish:parent_outreach_request
      - log:communication_event
    Constraints:
      - Cannot send communications (requires teacher approval)
      - Cannot modify student data
      - Rate limits on email generation
```

### 4.3 Example: RBAC Enforcement

```python
# Example: RBAC check in Teacher Assistant Agent
from nicodemus.auth import require_permission

class TeacherAssistantAgent:
    @require_permission('read:sanitized_student_data')
    async def get_classroom_insights(self, teacher_id: str, class_id: str):
        """
        Permission check:
        1. Verify teacher_id has role TEACHER
        2. Verify teacher is assigned to class_id
        3. Verify teacher hasn't exceeded daily quota
        4. Return only sanitized data (no raw behavioral data)
        """
        teacher = await db.get_teacher(teacher_id)
        assert teacher.role == Role.TEACHER
        assert class_id in teacher.class_roster

        # Fetch sanitized vectors only
        data = await db.query_sanitized_vectors(
            class_id=class_id,
            fields=['engagement_index', 'concept_gaps']  # whitelist
        )
        return data
```

---

## 5. Incident Response Plan

### 5.1 Data Breach Protocol

**Severity Levels:**

| Level | Impact | Response Time | Notification |
|-------|--------|---------------|--------------|
| CRITICAL | >1000 records, includes PII | <1 hour | Parents + FERPA + CCPA within 24h |
| HIGH | 100-1000 records, behavioral data | <4 hours | School + parents within 48h |
| MEDIUM | <100 records, anonymized data | <24 hours | School + audit log |
| LOW | 0 actual breach (e.g., failed auth) | <48 hours | Incident log only |

**Response Workflow:**

```
INCIDENT DETECTED
        │
        ▼
┌─────────────────────────────┐
│ Immediate Actions (<1h)     │
├─────────────────────────────┤
│ 1. Isolate affected systems │
│ 2. Preserve logs            │
│ 3. Assess scope (how many?) │
│ 4. Notify security team     │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│ Analysis (1-4 hours)        │
├─────────────────────────────┤
│ 1. Root cause analysis      │
│ 2. Identify exposed data    │
│ 3. Determine severity level │
│ 4. Check if PII exposed     │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│ Notification (<24 hours)    │
├─────────────────────────────┤
│ 1. Notify school (Principal)
│ 2. Notify parents if needed │
│ 3. File FERPA incident form │
│ 4. Report to authorities if │
│    required (CCPA, GDPR)    │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│ Remediation (ongoing)       │
├─────────────────────────────┤
│ 1. Patch vulnerability      │
│ 2. Deploy fixes             │
│ 3. Re-encrypt if necessary  │
│ 4. Monitor for recurrence   │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│ Post-Incident Review (1w)   │
├─────────────────────────────┤
│ 1. Document lessons learned │
│ 2. Update security policies │
│ 3. Improve monitoring       │
│ 4. Share findings (anonymized) │
└─────────────────────────────┘
```

### 5.2 Breach Notification Templates

**Parent Email (CRITICAL breach):**

```
Subject: Important Security Update Regarding [Student Name]'s Account

Dear [Parent Name],

We are writing to inform you of a security incident that may have affected your child's
educational records. Out of an abundance of caution, we are notifying all families.

What Happened:
[Plain-language explanation of what was accessed]

What Information Was Affected:
- [List: grades, assignments, behavioral data, contact info, etc.]

What We're Doing:
- We have secured the affected systems
- We are monitoring for unauthorized access
- We are enhancing our security measures
- We are resetting [authentication method]

What You Can Do:
- Monitor your child's account for unauthorized activity
- Contact us with questions: [contact info]
- Change your password at: [portal link]

Timeline:
- [Date/Time]: Incident detected
- [Date/Time]: Investigation completed
- [Date/Time]: Remediation underway

We take the security of your child's data very seriously...

[Signature]
```

---

## 6. Vulnerability Management

### 6.1 Security Scanning

**Continuous Vulnerability Scanning:**

```yaml
# Automated scanning schedule (CI/CD integrated)

Daily Scans:
  - SAST (Static Application Security Testing)
    Tool: SonarQube + Semgrep
    Target: All code changes
    Action: Fail build if critical finding

  - Dependency Scanning
    Tool: Snyk + Dependabot
    Target: All dependencies (Python, Node.js, system)
    Action: Auto-PR for patches, notify if critical

Weekly Scans:
  - DAST (Dynamic Application Security Testing)
    Tool: OWASP ZAP + Burp Suite
    Target: Staging environment
    Action: Report to security team

  - Container Image Scanning
    Tool: Trivy + ECR native scanning
    Target: All images in registry
    Action: Quarantine if critical CVE

Monthly Scans:
  - Penetration Testing
    Tool: Internal + contracted firm (quarterly)
    Target: Production-like environment
    Action: Remediate findings within SLA

  - Compliance Scan
    Tool: Custom audit script
    Target: Full system
    Action: Generate compliance report
```

### 6.2 Patch Management

| Component | Patch Type | Response Time | Test SLA |
|-----------|-----------|---------------|----------|
| Critical Vulnerability | Emergency | <24 hours | <4 hours |
| High Vulnerability | Priority | <7 days | <2 days |
| Medium Vulnerability | Standard | <30 days | <5 days |
| Low Vulnerability | Routine | <90 days | <10 days |

---

## 7. Compliance Audit & Reporting

### 7.1 Annual Compliance Audit Schedule

```
Q1 (Jan-Mar):
├─ FERPA compliance audit
├─ User access review (RBAC)
├─ Encryption key audit
└─ Incident log review

Q2 (Apr-Jun):
├─ COPPA compliance audit (if <13 students)
├─ Password policy audit
├─ Penetration test (external firm)
└─ Backup/recovery drill

Q3 (Jul-Sep):
├─ GDPR/CCPA compliance audit (if applicable)
├─ Data retention policy review
├─ Vendor security assessment
└─ Update incident response plan

Q4 (Oct-Dec):
├─ Annual security training completion
├─ Vulnerability remediation review
├─ Compliance report generation
└─ Update security documentation
```

### 7.2 Compliance Report Template

```markdown
# Nicodemus Security & Compliance Report
**[School Name] - [Year]**

## Executive Summary
- Overall risk rating: [Green/Yellow/Red]
- Incidents: [N] (severity breakdown)
- Compliance gaps: [N] (resolved: X, pending: Y)

## FERPA Compliance
- ✅ Audit logging: All access logged
- ✅ Data deletion requests: Average 5 days (SLA: 30)
- ⚠️ Privacy notice: Updated Q2 2026
- Status: **COMPLIANT**

## COPPA Compliance (if applicable)
- ✅ Parental consent: 1,200 parents verified
- ✅ Data access: Portal tested monthly
- ✅ Deletion process: Tested successfully
- Status: **COMPLIANT**

## Encryption & Key Management
- ✅ AES-256 at rest: 100% compliance
- ✅ TLS 1.3 in transit: 100% compliance
- ✅ Key rotation: 4 rotations completed (on schedule)
- Status: **COMPLIANT**

## Vulnerabilities & Incidents
- Critical: 0 (SLA: <24h remediation)
- High: 1 (resolved in 3 days)
- Medium: 3 (all resolved)
- Low: 8 (6 resolved, 2 in progress)

## Recommendations
1. [Include any findings from audits/penetration tests]
2. [Process improvements identified]
3. [Training/awareness updates needed]

---
*Report generated: [Date]*
*Certification: [Compliance Officer Signature]*
```

---

## 8. Security Checklist (Pre-Production)

- [ ] TLS 1.3 enabled for all external APIs
- [ ] AES-256 encryption enabled for database
- [ ] Vault initialized with Shamir splitting (3-of-5 threshold)
- [ ] OAuth 2.0 / SAML configured
- [ ] MFA enabled for all admin accounts
- [ ] RBAC rules deployed and tested
- [ ] Audit logging to Elasticsearch configured
- [ ] FERPA privacy notice published
- [ ] COPPA parental consent workflow tested
- [ ] GDPR DPA signed (if applicable)
- [ ] CCPA privacy notice published (if California)
- [ ] Penetration test passed (no critical findings)
- [ ] Incident response plan tested
- [ ] Key rotation process tested
- [ ] Backup/restore tested (no data loss)
- [ ] Security training completed (all staff)
- [ ] Third-party vendor contracts signed + security requirements included
- [ ] Legal review completed
- [ ] Compliance officer sign-off obtained

---

## 9. References & Standards

- **FERPA:** [FERPA Technical Assistance Centers](https://www2.ed.gov/policy/gen/guid/fpco/ferpa/)
- **COPPA:** [FTC COPPA Compliance Guide](https://www.ftc.gov/business-guidance/privacy-security/childrens-privacy)
- **GDPR:** [EU GDPR Official Text](https://gdpr-info.eu/)
- **NIST:** [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- **OWASP:** [OWASP Top 10](https://owasp.org/Top10)
- **CIS Controls:** [CIS Critical Security Controls](https://www.cisecurity.org/cis-controls)

---

**Document Version:** 1.0
**Last Updated:** 2026-03-17
**Certification Status:** Draft (awaiting legal review)
**Next Review Date:** Quarterly
