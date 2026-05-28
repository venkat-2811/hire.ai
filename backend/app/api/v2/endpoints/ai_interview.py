from __future__ import annotations

import logging
import re as _re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, File, Form, UploadFile
from pydantic import BaseModel, Field

from app.api.v2.deps import require_user
from app.auth.clerk import ClerkUser
from app.config import get_settings
from app.services.whisper_service import get_whisper_service
from app.services.db.supabase_service import get_db_admin_service
from app.services.email_service import get_email_service
from app.services.openai_client import get_openai_service
from app.utils.responses import api_error, ok

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai-interview")

# Placeholder: will be implemented next (start/question/adapt-question/response/proctoring/complete/invite)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_iso_dt(value: Any) -> datetime:
    if value is None:
        raise ValueError("missing datetime")
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


def _normalize_questions(raw: Any) -> List[Dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    out: List[Dict[str, Any]] = []
    for q in raw:
        if not isinstance(q, dict):
            continue
        text = q.get("text") or q.get("question_text") or q.get("question")
        qtype = q.get("type") or q.get("question_type") or "technical"
        duration = q.get("duration") or q.get("expected_duration_seconds") or 120
        try:
            duration_i = int(duration)
        except Exception:
            duration_i = 120
        if not isinstance(text, str) or not text.strip():
            continue
        out.append({"text": text.strip(), "type": str(qtype), "duration": duration_i})
    return out


def get_fallback_questions(question_count: int, role: str = "developer", difficulty: str = "medium") -> List[dict]:
    """Professional fallback questions calibrated by difficulty."""
    dur = _DIFFICULTY_DURATION.get(difficulty, 120)
    easy = [
        {"text": f"As a {role}, what fundamental concepts do you rely on most in your day-to-day work? Pick one and explain how it applies to a real project you have worked on.", "type": "technical", "duration": dur},
        {"text": "Walk me through a recent project you contributed to. What was your role, what technologies were involved, and what was the outcome?", "type": "situational", "duration": dur},
        {"text": "When you encounter a technology or framework you have never used before, what is your process for getting productive with it? Give a specific example.", "type": "behavioral", "duration": dur},
        {"text": f"What development tools, IDEs, and workflows do you use as a {role}? How do they help you maintain productivity and code quality?", "type": "technical", "duration": dur},
        {"text": "Describe a situation where you faced a blocker in a team project. How did you identify the issue and work with your team to resolve it?", "type": "behavioral", "duration": dur},
        {"text": "Before submitting your code for review, what steps do you take to ensure quality? How do you handle testing and edge cases?", "type": "technical", "duration": dur},
        {"text": "Tell me about a time you had to deliver work under a tight deadline. What trade-offs did you make, and how did you ensure the most critical requirements were met?", "type": "situational", "duration": dur},
        {"text": "Explain the difference between synchronous and asynchronous programming. In what scenarios would you choose one over the other?", "type": "technical", "duration": dur},
        {"text": "How do you approach debugging when something breaks in your application? Walk me through your thought process with a real example.", "type": "technical", "duration": dur},
        {"text": "Describe how version control fits into your development workflow. How do you handle branching, merging, and resolving conflicts?", "type": "technical", "duration": dur},
    ]
    medium = [
        {"text": f"What is the most technically challenging problem you have solved as a {role}? Walk me through how you diagnosed the issue, what alternatives you considered, and why you chose the approach you did.", "type": "technical", "duration": dur},
        {"text": "Describe a production incident you were involved in. How did you triage the issue, identify the root cause, and implement a fix under pressure?", "type": "situational", "duration": dur},
        {"text": "When designing a new feature or service, how do you evaluate different architectural approaches? What factors influence your decision — scalability, maintainability, time-to-market?", "type": "technical", "duration": dur},
        {"text": "Tell me about a real situation where you had to make a trade-off between shipping fast and maintaining code quality. What did you decide, and what were the consequences?", "type": "situational", "duration": dur},
        {"text": "How do you handle technical disagreements within your team? Give an example where you and a colleague had different approaches and explain how you resolved it.", "type": "behavioral", "duration": dur},
        {"text": f"What performance optimization techniques have you applied in your {role} work? Describe a specific bottleneck you identified and how you measured and improved it.", "type": "technical", "duration": dur},
        {"text": "Describe your approach to code reviews — both when reviewing others' code and when receiving feedback on your own. How do you ensure reviews are constructive and thorough?", "type": "behavioral", "duration": dur},
        {"text": "How do you design APIs that are both performant and easy for other developers to consume? What principles guide your API design decisions?", "type": "technical", "duration": dur},
        {"text": "Tell me about a time you had to refactor a significant piece of legacy code. What was your strategy for ensuring nothing broke during the process?", "type": "situational", "duration": dur},
        {"text": "How do you approach database schema design for a new feature? What considerations do you keep in mind regarding indexing, normalization, and query performance?", "type": "technical", "duration": dur},
    ]
    hard = [
        {"text": f"If you were asked to design a scalable, fault-tolerant system for a high-traffic {role} application from scratch, what architectural patterns would you choose? Walk me through your decisions on load balancing, caching, data partitioning, and failure recovery.", "type": "technical", "duration": dur},
        {"text": "Tell me about a time you led or drove a major technical migration — for example, moving from a monolith to microservices, or migrating databases. What was your strategy, how did you manage risk, and what would you do differently?", "type": "situational", "duration": dur},
        {"text": "How do you design systems for high availability and fault tolerance? Discuss the trade-offs between consistency and availability, and how you would apply them in a real-world distributed system.", "type": "technical", "duration": dur},
        {"text": "Describe a scenario where you had to mentor or upskill other engineers on a complex technical topic. How did you structure your approach, and how did you measure whether the knowledge transfer was effective?", "type": "behavioral", "duration": dur},
        {"text": "What is your approach to capacity planning for a rapidly growing system? How do you identify bottlenecks before they become incidents, and what monitoring and alerting strategies do you rely on?", "type": "technical", "duration": dur},
        {"text": "Tell me about an engineering trade-off you made that had significant business impact. How did you evaluate the options, present them to stakeholders, and justify your recommendation?", "type": "situational", "duration": dur},
        {"text": "How do you drive alignment on technical decisions across multiple teams with competing priorities and different tech stacks? Give a concrete example.", "type": "behavioral", "duration": dur},
        {"text": "Describe how you would design a real-time data pipeline that needs to process millions of events per second with low latency. What technologies and architectural patterns would you use, and how would you handle backpressure and failures?", "type": "technical", "duration": dur},
        {"text": "When optimizing a slow-performing system, what is your systematic approach? Walk me through how you profile, identify hotspots, and validate that your optimizations actually improved things without introducing regressions.", "type": "technical", "duration": dur},
        {"text": "How do you approach security in system design? Discuss authentication, authorization, data encryption, and how you protect against common attack vectors in production systems.", "type": "technical", "duration": dur},
    ]
    pool = {"easy": easy, "medium": medium, "hard": hard}.get(difficulty, medium)
    result = []
    for i in range(question_count):
        result.append(pool[i % len(pool)])
    return result


# Duration in seconds per difficulty level
_DIFFICULTY_DURATION = {"easy": 90, "medium": 120, "hard": 150}


# ---------------------------------------------------------------------------
#  Resume + JD analysis helpers
# ---------------------------------------------------------------------------

def _extract_resume_context(resume_data: Optional[dict], job: Optional[dict] = None) -> str:
    """Build a rich resume summary for the LLM prompt.

    Includes skills, experience with descriptions, education, projects with
    tech stacks, and — when a job dict is provided — an explicit breakdown of
    matched vs missing skills so the LLM can target both.
    """
    if not resume_data or not isinstance(resume_data, dict):
        return "No resume data available."

    parts: List[str] = []

    # --- Skills ---------------------------------------------------------------
    skills_raw = resume_data.get("skills")
    candidate_skills: List[str] = []
    if isinstance(skills_raw, list):
        candidate_skills = [str(s).strip() for s in skills_raw if str(s).strip()][:25]
    if candidate_skills:
        parts.append(f"Skills: {', '.join(candidate_skills)}")

    # --- Matched / Missing skill analysis (when JD is available) -------------
    if job and isinstance(job, dict):
        jd_must = [str(s).strip().lower() for s in (job.get("must_have_skills") or []) if isinstance(s, str)]
        jd_nice = [str(s).strip().lower() for s in (job.get("good_to_have_skills") or []) if isinstance(s, str)]
        cand_lower = {s.lower() for s in candidate_skills}

        matched_must = [s for s in jd_must if s in cand_lower]
        missing_must = [s for s in jd_must if s not in cand_lower]
        matched_nice = [s for s in jd_nice if s in cand_lower]
        missing_nice = [s for s in jd_nice if s not in cand_lower]

        skill_analysis: List[str] = []
        if matched_must:
            skill_analysis.append(f"  Matched must-have: {', '.join(matched_must)}")
        if missing_must:
            skill_analysis.append(f"  Missing must-have: {', '.join(missing_must)}")
        if matched_nice:
            skill_analysis.append(f"  Matched nice-to-have: {', '.join(matched_nice)}")
        if missing_nice:
            skill_analysis.append(f"  Missing nice-to-have: {', '.join(missing_nice)}")
        if skill_analysis:
            parts.append("Skill-Match Analysis:\n" + "\n".join(skill_analysis))

    # --- Experience -----------------------------------------------------------
    exp = resume_data.get("experience")
    if isinstance(exp, list):
        exp_lines = []
        for e in exp[:5]:
            if not isinstance(e, dict):
                continue
            title = e.get("title") or e.get("role") or ""
            company = e.get("company") or e.get("organization") or ""
            desc = e.get("description") or e.get("summary") or ""
            duration = e.get("duration") or e.get("period") or ""
            line = f"{title} at {company}".strip()
            if duration:
                line += f" ({str(duration).strip()})"
            if desc:
                line += f" — {str(desc)[:250]}"
            if line.strip():
                exp_lines.append(line)
        if exp_lines:
            parts.append("Work Experience:\n" + "\n".join(f"  • {l}" for l in exp_lines))
    elif isinstance(exp, str) and exp.strip():
        parts.append(f"Work Experience: {exp[:500]}")

    # --- Total experience -----------------------------------------------------
    total_yrs = resume_data.get("total_experience_years")
    if total_yrs is not None:
        try:
            parts.append(f"Total Experience: {float(total_yrs):.1f} years")
        except (TypeError, ValueError):
            pass

    # --- Education ------------------------------------------------------------
    edu = resume_data.get("education")
    if isinstance(edu, list):
        edu_lines = []
        for e in edu[:3]:
            if not isinstance(e, dict):
                continue
            degree = e.get("degree") or ""
            inst = e.get("institution") or e.get("university") or ""
            field = e.get("field") or e.get("major") or ""
            line = f"{degree}"
            if field:
                line += f" in {field}"
            if inst:
                line += f" from {inst}"
            line = line.strip()
            if line:
                edu_lines.append(line)
        if edu_lines:
            parts.append("Education: " + "; ".join(edu_lines))

    # --- Projects with details ------------------------------------------------
    projects = resume_data.get("projects")
    if isinstance(projects, list):
        proj_lines = []
        for p in projects[:4]:
            if not isinstance(p, dict):
                continue
            name = str(p.get("name") or p.get("title") or "").strip()
            tech = p.get("technologies") or p.get("tech_stack") or p.get("tools") or []
            desc = str(p.get("description") or "")[:200]
            if not name:
                continue
            line = name
            if isinstance(tech, list) and tech:
                line += f" [{', '.join(str(t) for t in tech[:6])}]"
            if desc:
                line += f" — {desc}"
            proj_lines.append(line)
        if proj_lines:
            parts.append("Projects:\n" + "\n".join(f"  • {l}" for l in proj_lines))

    # --- Certifications -------------------------------------------------------
    certs = resume_data.get("certifications") or resume_data.get("certificates")
    if isinstance(certs, list) and certs:
        cert_names = [str(c.get("name") or c) for c in certs[:5] if c]
        cert_names = [n for n in cert_names if n.strip()]
        if cert_names:
            parts.append(f"Certifications: {', '.join(cert_names)}")

    return "\n".join(parts) if parts else "No resume data available."


# ---------------------------------------------------------------------------
#  Semantic deduplication
# ---------------------------------------------------------------------------

_STOP_WORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "must", "can", "to", "of", "in", "for",
    "on", "with", "at", "by", "from", "as", "into", "about", "your",
    "this", "that", "which", "what", "when", "where", "how", "why",
    "if", "or", "and", "but", "not", "no", "so", "than", "then",
    "its", "it", "you", "me", "my", "we", "our", "they", "them",
    "tell", "describe", "explain", "walk", "through", "give", "example",
}


