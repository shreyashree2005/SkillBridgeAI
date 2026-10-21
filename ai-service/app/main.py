"""
SkillBridge AI — AI service (FastAPI).

Stateless HTTP API used only by the Node.js server. It never touches the
database: the server sends the data each algorithm needs.

Run:  uvicorn app.main:app --port 8000 --reload   (from ai-service/)
Docs: http://localhost:8000/docs
"""
from __future__ import annotations

import hmac
import logging
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from pydantic import BaseModel, Field

from .config import settings
from .services import assistant, career, interview, llm, matcher, recommender, resume_parser
from .services.corpus import get_corpus
from .taxonomy import get_taxonomy

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("ai-service")

if settings.environment == "production" and not settings.service_key:
    raise RuntimeError("AI_SERVICE_KEY must be set in production")


def require_key(x_internal_key: str | None = Header(default=None)):
    """Only the SkillBridge server (which knows the shared secret) may call this service."""
    if settings.service_key and not hmac.compare_digest(x_internal_key or "", settings.service_key):
        raise HTTPException(status_code=401, detail="Invalid or missing internal service key")


@asynccontextmanager
async def lifespan(_app):
    # Load the taxonomy and fit the TF-IDF corpus once at startup.
    tax, corpus = get_taxonomy(), get_corpus()
    log.info("Loaded %d skills, %d roles, %d interview questions; job corpus: %d postings; LLM provider: %s",
             len(tax.skills), len(tax.roles), len(tax.questions), corpus.job_count, llm.provider_label())
    yield


app = FastAPI(
    lifespan=lifespan,
    title="SkillBridge AI Service",
    version="1.0.0",
    description="Resume analysis, matching, recommendations, roadmaps, interview practice and a career assistant.",
)
protected = [Depends(require_key)]



# ------------------------------------------------------------------ schemas
Str = Field(default="", max_length=20000)


class SkillLevel(BaseModel):
    name: str = Field(max_length=80)
    level: str = "intermediate"


class Candidate(BaseModel):
    skills: list[str] = Field(default_factory=list, max_length=200)
    text: str = Field(default="", max_length=100000)
    years_experience: float = Field(default=0, ge=0, le=60)


class JobIn(BaseModel):
    title: str = Field(default="", max_length=200)
    description: str = Field(default="", max_length=20000)
    required_skills: list[str] = Field(default_factory=list, max_length=100)
    nice_to_have_skills: list[str] = Field(default_factory=list, max_length=100)
    min_years: float = Field(default=0, ge=0, le=40)


class MatchIn(BaseModel):
    candidate: Candidate
    job: JobIn


class GapIn(BaseModel):
    skills: list[SkillLevel] = Field(default_factory=list, max_length=200)
    target_role: str = Field(min_length=2, max_length=80)


class CourseIn(BaseModel):
    id: str
    title: str
    skills: list[str] = Field(default_factory=list)
    level: str = "beginner"
    duration_hours: float = 1


class RoadmapIn(GapIn):
    hours_per_week: int = Field(default=8, ge=1, le=60)
    courses: list[CourseIn] = Field(default_factory=list, max_length=2000)


class RecommendSkillsIn(BaseModel):
    skills: list[str] = Field(default_factory=list, max_length=200)
    target_role: str | None = None
    limit: int = Field(default=10, ge=1, le=50)


class ProjectIn(BaseModel):
    id: str
    title: str = ""
    summary: str = ""
    description: str = Field(default="", max_length=6000)
    tech_stack: list[str] = Field(default_factory=list)
    roles_needed: list[str] = Field(default_factory=list)
    difficulty: str | None = None


class RecommendProjectsIn(BaseModel):
    skills: list[str] = Field(default_factory=list, max_length=200)
    interests: list[str] = Field(default_factory=list, max_length=50)
    projects: list[ProjectIn] = Field(default_factory=list, max_length=1000)
    limit: int = Field(default=9, ge=1, le=50)


