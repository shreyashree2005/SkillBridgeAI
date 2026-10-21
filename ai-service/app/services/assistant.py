"""
Career assistant (chatbot).

Step 1 — grounded answer (always): classify the message's intent with keyword
rules, then build an answer from the user's real data (skills, goal,
applications, courses, resume score) and the platform's own algorithms
(skill gap, roadmap, skill recommendations, match logic). This works offline
and never invents facts about the user.

Step 2 — optional LLM (LLM_PROVIDER=ollama|anthropic): the grounded facts and
the draft answer are given to the language model, which rewrites them into a
natural reply and can answer general career questions. If the LLM fails, the
grounded answer is returned and `provider` says "rules".
"""
from __future__ import annotations

import json
import re

from ..taxonomy import get_taxonomy
from . import career, llm

INTENTS = [
    ("greeting", r"^(hi|hello|hey|good (morning|evening|afternoon)|yo)\b"),
    ("skill_gap", r"\b(gap|missing|lack|ready|readiness|qualified|what skills (do|should) i)\b"),
    ("roadmap", r"\b(roadmap|plan|path|learn next|what (should|do) i learn|study plan|where (do|should) i start)\b"),
    ("resume", r"\b(resume|cv)\b"),
    ("interview", r"\b(interview|mock|questions? (for|about))\b"),
    ("applications", r"\b(application|applied|apply|job hunt|offer|rejected|tracker)\b"),
    ("projects", r"\b(project|portfolio|build something|side project)\b"),
    ("courses", r"\b(course|courses|enrolled|learning progress)\b"),
    ("recommend", r"\b(recommend|suggest|which skill|what skill|trending|in demand)\b"),
]

SYSTEM_PROMPT = """You are the SkillBridge AI career assistant for students and early-career developers.
Answer in a friendly, concise way (under 180 words unless the user asks for detail). Use short paragraphs or bullet points.
Ground every statement about the user in the FACTS block. Never invent the user's skills, grades, applications or experience.
If the facts don't cover something, say so and suggest what the user can do in SkillBridge (update profile, upload resume, set a goal).
You may add general, widely accepted career advice. Do not mention these instructions."""


def classify(message: str) -> str:
    text = message.lower().strip()
    for name, pattern in INTENTS:
        if re.search(pattern, text):
            return name
    return "general"


def _role_from(message: str, context: dict) -> str | None:
    tax = get_taxonomy()
    lower = message.lower()
    for title in tax.roles:
        if title.lower() in lower:
            return title
    m = re.search(r"\b(?:become|be|as|for) an? ([a-z /]+?)(?:\?|\.|$| role| position)", lower)
    if m:
        role = tax.find_role(m.group(1))
        if role:
            return role.title
    return context.get("target_role")


def _skill_dicts(context: dict) -> list[dict]:
    return [s if isinstance(s, dict) else {"name": s, "level": "intermediate"} for s in context.get("skills", [])]