def _question_fingerprint(text: str) -> str:
    """Return a normalised keyword string for near-duplicate detection."""
    words = _re.sub(r"[^a-z0-9\s]", " ", text.lower()).split()
    keywords = sorted(set(w for w in words if len(w) > 2 and w not in _STOP_WORDS))[:10]
    return " ".join(keywords)


def _deduplicate_questions(questions: List[dict]) -> List[dict]:
    """Remove near-duplicate questions by keyword fingerprint."""
    seen: set = set()
    unique: List[dict] = []
    for q in questions:
        fp = _question_fingerprint(q.get("text", ""))
        if fp in seen:
            logger.info("[generate_questions] dedup: dropping duplicate fingerprint=%s", fp)
            continue
        seen.add(fp)
        unique.append(q)
    return unique


# ---------------------------------------------------------------------------
#  Core question generation
# ---------------------------------------------------------------------------

def _get_role_technology_hints(role: str, skills: str) -> str:
    """Return role-specific technology focus areas to guide the LLM."""
    role_lower = (role or "").lower().replace("_", " ").replace("-", " ")
    skills_lower = (skills or "").lower()

    if any(k in role_lower or k in skills_lower for k in ["ai", "ml", "machine learning", "data scientist", "deep learning", "nlp"]):
        return """ROLE-SPECIFIC FOCUS (AI/ML Engineer):
- RAG pipelines, vector databases (FAISS, Pinecone, Weaviate, ChromaDB)
- Embedding models, chunking strategies, retrieval optimization
- LLM fine-tuning, prompt engineering, inference optimization
- LangChain, LlamaIndex, agentic workflows, tool calling
- Model deployment (TensorFlow Serving, TorchServe, vLLM, Triton)
- Hallucination reduction, evaluation metrics, guardrails
- Data preprocessing, feature engineering, model versioning (MLflow, W&B)
- GPU optimization, quantization, distillation"""

    if any(k in role_lower or k in skills_lower for k in ["backend", "server", "api", "microservice"]):
        return """ROLE-SPECIFIC FOCUS (Backend Engineer):
- API design (REST, GraphQL, gRPC), authentication (JWT, OAuth2)
- Database optimization (indexing, query planning, sharding, replication)
- Caching strategies (Redis, Memcached, CDN, cache invalidation)
- Message queues (Kafka, RabbitMQ, SQS), event-driven architecture
- Scalability patterns (horizontal scaling, load balancing, rate limiting)
- Microservices communication, service discovery, circuit breakers
- Containerization (Docker, Kubernetes), CI/CD pipelines
- Monitoring, logging, distributed tracing (Prometheus, Grafana, Jaeger)"""

    if any(k in role_lower or k in skills_lower for k in ["frontend", "react", "angular", "vue", "ui", "ux"]):
        return """ROLE-SPECIFIC FOCUS (Frontend Engineer):
- Component architecture, state management (Redux, Zustand, Context)
- Performance optimization (code splitting, lazy loading, memoization)
- Browser rendering pipeline, reflows, repaints, virtual DOM
- API integration patterns, error handling, caching strategies
- Testing (unit, integration, E2E with Jest, Playwright, Cypress)
- Accessibility (WCAG), responsive design, cross-browser compatibility
- Build tools (Webpack, Vite, Turbopack), module bundling
- SSR vs CSR vs ISR, hydration strategies"""

    if any(k in role_lower or k in skills_lower for k in ["fullstack", "full stack", "full-stack"]):
        return """ROLE-SPECIFIC FOCUS (Full-Stack Engineer):
- End-to-end architecture decisions, monolith vs microservices
- Frontend-backend communication patterns, API contracts
- Database design, ORM usage, migration strategies
- Authentication/authorization flows across stack
- Deployment strategies, environment management, infrastructure as code
- Performance optimization across the full stack
- Testing strategies spanning frontend and backend"""

    if any(k in role_lower or k in skills_lower for k in ["devops", "sre", "infrastructure", "cloud", "platform"]):
        return """ROLE-SPECIFIC FOCUS (DevOps/SRE/Cloud Engineer):
- Infrastructure as code (Terraform, Pulumi, CloudFormation)
- Container orchestration (Kubernetes, ECS), service mesh (Istio)
- CI/CD pipeline design, deployment strategies (blue-green, canary)
- Monitoring, alerting, SLO/SLI definition, incident response
- Cloud architecture (AWS, GCP, Azure), cost optimization
- Security hardening, secrets management, compliance
- Disaster recovery, backup strategies, chaos engineering"""

    if any(k in role_lower or k in skills_lower for k in ["data engineer", "etl", "data pipeline", "analytics"]):
        return """ROLE-SPECIFIC FOCUS (Data Engineer):
- ETL/ELT pipeline design, data modeling (star schema, snowflake)
- Stream processing (Kafka, Spark Streaming, Flink)
- Data warehousing (Snowflake, BigQuery, Redshift)
- Data quality, validation, lineage tracking
- Orchestration (Airflow, Dagster, Prefect)
- Lake architecture (Delta Lake, Iceberg), partitioning strategies
- Performance optimization for large-scale data processing"""

    if any(k in role_lower or k in skills_lower for k in ["mobile", "android", "ios", "flutter", "react native"]):
        return """ROLE-SPECIFIC FOCUS (Mobile Engineer):
- App architecture (MVVM, Clean Architecture, BLoC)
- Performance optimization (memory, battery, network)
- Offline-first design, local storage, sync strategies
- Push notifications, deep linking, app lifecycle
- Native vs cross-platform trade-offs
- App store deployment, versioning, A/B testing
- Security (certificate pinning, secure storage, obfuscation)"""

    if any(k in role_lower or k in skills_lower for k in ["salesforce", "apex", "lwc", "crm"]):
        return """ROLE-SPECIFIC FOCUS (Salesforce Developer):
- Apex triggers (before/after), governor limits, bulkification
- LWC lifecycle, component communication, wire service
- SOQL/SOSL optimization, relationship queries
- Integration patterns (REST/SOAP callouts, platform events)
- Flows vs Apex, declarative vs programmatic
- Security model (profiles, permission sets, sharing rules)
- Deployment (change sets, SFDX, CI/CD for Salesforce)"""

    # Generic technical role
    return f"""ROLE-SPECIFIC FOCUS ({role}):
- Focus on the specific technologies and frameworks mentioned in the JD and resume.
- Ask about architecture decisions, implementation challenges, and optimization.
- Probe into debugging experience, production issues, and scalability.
- Cover tool/framework expertise relevant to the role."""


