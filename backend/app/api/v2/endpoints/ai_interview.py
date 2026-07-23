from __future__ import annotations

import asyncio
import logging
import re as _re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, File, Form, UploadFile, BackgroundTasks
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
        cert_names: List[str] = []
        for c in certs[:5]:
            if not c:
                continue
            if isinstance(c, dict):
                name = c.get("name") or c.get("title") or c.get("certificate")
            else:
                name = c
            name = str(name).strip() if name is not None else ""
            if name:
                cert_names.append(name)
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


# Regex: matches version lists like "8/11/17", "2.x/3.x", "3.8/3.10/3.11"
_VERSION_LIST_RE = _re.compile(r'\b(\d+(?:\.\w+)?(?:/\d+(?:\.\w+)?){1,})', _re.IGNORECASE)


def _strip_version_lists(text: str) -> str:
    """Remove slash-separated version number lists from question text.

    Examples cleaned up:
      'Java 8/11/17'        -> 'Java'
      'Spring Boot 2.x/3.x' -> 'Spring Boot'
      'Python 3.8/3.10/3.11' -> 'Python'
    """
    # Remove the version list token (and the space before it if any)
    cleaned = _VERSION_LIST_RE.sub('', text)
    # Collapse any double-spaces left behind
    cleaned = _re.sub(r'  +', ' ', cleaned)
    return cleaned.strip()


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