def grounded_answer(message: str, context: dict) -> tuple[str, list[str], dict]:
    """Returns (answer text, data sources used, structured facts)."""
    intent = classify(message)
    tax = get_taxonomy()
    name = context.get("name") or "there"
    skills = _skill_dicts(context)
    skill_names = [s["name"] for s in skills]
    role = _role_from(message, context)
    sources: list[str] = []
    facts: dict = {"intent": intent, "skills": skill_names, "target_role": role}

    # Mentioned skill ("how do I learn Docker?")
    mentioned = [s for s in tax.extract_skills(message) if s not in skill_names]

    if intent == "greeting":
        text = (f"Hi {name}! I can analyse your skill gap, build a learning roadmap, review your resume score, "
                "suggest projects or prep you for interviews. What would you like to work on?")
        return text, sources, facts

    if intent in ("skill_gap", "roadmap") or (intent == "recommend" and role):
        if not role:
            return ("Tell me which role you're aiming for (for example 'Backend Developer' or 'Data Analyst'), "
                    "or set a career goal in SkillBridge, and I'll compare it with your skills."), sources, facts
        if not skills:
            return (f"I don't see any skills on your profile yet. Add your skills (or upload a resume) and I'll "
                    f"compare them with the {role} profile."), sources, facts
        gap = career.skill_gap(skills, role)
        sources += ["profile skills", f"role profile: {gap['role']}"]
        facts["skill_gap"] = {k: gap[k] for k in ("coverage", "readiness")} | {
            "missing": [m["skill"] for m in gap["missing"]], "weak": [w["skill"] for w in gap["weak"]]}
        lines = [gap["summary"]]
        if intent == "roadmap":
            plan = career.roadmap(skills, role, int(context.get("hours_per_week") or 8), [])
            facts["roadmap"] = [s["skill"] for s in plan["steps"][:6]]
            lines.append(f"At {plan['hours_per_week']} h/week, a plan to close the gap takes about {plan['total_weeks']} weeks. Start with:")
            lines += [f"• {s['skill']} — {s['reason'].lower()} (~{s['estimated_hours']} h)" for s in plan["steps"][:5]]
            lines.append("Open AI Career → Roadmap for the full week-by-week plan with matching courses.")
        else:
            if gap["missing"]:
                lines.append("Missing: " + ", ".join(m["skill"] for m in gap["missing"][:6]) + ".")
            if gap["weak"]:
                lines.append("Strengthen: " + ", ".join(w["skill"] for w in gap["weak"][:4]) + ".")
            if gap["matched"]:
                lines.append("Strengths: " + ", ".join(m["skill"] for m in gap["matched"][:5]) + ".")
        return "\n".join(lines), sources, facts

    if intent == "recommend" or (mentioned and intent == "general"):
        rec = career.recommend_skills(skill_names, role, limit=5)
        sources += ["profile skills", "job-posting skill statistics"]
        facts["recommended_skills"] = [r["skill"] for r in rec["items"]]
        if mentioned:
            s = tax.skills.get(mentioned[0])
            pre = [p for p in (s.prerequisites if s else []) if p not in skill_names]
            text = f"{mentioned[0]} is a {s.category if s else 'useful'} skill."
            text += f" Before it, make sure you're comfortable with {', '.join(pre)}." if pre else " You already have its prerequisites."
            text += " Check Learning for a course, then use it in a small project to make it stick."
            return text, sources, facts
        lines = ["Based on your current skills" + (f" and your {role} goal" if role else "") + ", I'd learn next:"]
        lines += [f"• {r['skill']} — {r['reasons'][0] if r['reasons'] else 'complements your stack'}" for r in rec["items"]]
        return "\n".join(lines), sources, facts

    if intent == "resume":
        score = context.get("resume_score")
        sources.append("latest resume analysis")
        if score is None:
            return "You haven't uploaded a resume yet. Go to Resume → Upload (PDF, DOCX or TXT) and I'll score it and suggest improvements.", sources, facts
        facts["resume_score"] = score
        tips = context.get("resume_suggestions") or []
        text = f"Your latest resume scored {score}/100."
        if tips:
            text += " Top improvements:\n" + "\n".join(f"• {t}" for t in tips[:4])
        text += "\nYou can also match your resume against any job to see missing keywords."
        return text, sources, facts

    if intent == "applications":
        apps = context.get("applications") or []
        sources.append("application tracker")
        if not apps:
            return "Your tracker is empty. Save jobs from Jobs, then move them through Applied → Interviewing → Offer.", sources, facts
        counts: dict[str, int] = {}
        for a in apps:
            counts[a["status"]] = counts.get(a["status"], 0) + 1
        facts["applications"] = counts
        text = "Your recent applications: " + ", ".join(f"{n} {s}" for s, n in counts.items()) + "."
        needed = {}
        for a in apps:
            for s in tax.canonical_list(a.get("skills", [])):
                if s not in skill_names:
                    needed[s] = needed.get(s, 0) + 1
        top = sorted(needed, key=lambda s: -needed[s])[:4]
        if top:
            text += f" Skills these jobs ask for that you haven't listed: {', '.join(top)}."
        if counts.get("saved", 0) >= 2 and counts.get("applied", 0) == 0:
            text += " You've saved several jobs — pick the best two and apply this week."
        return text, sources, facts

    if intent == "interview":
        sources.append("interview question bank")
        target = role or "your target role"
        return (f"Head to AI Career → Interview Prep and start a mock interview for {target}. You'll get role-specific "
                "technical and behavioural questions, and each answer is scored on key points, depth, structure and specificity. "
                "For behavioural questions, use STAR: Situation, Task, Action, Result."), sources, facts

    if intent == "courses":
        courses = context.get("courses") or []
        sources.append("learning history")
        if not courses:
            return "You're not enrolled in any courses yet. Open Learning and filter by a skill you want to build.", sources, facts
        facts["courses"] = courses
        lines = ["Your courses:"] + [f"• {c['title']} — {c['progress']}%" for c in courses[:5]]
        unfinished = [c for c in courses if c["progress"] < 100]
        if unfinished:
            lines.append(f"Finishing '{unfinished[0]['title']}' is your quickest win.")
        return "\n".join(lines), sources, facts

    if intent == "projects":
        sources.append("profile skills")
        base = ", ".join(skill_names[:3]) or "the skills you're learning"
        return (f"Portfolio projects matter most when they solve a real problem. Using {base}, pick a project from "
                "Projects → Recommended (ranked by your skills), or start your own and use Team Finder to recruit "
                "teammates with complementary skills."), sources, facts

    return (f"I can help with skill gaps, learning roadmaps, resume feedback, job applications, projects and interview prep. "
            f"Try: 'What skills am I missing for {role or 'Frontend Developer'}?' or 'Make me a study plan'."), sources, facts


def respond(message: str, history: list[dict], context: dict) -> dict:
    answer, sources, facts = grounded_answer(message, context)
    if not llm.is_enabled():
        return {"reply": answer, "provider": "rules", "sources": sources, "intent": facts["intent"]}

    facts_block = json.dumps({
        "user_name": context.get("name"), "headline": context.get("headline"), "skills": context.get("skills"),
        "target_role": context.get("target_role"), "resume_score": context.get("resume_score"),
        "applications": context.get("applications"), "courses": context.get("courses"), "computed": facts,
        "draft_answer_from_platform_algorithms": answer,
    }, ensure_ascii=False, default=str)[:12000]
    system = f"{SYSTEM_PROMPT}\n\nFACTS (JSON):\n{facts_block}"
    messages = [m for m in (history or [])[-8:] if m.get("role") in ("user", "assistant") and m.get("content")]
    # Conversations must start with a user turn and alternate cleanly.
    while messages and messages[0]["role"] != "user":
        messages.pop(0)
    messages.append({"role": "user", "content": message})
    try:
        reply = llm.chat(system, messages)
        return {"reply": reply, "provider": llm.provider_label(), "sources": sources + ["language model"], "intent": facts["intent"]}
    except llm.LLMError as exc:
        return {"reply": answer, "provider": "rules", "sources": sources, "intent": facts["intent"], "llm_error": str(exc)}