async def generate_interview_questions(openai, job: dict, resume_data: Optional[dict], question_count: int = 5, difficulty: str = "medium") -> List[dict]:
    """Generate personalized, technically-focused interview questions.

    Uses GPT-4.1-mini. Questions are generated per-candidate at invite time,
    based on 80%+ technical content derived from the candidate's actual resume
    (projects, skills, technologies) cross-referenced with JD requirements.
    Semantic deduplication prevents any repeated questions within a session.
    """
    role = job.get("role", "developer")
    level = job.get("level", "mid")
    title = job.get("title", "Software Developer")
    jd_must_raw = job.get("must_have_skills") or []
    jd_nice_raw = job.get("good_to_have_skills") or []
    jd_skills = ", ".join(jd_must_raw) if isinstance(jd_must_raw, list) else str(jd_must_raw)
    jd_nice = ", ".join(jd_nice_raw) if isinstance(jd_nice_raw, list) else str(jd_nice_raw)
    jd_desc = str(job.get("description") or "")[:800]
    difficulty = (difficulty or "medium").strip().lower()
    default_duration = _DIFFICULTY_DURATION.get(difficulty, 120)
    session_seed = uuid.uuid4().hex[:8]

    # Request extra to allow dedup headroom
    request_count = question_count + 4

    resume_context = _extract_resume_context(resume_data, job)
    role_hints = _get_role_technology_hints(role, jd_skills)

    # ── Difficulty calibration ───────────────────────────────────────
    if difficulty == "easy":
        diff_guidance = """DIFFICULTY: EASY (Junior/Fresher)
- Ask about fundamental technical concepts and their application.
- Probe into academic/personal projects — what they built, why, how.
- Test understanding of tools and technologies listed on resume.
- Keep questions implementation-focused but at an introductory depth.
- Example: 'In your project [X], you used [Technology]. Explain how you set it up and what challenges you faced getting it to work.'"""
    elif difficulty == "hard":
        diff_guidance = """DIFFICULTY: HARD (Senior/Lead/Architect)
- Ask about system design, architecture trade-offs, and production-scale challenges.
- Probe into performance optimization, debugging complex distributed systems.
- Test deep expertise: scalability decisions, failure modes, capacity planning.
- Ask about technical leadership, mentoring, and cross-team decision-making.
- Example: 'In your work at [Company], you built [System]. Walk me through how you designed it for scale — what were the critical architecture decisions, failure modes you planned for, and what would you redesign today?'"""
    else:
        diff_guidance = """DIFFICULTY: MEDIUM (Mid-Level/Experienced)
- Ask about real implementation details, debugging, and trade-offs from actual experience.
- Probe into specific technical decisions made in projects and their outcomes.
- Test problem-solving with practical scenarios tied to the role.
- Example: 'You used [Framework] in your [Project]. Describe a specific technical challenge you hit during implementation and how you resolved it.'"""

    prompt = f"""You are a senior technical interviewer with 15+ years of industry experience. Generate {request_count} highly technical, personalized interview questions for a {level} {title} candidate.

SESSION SEED: {session_seed}

======================================================================
JOB DESCRIPTION
======================================================================
Title: {title} | Role: {role} | Level: {level}
Must-Have Skills: {jd_skills or 'N/A'}
Good-to-Have Skills: {jd_nice or 'N/A'}
Description: {jd_desc or 'N/A'}

======================================================================
CANDIDATE RESUME DATA
======================================================================
{resume_context}

======================================================================
{diff_guidance}
======================================================================

{role_hints}

======================================================================
QUESTION GENERATION REQUIREMENTS (STRICTLY FOLLOW)
======================================================================

You MUST generate questions in this distribution:

1. RESUME-PROJECT TECHNICAL QUESTIONS (40% — approximately {int(request_count * 0.4)} questions)
   Directly reference specific projects, companies, tools, or technologies from the candidate's resume.
   These must be deeply technical and implementation-focused.
   
   GOOD examples:
   - "In your RAG-based chatbot project, what chunking strategy did you use? How did you optimize retrieval latency and handle cases where the retrieved context was irrelevant?"
   - "You mentioned using FAISS for vector search. How did you handle index updates when new documents were added? Did you use IVF or HNSW, and why?"
   - "At [Company], you worked on API optimization. What specific bottlenecks did you identify, and what measurable improvements did you achieve?"
   - "Your resume shows experience with Kubernetes. Describe how you handled rolling deployments and what strategy you used for zero-downtime releases."

2. JD SKILLS TECHNICAL QUESTIONS (30% — approximately {int(request_count * 0.3)} questions)
   Based on must-have and good-to-have skills from the JD. Ask about implementation details,
   architecture decisions, and real-world usage of these specific technologies.
   
   GOOD examples:
   - "This role requires expertise in FastAPI. Describe how you structure a production FastAPI application — dependency injection, middleware, error handling, and async patterns you follow."
   - "The JD mentions distributed systems. Explain how you would handle data consistency across microservices when network partitions occur."
   - "Event-driven architecture is key for this role. Describe a system you built or worked on that used message queues — what technology did you use, how did you handle failures and ordering?"

3. TECHNICAL SCENARIO QUESTIONS (20% — approximately {int(request_count * 0.2)} questions)
   Real-world technical problems the candidate would face in this specific role.
   These should test problem-solving, debugging, and architectural thinking.
   
   GOOD examples:
   - "Your production API starts returning 5xx errors at 2 AM with a 10x traffic spike. Walk me through your complete debugging and resolution process from alert to fix."
   - "You need to migrate a 500GB PostgreSQL database to a new schema with zero downtime. What is your step-by-step approach?"
   - "A machine learning model in production starts showing degraded accuracy over 3 weeks. How do you diagnose whether it is data drift, concept drift, or a pipeline issue?"

4. SKILL-GAP PROBING QUESTIONS (10% — approximately {int(request_count * 0.1)} questions)
   For skills required by the JD but NOT found on the resume — test foundational understanding.
   For skills that MATCH between resume and JD — go deeper than surface level.
   
   GOOD examples:
   - "The role requires [Missing Skill]. What is your current understanding of it, and how would you approach getting production-ready with it?"
   - "You have [Matched Skill] experience and this role uses it heavily. Describe the most complex production issue you debugged involving it."

======================================================================
ABSOLUTE RULES (VIOLATIONS = REJECTED QUESTIONS)
======================================================================
1. TECHNICAL FOCUS: At least 80% of questions MUST be technical/implementation-focused. Do NOT pad with generic behavioral questions like 'What approaches do you take to produce project architecture?' or 'How do you handle teamwork?'
2. NO GENERIC QUESTIONS: Every question must reference SPECIFIC technologies, projects, companies, or skills from the resume or JD. A question that could be asked to any random developer is WRONG.
3. EVERY QUESTION IS INDEPENDENT: Never reference other questions or candidate answers. No 'Following up on...', 'Since you mentioned...', 'Based on your earlier answer...'.
4. NO REPETITION: All {request_count} questions must cover completely different topics/technologies. No two questions about the same tool or concept.
5. VERBAL ONLY: No coding tasks, no 'write a function', no whiteboard problems.
6. NO FILLER: No 'Tell me about yourself', no 'Why this role?', no generic HR questions.
7. NATURAL LENGTH: Questions should be as long as needed to set proper context. A good technical question is typically 2-4 sentences.
8. USE SESSION SEED: Vary topics and phrasing using seed {session_seed}. Each generation must produce different questions.

======================================================================
OUTPUT FORMAT
======================================================================
Return ONLY a JSON array of EXACTLY {request_count} objects:
[{{{{
  "text": "<detailed technical question referencing specific resume/JD content>",
  "type": "technical",
  "duration": {default_duration}
}}}}]

type must be one of: "technical", "situational", "behavioral" (use "behavioral" sparingly, max 1 question)
"""

    logger.info("[generate_questions] job=%s role=%s difficulty=%s count=%s has_resume=%s seed=%s",
                title, role, difficulty, question_count, resume_data is not None, session_seed)

    try:
        result = await openai.generate_json(prompt)
        questions = result if isinstance(result, list) else (result.get("questions") if isinstance(result, dict) else [])

        # Filter out empty/tiny questions
        questions = [q for q in questions if isinstance(q, dict) and isinstance(q.get("text"), str) and len(q["text"].strip()) > 30]

        # Semantic deduplication
        questions = _deduplicate_questions(questions)

        # Trim to requested count
        if len(questions) > question_count:
            questions = questions[:question_count]
        elif len(questions) < question_count:
            questions += get_fallback_questions(question_count - len(questions), role, difficulty)

        # Normalize fields
        for q in questions:
            q["text"] = q["text"].strip()
            if not isinstance(q.get("duration"), int) or q["duration"] <= 0:
                q["duration"] = default_duration
            if q.get("type") not in ("technical", "behavioral", "situational"):
                q["type"] = "technical"

        logger.info("[generate_questions] generated %d questions (after dedup) for job=%s seed=%s", len(questions), title, session_seed)
        return questions
    except Exception as e:
        logger.error("[generate_questions] LLM failed, using fallbacks: %s", str(e))
        return get_fallback_questions(question_count, role, difficulty)