async def generate_interview_questions(openai, job: dict, resume_data: Optional[dict], question_count: int = 5, difficulty: str = "medium", focus_areas: str = "", strict_focus: bool = False) -> List[dict]:
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

    # Request extra to allow dedup headroom — actual counts set inside the branch below
    request_count = question_count + 4  # may be overridden below
    # Pre-compute JD vs resume split (used both in prompt and in post-processing trim)
    if question_count == 1:
        _jd_count, _res_count = 1, 0
    elif question_count == 2:
        _jd_count, _res_count = 1, 1
    elif question_count == 3:
        _jd_count, _res_count = 2, 1
    elif question_count == 4:
        _jd_count, _res_count = 2, 2
    elif question_count == 5:
        _jd_count, _res_count = 3, 2
    elif question_count == 6:
        _jd_count, _res_count = 4, 2
    elif question_count == 7:
        _jd_count, _res_count = 4, 3
    else:
        import math
        _jd_count = math.ceil(question_count * 0.6)
        _res_count = question_count - _jd_count

    resume_context = _extract_resume_context(resume_data, job)
    role_hints = _get_role_technology_hints(role, jd_skills)

    # ── Difficulty calibration ───────────────────────────────────────
    if difficulty == "easy":
        diff_guidance = """DIFFICULTY: EASY (Junior / Fresher Level)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COGNITIVE REGISTER: Knowledge recall and basic application.
The candidate should be able to answer from textbook understanding or a hands-on project they personally built.

WHAT TO ASK:
- Definitions, core concepts, and why a technology or pattern exists.
- "What does X do and why would you use it?" — not "how would you design X for scale."
- Setup, configuration, and first-time usage of a specific tool or framework from the resume.
- A small, isolated technical challenge they faced in a personal/academic project and how they fixed it.
- Understanding of one specific data structure, algorithm, or design pattern at a conceptual level.

WHAT NOT TO ASK (FORBIDDEN at this level):
- Trade-off analysis between competing systems (e.g., "Compare Kafka vs RabbitMQ at scale")
- System design or distributed architecture questions
- Production incident handling, performance profiling, capacity planning
- Leadership, mentoring, or cross-team technical decisions

QUESTION FORM — use RECALL and EXPLAIN patterns:
- "What is [concept] and when would you use it in a project like [their project]?"
- "In your [project/assignment], you used [technology]. Walk me through how you set it up step by step."
- "What problem does [pattern/tool] solve? Can you give a simple example from your experience?"

EXPECTED ANSWER DEPTH:
A strong Easy-level answer covers: what the technology/concept is, one concrete use case, and a basic implementation step or personal experience. 1–2 minutes is sufficient. No design decisions or optimization discussion is expected.

EXAMPLE EASY QUESTION:
BAD (too deep): "How would you design a caching layer for a distributed API system?"
GOOD: "You used Redis in your college project. What is Redis used for, and how did you connect it to your application?"
"""
    elif difficulty == "hard":
        diff_guidance = """DIFFICULTY: HARD (Senior / Lead / Architect Level)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COGNITIVE REGISTER: Synthesis, architecture, and systemic trade-off reasoning.
The candidate must demonstrate ownership of complex systems, cross-cutting design decisions, and production-scale battle scars. Surface-level answers are insufficient.

WHAT TO ASK:
- System design with real constraints: "Design X for Y million users — walk me through your database strategy, caching, failure modes, and scaling decisions."
- Multi-factor trade-off analysis: consistency vs availability, latency vs throughput, build vs buy, monolith vs microservices — with real justification from their own systems.
- Production incident ownership: root cause analysis, how they diagnosed a systemic failure, what guardrails they put in place afterwards.
- Architecture evolution: how they migrated, refactored, or scaled an existing system under live traffic. What went wrong, what they would redo.
- Technical leadership: how they drove alignment across teams, onboarded engineers, made unpopular but correct technical calls, or managed a technical debt backlog.
- Deep internals: memory models, GC pressure, network protocol choices, replication lag, distributed consensus mechanisms — not just "I used Kafka," but why, how it was configured, and what failure scenarios were handled.

WHAT NOT TO ASK (TOO SHALLOW at this level):
- "What is X and how does it work?" — that is Easy/Medium territory
- Basic debugging of a single service or component
- Questions that a mid-level candidate could answer without production experience

QUESTION FORM — use DESIGN, CRITIQUE, and EVOLVE patterns:
- "Your [system from their resume] needed to support 10x traffic growth. Walk me through the architecture changes you made or would make — starting from bottleneck identification."
- "You chose [technology] at [company]. What were the trade-offs you explicitly rejected and why? What would trigger you to revisit that decision?"
- "A cascading failure took down your [system/service]. Walk me through your entire incident response — from first alert to post-mortem — and what systematic changes resulted."
- "How did you ensure [JD skill — e.g., data consistency / zero downtime deployments] in your most recent production system?"

EXPECTED ANSWER DEPTH:
A strong Hard-level answer must include: the specific constraints that shaped the decision, at least two alternatives explicitly considered and rejected (with reasoning), failure modes that were anticipated, and measurable outcomes or lessons learned. A candidate who answers only at the "what I used" level fails this tier. 3–5 minutes of depth is expected.

EXAMPLE HARD QUESTION:
BAD (too shallow): "What is a microservices architecture and when would you use it?"
GOOD: "In your role at [Company], you worked with a distributed backend. If that system started showing cascading failures under load — one service bringing down others — walk me through how you would diagnose the root cause, what architectural safeguards you would introduce, and how you would validate the fix in production without downtime."
"""
    else:
        diff_guidance = """DIFFICULTY: MEDIUM (Mid-Level / Experienced Developer)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COGNITIVE REGISTER: Applied analysis and real implementation judgment.
The candidate should be able to explain not just WHAT they did, but WHY they made specific decisions, what trade-offs they weighed, and what they would do differently. Rote recall is insufficient; concrete experience is required.

WHAT TO ASK:
- A specific technical decision they made in a real project: why they chose approach A over B, what the consequences were.
- Debugging a real problem they actually encountered: what the symptom was, how they diagnosed it, and what the fix was.
- A framework, library, or tool from their resume — but probing implementation depth, not just "have you used it?"
- Trade-offs between two options they have actually faced: SQL vs NoSQL for a specific use case, REST vs GraphQL, synchronous vs async processing.
- Testing, code quality, or API design decisions in a project they built.
- A performance issue, data problem, or integration failure they resolved — with specific details.

WHAT NOT TO ASK (TOO SHALLOW at this level):
- Pure definition questions like "What is REST?" or "What is a database index?" — those are Easy-level
- High-level system design for millions of users — that is Hard-level
- Questions a fresher could answer from reading documentation

WHAT NOT TO ASK (TOO DEEP at this level):
- Distributed systems CAP theorem trade-offs at architect scope
- Multi-team technical leadership or org-wide architecture decisions

QUESTION FORM — use IMPLEMENT, DECIDE, and DEBUG patterns:
- "In your [project], you used [technology]. Walk me through a specific technical decision you made — what alternatives did you consider and why did you pick this approach?"
- "Describe a real bug or failure you hit in [project or technology area]. How did you isolate the root cause and what did the fix look like?"
- "When you implemented [feature/module], what was the hardest part technically? What would you do differently today?"
- "This role requires [JD skill]. Walk me through a real situation where you applied this — what was the context, what did you build, and what was the outcome?"

EXPECTED ANSWER DEPTH:
A strong Medium-level answer covers: the specific context (project/team/scale), the exact technical problem or decision point, at least one alternative they consciously ruled out, the solution they implemented, and either the outcome or a reflection on what they'd improve. 2–3 minutes of concrete, specific detail is expected.

EXAMPLE MEDIUM QUESTION:
BAD (too surface): "Have you worked with REST APIs? What are they?"
ALSO BAD (too deep): "Design a globally distributed API gateway for 100M requests/day."
GOOD: "In your [project or role], you built or consumed REST APIs. Walk me through one specific API design decision you made — for example, how you handled authentication, versioning, or error responses — and why you made that choice."
"""

    # ── Question generation requirements block ───────────────────────────────
    if focus_areas and focus_areas.strip():
        focus_mode = "strictly" if strict_focus else "primarily"
        question_requirements_block = f"""======================================================================
RECRUITER FOCUS AREAS (ACTIVE — Treat as Primary Evaluation Criteria)
======================================================================
The recruiter has specified the following focus areas for this interview:
{focus_areas}

Instructions:
- Recruiter Focus Areas are active and should be treated as the PRIMARY evaluation criteria.
- Most interview questions should directly and deeply evaluate the specified topics.
- Use the Job Description, Candidate Resume, and real-world technical scenarios to generate supporting and follow-up questions where appropriate.
- Questions should remain role-relevant, technically deep, and capable of differentiating candidate skill levels.
- Ensure questions cover various aspects of the focus areas: implementation details, design trade-offs, debugging, best practices, and real-world usage.
- Do NOT pad with generic behavioral or unrelated questions.
- {'Strictly limit questions to the focus areas. Only diverge if the JD or resume provides strong reason to do so.' if strict_focus else 'You may include a few resume-specific or JD-specific questions where they strongly complement the focus areas.'}"""
    else:
        # Add headroom within each batch for dedup safety
        # (_jd_count and _res_count already computed above)
        _jd_req = _jd_count + 2 if _jd_count > 0 else 0
        _res_req = _res_count + 2 if _res_count > 0 else 0
        # Update total request count to match
        request_count = _jd_req + _res_req


        if _res_count == 0:
            _dist_note = (
                f"DISTRIBUTION: Generate exactly {_jd_req} JD-based questions (BATCH A). "
                f"No resume-only questions are required."
            )
        else:
            _dist_note = (
                f"DISTRIBUTION: Generate exactly {_jd_req} JD-based questions first (BATCH A), "
                f"then exactly {_res_req} Resume-based questions (BATCH B). "
                f"BOTH BATCHES ARE MANDATORY. The final output MUST contain questions from both batches."
            )

        _batch_b_block = "" if _res_count == 0 else f"""
BATCH B — RESUME-BASED QUESTIONS (Generate exactly {_res_req} questions)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
These questions MUST reference the candidate's ACTUAL resume content.
Tag each question with: "source": "resume"

Sub-types to use (pick the best fit for each slot):

  RESUME-PROJECT DEEP DIVE:
    Reference a specific project, tool, or technology from the candidate's resume.
    Ask about real implementation choices, trade-offs, bugs, or architecture decisions.
    GOOD: "In your [Project Name] project you used [Technology]. Describe a specific
          technical challenge you hit and how you resolved it."
    BAD:  Any question that does not name a specific resume item.

  RESUME + JD OVERLAP (best opportunity):
    When a candidate skill overlaps with a JD requirement, combine both.
    GOOD: "Your resume shows experience with [Candidate Skill]. This role requires [JD Skill].
          How would you apply your [Candidate Skill] background to satisfy this JD requirement?"
"""

        question_requirements_block = f"""======================================================================
QUESTION GENERATION REQUIREMENTS — READ CAREFULLY AND FOLLOW EXACTLY
======================================================================

{_dist_note}

You MUST return questions in TWO clearly separated batches in the JSON output.
Batch A items come first, Batch B items come after. Do NOT mix them.

BATCH A — JD-BASED QUESTIONS (Generate exactly {_jd_req} questions)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
These questions must be grounded in the Job Description skills and requirements.
Tag each question with: "source": "jd"

Sub-types to use (distribute across the {_jd_req} slots):

  JD SKILL DEEP DIVE (use for most slots):
    Ask about must-have or good-to-have JD skills — implementation details,
    architecture decisions, real-world usage, debugging, and trade-offs.
    GOOD: "This role requires expertise in [JD Skill]. Describe how you have used it
          in a production context — what design decisions did you make and why?"

  TECHNICAL SCENARIO (use for 1–2 slots):
    A real-world problem the candidate would face in this role.
    GOOD: "Your [JD technology] service starts failing under load. Walk me through
          your complete debugging and resolution process from alert to fix."
{_batch_b_block}
======================================================================
CRITICAL OUTPUT RULES
======================================================================
1. Total questions to generate: {request_count} ({_jd_req} JD + {_res_req} Resume)
2. BATCH B IS MANDATORY — if resume content exists, you MUST generate {_res_req} resume-based questions.
3. Every resume-based question MUST name a specific project, company, tool, or technology from the candidate's resume data provided above.
4. JD questions must NOT reference resume-specific content (they should be answerable by any qualified candidate).
5. Resume questions MUST be personalized — a generic question that could apply to any candidate is WRONG.
"""

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