class TeamProject(BaseModel):
    title: str = ""
    description: str = ""
    tech_stack: list[str] = Field(default_factory=list)
    roles_needed: list[str] = Field(default_factory=list)
    member_skills: list[str] = Field(default_factory=list)


class TeamCandidate(BaseModel):
    id: str
    skills: list[SkillLevel] = Field(default_factory=list)
    availability: str | None = None
    rating: float = 0


class RecommendTeammatesIn(BaseModel):
    project: TeamProject
    candidates: list[TeamCandidate] = Field(default_factory=list, max_length=2000)
    limit: int = Field(default=10, ge=1, le=50)


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=8000)


class AssistantIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    history: list[ChatTurn] = Field(default_factory=list, max_length=50)
    context: dict = Field(default_factory=dict)


class QuestionsIn(BaseModel):
    role: str = Field(min_length=2, max_length=80)
    skills: list[str] = Field(default_factory=list, max_length=200)
    count: int = Field(default=5, ge=1, le=15)
    exclude: list[str] = Field(default_factory=list, max_length=200)
    seed: int | None = None


class EvaluateIn(BaseModel):
    qid: str = Field(min_length=1, max_length=40)
    answer: str = Field(min_length=1, max_length=5000)


# ------------------------------------------------------------------ routes
@app.get("/health")
def health():
    tax = get_taxonomy()
    return {"status": "ok", "skills": len(tax.skills), "roles": len(tax.roles), "questions": len(tax.questions),
            "job_corpus": get_corpus().job_count, "llm_provider": llm.provider_label()}


@app.get("/roles", dependencies=protected)
def roles():
    return {"roles": [{"title": r.title, "description": r.description, "skills": r.skills} for r in get_taxonomy().roles.values()]}


@app.post("/resume/parse", dependencies=protected)
async def parse_resume(file: UploadFile = File(...)):
    limit = int(settings.max_upload_mb * 1024 * 1024)
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(status_code=400, detail="File is too large")
    try:
        return resume_parser.analyse_file(data, file.filename or "resume.txt")
    except resume_parser.ResumeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/match", dependencies=protected)
def match(body: MatchIn):
    return matcher.match(body.candidate.model_dump(), body.job.model_dump())


@app.post("/skill-gap", dependencies=protected)
def skill_gap(body: GapIn):
    try:
        return career.skill_gap([s.model_dump() for s in body.skills], body.target_role)
    except career.UnknownRoleError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/roadmap", dependencies=protected)
def roadmap(body: RoadmapIn):
    try:
        return career.roadmap([s.model_dump() for s in body.skills], body.target_role, body.hours_per_week,
                              [c.model_dump() for c in body.courses])
    except career.UnknownRoleError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/recommend/skills", dependencies=protected)
def recommend_skills(body: RecommendSkillsIn):
    return career.recommend_skills(body.skills, body.target_role, body.limit)


@app.post("/recommend/projects", dependencies=protected)
def recommend_projects(body: RecommendProjectsIn):
    return recommender.recommend_projects(body.skills, body.interests, [p.model_dump() for p in body.projects], body.limit)


@app.post("/recommend/teammates", dependencies=protected)
def recommend_teammates(body: RecommendTeammatesIn):
    return recommender.recommend_teammates(body.project.model_dump(), [c.model_dump() for c in body.candidates], body.limit)


@app.post("/assistant", dependencies=protected)
def chat(body: AssistantIn):
    return assistant.respond(body.message, [t.model_dump() for t in body.history], body.context)


@app.post("/interview/questions", dependencies=protected)
def interview_questions(body: QuestionsIn):
    return interview.select_questions(body.role, body.skills, body.count, body.exclude, body.seed)


@app.post("/interview/evaluate", dependencies=protected)
def interview_evaluate(body: EvaluateIn):
    try:
        return interview.evaluate(body.qid, body.answer)
    except interview.UnknownQuestionError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