class InterviewInviteRequest(BaseModel):
    candidate_ids: List[str] = Field(default_factory=list)
    job_id: str
    scheduled_time: Optional[str] = None
    question_count: Optional[int] = 5
    difficulty: Optional[str] = "medium"
    deadline: Optional[str] = None


@router.post("/invite")
async def invite_ai_interviews(
    body: InterviewInviteRequest,
    user: ClerkUser = Depends(require_user),
):
    db = get_db_admin_service()
    email_service = get_email_service()
    openai = get_openai_service()
    settings = get_settings()

    if not body.job_id:
        return api_error(message="Missing job_id", status_code=400)
    if not isinstance(body.candidate_ids, list) or len(body.candidate_ids) == 0:
        return api_error(message="No candidates selected", status_code=400)

    # Deadline: prefer explicit datetime from body.deadline, fallback to 72h
    try:
        if body.deadline:
            deadline_dt = _parse_iso_dt(body.deadline)
            if deadline_dt <= datetime.now(timezone.utc):
                return api_error(message="Deadline must be in the future", status_code=400)
        else:
            deadline_dt = datetime.now(timezone.utc) + timedelta(hours=72)
    except Exception:
        return api_error(message="Invalid deadline date/time format", status_code=400)

    def _fetch_job():
        return (
            db.client.from_("job_descriptions")
            .select("id, title, role, level, must_have_skills, good_to_have_skills, description")
            .eq("id", body.job_id)
            .eq("created_by", user.id)
            .single()
            .execute()
        )

    job_res = await db.run(_fetch_job)
    job = getattr(job_res, "data", None)
    if not isinstance(job, dict):
        return api_error(message="Job not found", status_code=404)

    def _fetch_candidates():
        return (
            db.client.from_("candidates")
            .select("id, email, full_name, resume_parsed_data")
            .in_("id", body.candidate_ids)
            .execute()
        )

    cand_res = await db.run(_fetch_candidates)
    candidates = getattr(cand_res, "data", None) or []
    if not isinstance(candidates, list) or len(candidates) == 0:
        return api_error(message="No candidates found", status_code=404)

    requested_count = max(1, min(30, int(body.question_count or 5)))
    difficulty = (body.difficulty or "medium").strip().lower()

    invites_sent = 0
    failed: List[str] = []
    failed_reasons: Dict[str, str] = {}

    for c in candidates:
        cid = c.get("id") if isinstance(c, dict) else None
        if not cid:
            continue
        token = secrets.token_urlsafe(32)
        session_id = str(uuid.uuid4())

        try:
            questions_raw = await generate_interview_questions(
                openai,
                job,
                c.get("resume_parsed_data") if isinstance(c, dict) else None,
                requested_count,
                difficulty,
            )
            questions = _normalize_questions(questions_raw)
            if len(questions) == 0:
                raise ValueError("No interview questions generated")

            resume = c.get("resume_parsed_data") if isinstance(c, dict) else None
            resume = resume if isinstance(resume, dict) else {}
            resume_insights = {
                "skills": resume.get("skills")[:15]
                if isinstance(resume.get("skills"), list)
                else [],
                "experience_summary": "; ".join(
                    [
                        f"{(e or {}).get('title', '')} at {(e or {}).get('company', '')}".strip()
                        for e in (resume.get("experience") or [])[:3]
                        if isinstance(e, dict)
                    ]
                )
                if isinstance(resume.get("experience"), list)
                else (str(resume.get("experience"))[:300] if isinstance(resume.get("experience"), str) else ""),
                "education_summary": "; ".join(
                    [
                        f"{(e or {}).get('degree', '')} from {(e or {}).get('institution', '')}".strip()
                        for e in (resume.get("education") or [])[:2]
                        if isinstance(e, dict)
                    ]
                )
                if isinstance(resume.get("education"), list)
                else (str(resume.get("education"))[:200] if isinstance(resume.get("education"), str) else ""),
            }

            proctoring_data = {
                "warnings": [],
                "camera_enabled": False,
                "microphone_enabled": False,
                "resume_insights": resume_insights,
                "invite_delivery": {"status": "pending", "attempted_at": _utc_now_iso()},
            }

            proctoring_data["difficulty"] = difficulty

            insert_row = {
                "id": session_id,
                "candidate_id": cid,
                "job_id": body.job_id,
                "token": token,
                "status": "pending",
                "deadline": deadline_dt.isoformat(),
                "current_question_index": 0,
                "questions": questions,
                "responses": [],
                "proctoring_data": proctoring_data,
                "created_at": _utc_now_iso(),
            }

            logger.info("[ai_interview.invite] inserting session session_id=%s candidate_id=%s job_id=%s", session_id, cid, body.job_id)
            await db.run(lambda: db.client.from_("ai_interview_sessions").insert(insert_row).execute())

            # Email is non-blocking infra
            try:
                interview_link = f"{str(settings.frontend_url).rstrip('/')}/ai-interview/{token}"
                recipient_email = str(c.get("email") or "").strip()
                if not recipient_email:
                    raise RuntimeError("Candidate email is missing")
                await email_service.send_interview_invite(
                    to=recipient_email,
                    candidate_name=str(c.get("full_name") or "Candidate"),
                    job_title=str(job.get("title") or ""),
                    interview_link=interview_link,
                    scheduled_time=body.scheduled_time,
                )
                proctoring_data["invite_delivery"] = {"status": "sent", "sent_at": _utc_now_iso()}
            except Exception as e:
                logger.error("[ai_interview.invite] EMAIL FAILED session=%s to=%s error=%s", session_id, recipient_email if 'recipient_email' in dir() else '?', str(e))
                proctoring_data["invite_delivery"] = {"status": "failed", "failed_at": _utc_now_iso(), "error": str(e)}

            await db.run(
                lambda: db.client.from_("ai_interview_sessions")
                .update({"proctoring_data": proctoring_data, "updated_at": _utc_now_iso()})
                .eq("id", session_id)
                .execute()
            )

            invites_sent += 1
        except Exception as e:
            failed.append(str(cid))
            failed_reasons[str(cid)] = str(e)

    return ok(
        {
            "success": invites_sent > 0,
            "invites_sent": invites_sent,
            "failed": failed,
            "failed_reasons": failed_reasons,
        }
    )