{question_requirements_block}

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
9. NO VERSION LISTS: NEVER include raw version numbers or slash-separated version lists in questions. Write "Java" not "Java 8/11/17". Write "Spring Boot" not "Spring Boot 2.x/3.x". Write "Python" not "Python 3.8/3.10/3.11". If version-specific knowledge is genuinely needed, ask which version they have used — do NOT list versions yourself.

======================================================================
OUTPUT FORMAT
======================================================================
Return ONLY a JSON array of EXACTLY {request_count} objects.
Batch A (JD) questions come first, Batch B (Resume) questions come last:
[{{{{
  "text": "<detailed technical question>",
  "type": "technical",
  "duration": {default_duration},
  "source": "jd"   (use "jd" for Batch A questions, "resume" for Batch B questions)
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

        # Trim to requested count, respecting JD/resume split
        if len(questions) > question_count:
            # The LLM was told to output Batch A (JD) first, Batch B (Resume) last.
            # Honour the split: take _jd_count from the front, _res_count from the back.
            jd_qs = [q for q in questions if q.get("source") != "resume"][:_jd_count]
            res_qs = [q for q in questions if q.get("source") == "resume"][:_res_count]
            if len(jd_qs) < _jd_count:
                # Fallback: fill remaining JD slots from unlabelled front
                extra = [q for q in questions if q not in jd_qs and q not in res_qs]
                jd_qs += extra[:_jd_count - len(jd_qs)]
            questions = jd_qs + res_qs
        if len(questions) < question_count:
            questions += get_fallback_questions(question_count - len(questions), role, difficulty)

        # Normalize fields
        for q in questions:
            q["text"] = _strip_version_lists(q["text"].strip())
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
    time_limit: Optional[int] = None
    focus_areas: Optional[str] = None
    strict_focus: Optional[bool] = False


@router.post("/invite")
async def invite_ai_interviews(
    background_tasks: BackgroundTasks,
    body: InterviewInviteRequest,
    user: ClerkUser = Depends(require_user),
):
    db = get_db_admin_service()
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

    if body.time_limit is not None:
        calculated_time_limit = body.time_limit
    else:
        # Calculate default: exactly 2 minutes per question for response time
        calculated_time_limit = requested_count * 2
        if calculated_time_limit < 2:
            calculated_time_limit = 2

    from app.services.email_queue import email_queue as _email_queue, Priority

    async def _process_candidate(c: dict) -> tuple:
        """Process a single candidate: generate questions, create session, enqueue email.
        Returns (success: bool, candidate_id: str, error: str|None).
        """
        cid = c.get("id") if isinstance(c, dict) else None
        if not cid:
            return (False, str(cid), "missing candidate id")
        token = secrets.token_urlsafe(32)
        session_id = str(uuid.uuid4())

        try:
            questions_raw = await generate_interview_questions(
                openai,
                job,
                c.get("resume_parsed_data") if isinstance(c, dict) else None,
                requested_count,
                difficulty,
                focus_areas=body.focus_areas or "",
                strict_focus=bool(body.strict_focus),
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
            proctoring_data["time_limit_minutes"] = calculated_time_limit
            if body.focus_areas and body.focus_areas.strip():
                proctoring_data["focus_areas"] = body.focus_areas.strip()
                proctoring_data["strict_focus"] = bool(body.strict_focus)

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

            # Fractional billing: bill +0.25 for interview invite.
            try:
                from app.utils.billing_helpers import consume_company_member_slot as _consume_interview
                await _consume_interview(db, user.id, 0.50, "interview sent",
                    candidate_id=cid, job_id=body.job_id)
            except Exception as _bill_exc:
                logger.warning("[ai_interview.invite] billing interview slot failed session=%s: %s", session_id, _bill_exc)

            # Email is non-blocking — routed through the async queue
            try:
                interview_link = f"{str(settings.frontend_url).rstrip('/')}/ai-interview/{token}"
                recipient_email = str(c.get("email") or "").strip()
                if not recipient_email:
                    raise RuntimeError("Candidate email is missing")
                html, text, subject = _email_queue.build_interview_invite(
                    candidate_name=str(c.get("full_name") or "Candidate"),
                    job_title=str(job.get("title") or ""),
                    interview_link=interview_link,
                    scheduled_time=body.scheduled_time,
                )
                await _email_queue.enqueue(
                    to_email=recipient_email,
                    subject=subject,
                    html_body=html,
                    text_body=text,
                    priority=Priority.HIGH,
                    idempotency_key=f"ai_interview:{session_id}",
                )
                proctoring_data["invite_delivery"] = {"status": "queued", "queued_at": _utc_now_iso()}
            except Exception as e:
                logger.error("[ai_interview.invite] EMAIL FAILED session=%s to=%s error=%s", session_id, c.get("email"), str(e))
                proctoring_data["invite_delivery"] = {"status": "failed", "failed_at": _utc_now_iso(), "error": str(e)}

            await db.run(
                lambda: db.client.from_("ai_interview_sessions")
                .update({"proctoring_data": proctoring_data, "updated_at": _utc_now_iso()})
                .eq("id", session_id)
                .execute()
            )

            return (True, str(cid), None)
        except Exception as e:
            logger.error("[ai_interview.invite] candidate_failed candidate_id=%s error=%s", cid, str(e))
            return (False, str(cid), str(e))

    # Run all candidates in parallel — LLM semaphore caps actual concurrency
    results = await asyncio.gather(
        *[_process_candidate(c) for c in candidates],
        return_exceptions=True,
    )

    invites_sent = sum(1 for r in results if isinstance(r, tuple) and r[0])
    failed_ids = [
        r[1] for r in results
        if isinstance(r, tuple) and not r[0]
    ]

    background_tasks.add_task(
        lambda: None  # kept for router signature compatibility
    )

    return ok({
        "success": True,
        "invites_sent": invites_sent,
        "failed": failed_ids,
        "failed_reasons": {},
        "status": "processing"
    })


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
    pd = session.get("proctoring_data") or {}
    time_limit_minutes = pd.get("time_limit_minutes")

    return ok(
        {
            "session_id": session.get("id"),
            "candidate_name": cand.get("full_name"),
            "job_title": job.get("title"),
            "total_questions": len(questions),
            "estimated_duration_minutes": time_limit_minutes or ((len(questions) or 5) * 3),
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

from fastapi import UploadFile, File

@router.post("/{session_id}/screenshot")
async def upload_screenshot(
    session_id: str,
    file: UploadFile = File(...)
):
    from app.database.supabase_client import get_supabase_admin_client
    supabase = get_supabase_admin_client()
    
    file_bytes = await file.read()
    path = f"ai_interview/{session_id}/latest.jpg"
    
    try:
        supabase.storage.from_("session-screenshots").upload(
            path,
            file_bytes,
            file_options={"content-type": "image/jpeg", "upsert": "true"}
        )
        return ok({"success": True, "path": path})
    except Exception as e:
        try:
            supabase.storage.from_("session-screenshots").update(
                path,
                file_bytes,
                file_options={"content-type": "image/jpeg", "upsert": "true"}
            )
            return ok({"success": True, "path": path})
        except Exception as e2:
            return api_error(message=str(e2), status_code=500)