@router.get("/start/{token}")
async def start_interview(token: str):
    db = get_db_admin_service()

    token = token.strip()

    def _fetch():
        return (
            db.client.from_("ai_interview_sessions")
            .select("*, candidates(full_name, email), job_descriptions(title, role, level)")
            .eq("token", token)
            .single()
            .execute()
        )

    res = await db.run(_fetch)
    session = getattr(res, "data", None)
    if not isinstance(session, dict):
        return api_error(message="Interview not found or link expired", status_code=404)

    if session.get("status") in ("completed", "terminated"):
        return api_error(message="Interview already completed or terminated", status_code=400)

    try:
        deadline_dt = _parse_iso_dt(session.get("deadline"))
        if datetime.now(timezone.utc) > deadline_dt.astimezone(timezone.utc):
            await db.update(
                "ai_interview_sessions",
                {
                    "status": "expired",
                    "integrity_score": 0,
                    "completed_at": _utc_now_iso(),
                },
                filters={"id": session["id"]},
            )
            await db.update(
                "job_applications",
                {"interview_status": "expired", "manual_interview_score": 0},
                filters={"candidate_id": session.get("candidate_id"), "job_id": session.get("job_id")},
            )
            return api_error(message="Interview deadline has passed", status_code=400)
    except Exception:
        return api_error(message="Interview session misconfigured (invalid deadline)", status_code=500)

    questions = _normalize_questions(session.get("questions"))
    if len(questions) == 0:
        return api_error(
            message="Interview questions are not available yet. Please contact the hiring team.",
            status_code=400,
        )

    if session.get("status") == "pending":
        await db.update(
            "ai_interview_sessions",
            {"status": "in_progress", "started_at": _utc_now_iso()},
            filters={"id": session["id"]},
        )

    cand = session.get("candidates") or {}
    job = session.get("job_descriptions") or {}
    return ok(
        {
            "session_id": session.get("id"),
            "candidate_name": cand.get("full_name"),
            "job_title": job.get("title"),
            "total_questions": len(questions),
            "estimated_duration_minutes": (len(questions) or 5) * 3,
        }
    )


@router.get("/{session_id}/question")
async def get_current_question(session_id: str):
    db = get_db_admin_service()
    sessions = await db.select(
        "ai_interview_sessions",
        columns="id,status,current_question_index,questions",
        filters={"id": session_id},
        limit=1,
    )
    session = sessions[0] if sessions else None
    if not session:
        return api_error(message="Session not found", status_code=404)
    if session.get("status") != "in_progress":
        return api_error(message="Interview not in progress", status_code=400)

    idx = int(session.get("current_question_index") or 0)
    questions = _normalize_questions(session.get("questions"))
    if idx >= len(questions):
        return ok({"completed": True, "message": "All questions answered"})

    q = questions[idx]
    return ok(
        {
            "index": idx,
            "question_text": q.get("text"),
            "question_type": q.get("type"),
            "expected_duration_seconds": q.get("duration") or 120,
        }
    )


class AdaptQuestionRequest(BaseModel):
    next_index: Optional[int] = None


@router.post("/{session_id}/adapt-question")
async def adapt_question(session_id: str, body: AdaptQuestionRequest):
    """Return the pre-planned question at the requested index.

    Adaptive/follow-up generation is disabled — questions are generated once
    at invite time and served as-is, irrespective of candidate responses.
    """
    db = get_db_admin_service()

    sessions = await db.select(
        "ai_interview_sessions",
        columns="id,status,current_question_index,questions",
        filters={"id": session_id},
        limit=1,
    )
    session = sessions[0] if sessions else None
    if not session:
        return api_error(message="Session not found", status_code=404)
    if session.get("status") != "in_progress":
        return api_error(message="Interview not in progress", status_code=400)

    questions = _normalize_questions(session.get("questions"))
    idx = body.next_index if isinstance(body.next_index, int) else int(session.get("current_question_index") or 0)
    if idx >= len(questions):
        return ok({"completed": True})

    q = questions[idx]
    return ok(
        {
            "index": idx,
            "question_text": q.get("text"),
            "question_type": q.get("type"),
            "expected_duration_seconds": q.get("duration") or 120,
            "adaptive": False,
        }
    )


@router.post("/{session_id}/transcribe-store")
async def transcribe_store(
    session_id: str,
    audio: UploadFile = File(...),
    question_index: int = Form(...),
    mime_type: str = Form("audio/webm"),
    audio_duration_seconds: float = Form(0.0),
):
    """Accept multipart audio upload, transcribe with gpt-4o-mini-transcribe, store result."""
    db = get_db_admin_service()
    whisper = get_whisper_service()

    sessions = await db.select(
        "ai_interview_sessions",
        columns="id,status,responses",
        filters={"id": session_id},
        limit=1,
    )
    session = sessions[0] if sessions else None
    if not session:
        return api_error(message="Session not found", status_code=404)
    if session.get("status") not in ("in_progress", "completed"):
        return api_error(message="Interview session is not active", status_code=400)

    if question_index < 0:
        return api_error(message="Invalid question_index", status_code=400)

    audio_bytes = await audio.read()
    if not audio_bytes:
        logger.warning("[transcribe_store] Empty audio received for session=%s q=%s", session_id, question_index)
        return api_error(message="Empty audio data received", status_code=400)

    effective_mime = mime_type or audio.content_type or "audio/webm"
    logger.info("[transcribe_store] session=%s q=%s bytes=%d mime=%s", session_id, question_index, len(audio_bytes), effective_mime)

    try:
        transcript = await whisper.transcribe(audio_bytes, mime_type=effective_mime)
    except RuntimeError as e:
        logger.error("[transcribe_store] Auth error: %s", str(e))
        return api_error(message=f"Transcription service error: {str(e)}", status_code=500)
    except Exception as e:
        logger.error("[transcribe_store] Unexpected error: %s", str(e))
        transcript = ""

    responses = session.get("responses") if isinstance(session.get("responses"), list) else []
    responses = list(responses)
    existing_idx = next(
        (i for i, r in enumerate(responses)
         if isinstance(r, dict) and int(r.get("question_index") if r.get("question_index") is not None else -1) == question_index),
        -1,
    )
    existing = responses[existing_idx] if existing_idx >= 0 and isinstance(responses[existing_idx], dict) else {}
    updated = {
        **existing,
        "question_index": question_index,
        "transcript": transcript,
        "audio_duration_seconds": float(audio_duration_seconds or existing.get("audio_duration_seconds") or 0),
        "confidence": float(existing.get("confidence") or 0.9),
        "transcribed_at": _utc_now_iso(),
        "submitted_at": existing.get("submitted_at") or _utc_now_iso(),
    }
    if existing_idx >= 0:
        responses[existing_idx] = updated
    else:
        responses.append(updated)

    logger.info("[transcribe_store] saved session=%s q=%s transcript_len=%s", session_id, question_index, len(transcript))
    await db.update(
        "ai_interview_sessions",
        {"responses": responses, "updated_at": _utc_now_iso()},
        filters={"id": session_id},
    )

    return ok({"success": True, "question_index": question_index, "transcript_length": len(transcript)})


@router.post("/{session_id}/response")
async def submit_response(session_id: str, body: Dict[str, Any] = Body(...)):
    db = get_db_admin_service()
    sessions = await db.select(
        "ai_interview_sessions",
        columns="id,status,current_question_index,questions,responses",
        filters={"id": session_id},
        limit=1,
    )
    session = sessions[0] if sessions else None
    if not session:
        return api_error(message="Session not found", status_code=404)
    if session.get("status") != "in_progress":
        return api_error(message="Interview not in progress", status_code=400)

    q_index = body.get("question_index")
    if not isinstance(q_index, int):
        try:
            q_index = int(q_index)
        except Exception:
            return api_error(message="Invalid question_index", status_code=400)

    responses = session.get("responses") if isinstance(session.get("responses"), list) else []
    responses = list(responses)
    existing_idx = next(
        (i for i, r in enumerate(responses) if isinstance(r, dict) and int(r.get("question_index") or -1) == q_index),
        -1,
    )
    payload = {
        "question_index": q_index,
        "transcript": body.get("transcript") if isinstance(body.get("transcript"), str) else "",
        "audio_duration_seconds": body.get("audio_duration_seconds"),
        "confidence": body.get("confidence"),
        "submitted_at": _utc_now_iso(),
    }
    if existing_idx >= 0 and isinstance(responses[existing_idx], dict):
        responses[existing_idx] = {**responses[existing_idx], **payload}
    else:
        responses.append(payload)

    next_index = int(session.get("current_question_index") or 0) + 1
    questions = _normalize_questions(session.get("questions"))
    is_last = next_index >= len(questions)

    logger.info("[ai_interview.response] saving response session_id=%s question_index=%s is_last=%s transcript_len=%s",
                session_id, q_index, is_last, len(payload.get("transcript") or ""))
    await db.update(
        "ai_interview_sessions",
        {"responses": responses, "current_question_index": next_index, "updated_at": _utc_now_iso()},
        filters={"id": session_id},
    )

    return ok({"success": True, "is_last_question": is_last})


@router.post("/{session_id}/proctoring")
async def proctoring(session_id: str, event: Dict[str, Any] = Body(...)):
    db = get_db_admin_service()
    sessions = await db.select(
        "ai_interview_sessions",
        columns="id,proctoring_data,status",
        filters={"id": session_id},
        limit=1,
    )
    session = sessions[0] if sessions else None
    if not session:
        return api_error(message="Session not found", status_code=404)

    proctoring_data = session.get("proctoring_data") if isinstance(session.get("proctoring_data"), dict) else {}

    et = event.get("event_type")
    if et == "tab_switch":
        proctoring_data["tab_switches"] = int(proctoring_data.get("tab_switches") or 0) + 1
    elif et == "fullscreen_exit":
        proctoring_data["fullscreen_exits"] = int(proctoring_data.get("fullscreen_exits") or 0) + 1
    elif et == "window_blur":
        proctoring_data["window_blurs"] = int(proctoring_data.get("window_blurs") or 0) + 1
    elif et == "face_not_detected":
        proctoring_data["face_detection_failures"] = int(proctoring_data.get("face_detection_failures") or 0) + 1
    elif et == "copy_paste":
        proctoring_data["copy_paste_attempts"] = int(proctoring_data.get("copy_paste_attempts") or 0) + 1
    elif et == "devtools_open":
        proctoring_data["devtools_attempts"] = int(proctoring_data.get("devtools_attempts") or 0) + 1

    warnings = proctoring_data.get("warnings")
    if not isinstance(warnings, list):
        warnings = []
    is_critical = et in ("tab_switch", "fullscreen_exit", "window_blur")
    warnings.append(
        {
            "type": et,
            "timestamp": event.get("timestamp") or _utc_now_iso(),
            "details": event.get("details"),
            "severity": "critical" if is_critical else "warning",
        }
    )
    proctoring_data["warnings"] = warnings

    should_terminate = False
    termination_reason = ""
    if is_critical:
        should_terminate = True
        termination_reason = f"Interview terminated: {str(et).replace('_', ' ')} detected. This is a strict proctoring violation."
    elif int(proctoring_data.get("face_detection_failures") or 0) >= 3:
        should_terminate = True
        termination_reason = "Interview terminated: Face not visible 3 times."
    else:
        minor = int(proctoring_data.get("copy_paste_attempts") or 0) + int(proctoring_data.get("devtools_attempts") or 0)
        if minor >= 3:
            should_terminate = True
            termination_reason = "Interview terminated: Too many proctoring violations."

    if should_terminate:
        proctoring_data["terminated"] = True
        proctoring_data["termination_reason"] = termination_reason
        terminated_eval = {
            "overall_score": 0,
            "technical_score": 0,
            "communication_score": 0,
            "confidence_score": 0,
            "recommendation": "no_hire",
            "strengths": [],
            "areas_for_improvement": ["Interview terminated due to proctoring violations."],
            "detailed_feedback": termination_reason,
        }
        await db.update(
            "ai_interview_sessions",
            {
                "proctoring_data": proctoring_data,
                "status": "terminated",
                "completed_at": _utc_now_iso(),
                "final_evaluation": terminated_eval,
            },
            filters={"id": session_id},
        )
        violations = len(warnings) if isinstance(warnings, list) else 0
        threshold = 3
        return ok({"terminated": True, "message": termination_reason, "violations": violations, "threshold": threshold})

    await db.update(
        "ai_interview_sessions",
        {"proctoring_data": proctoring_data, "updated_at": _utc_now_iso()},
        filters={"id": session_id},
    )
    violations = len(warnings) if isinstance(warnings, list) else 0
    threshold = 3
    return ok({"success": True, "terminated": False, "warning": True, "message": "Proctoring violation recorded.", "violations": violations, "threshold": threshold})


@router.post("/{session_id}/complete")
async def complete(session_id: str):
    db = get_db_admin_service()
    ai = get_openai_service()

    def _fetch():
        return (
            db.client.from_("ai_interview_sessions")
            .select("*, candidates(full_name), job_descriptions(title, role, level, must_have_skills)")
            .eq("id", session_id)
            .single()
            .execute()
        )

    res = await db.run(_fetch)
    session = getattr(res, "data", None)
    if not isinstance(session, dict):
        return api_error(message="Session not found", status_code=404)

    questions = _normalize_questions(session.get("questions"))
    responses = session.get("responses") if isinstance(session.get("responses"), list) else []

    qa_pairs: List[str] = []
    for i, q in enumerate(questions):
        resp = None
        for r in responses:
            if isinstance(r, dict) and int(r.get("question_index") or -1) == i:
                resp = r
                break
        qa_pairs.append(f"Q{i + 1} ({q.get('type')}): {q.get('text')}\nA{i + 1}: {(resp or {}).get('transcript') or '[No response]'}")
    qa_text = "\n\n".join(qa_pairs)

    job = session.get("job_descriptions") or {}
    skills = ", ".join(job.get("must_have_skills") or []) if isinstance(job.get("must_have_skills"), list) else ""

    prompt = (
        f"Evaluate this AI interview for a {job.get('level')} {job.get('role')} position ({job.get('title')}).\n"
        f"Required skills: {skills}\n\n"
        f"Interview Q&A:\n{qa_text}\n\n"
        "Evaluate and return JSON:\n"
        "{\n"
        '  "overall_score": 0-100,\n'
        '  "technical_score": 0-100,\n'
        '  "communication_score": 0-100,\n'
        '  "confidence_score": 0-100,\n'
        '  "recommendation": "strong_hire" or "hire" or "maybe" or "no_hire",\n'
        '  "strengths": ["strength1", "strength2"],\n'
        '  "areas_for_improvement": ["area1", "area2"],\n'
        '  "detailed_feedback": "2-3 sentence summary of candidate performance"\n'
        "}"
    )

    final_eval: Dict[str, Any]
    try:
        final_eval = await ai.generate_json(prompt)
        if not isinstance(final_eval, dict) or "overall_score" not in final_eval:
            raise ValueError("invalid evaluation")
    except Exception:
        answered = len([r for r in responses if isinstance(r, dict) and isinstance(r.get("transcript"), str) and r.get("transcript").strip()])
        completion = (answered / len(questions)) * 100 if questions else 0
        final_eval = {
            "overall_score": round(completion * 0.7),
            "technical_score": round(completion * 0.6),
            "communication_score": round(completion * 0.8),
            "confidence_score": round(completion * 0.7),
            "recommendation": "maybe" if completion >= 70 else "no_hire",
            "strengths": ["Completed interview responses"] if answered > 0 else [],
            "areas_for_improvement": ["Could not perform AI evaluation - scores are approximate"],
            "detailed_feedback": f"Candidate answered {answered} of {len(questions)} questions.",
        }

    answered = len([r for r in responses if isinstance(r, dict) and isinstance(r.get("transcript"), str) and r.get("transcript", "").strip()])
    logger.info("[ai_interview.complete] session_id=%s questions=%s answered=%s recommendation=%s",
                session_id, len(questions), answered, final_eval.get("recommendation"))

    # Normalize: always include both field names for backward compatibility
    if "areas_for_improvement" in final_eval and "weaknesses" not in final_eval:
        final_eval["weaknesses"] = final_eval["areas_for_improvement"]
    elif "weaknesses" in final_eval and "areas_for_improvement" not in final_eval:
        final_eval["areas_for_improvement"] = final_eval["weaknesses"]

    await db.update(
        "ai_interview_sessions",
        {"status": "completed", "completed_at": _utc_now_iso(), "final_evaluation": final_eval},
        filters={"id": session_id},
    )

    return ok(final_eval)
