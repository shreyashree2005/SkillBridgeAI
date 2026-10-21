"""
Career planning: skill-gap analysis, learning roadmaps and skill recommendations.
All three are transparent rule-based / statistical algorithms.
"""
from __future__ import annotations

import heapq

from ..taxonomy import Role, get_taxonomy
from .corpus import get_corpus

LEVEL_CREDIT = {"beginner": 0.6, "intermediate": 0.85, "advanced": 1.0, "expert": 1.0}
IMPLIED_CREDIT = 0.5  # known only via a more advanced skill (e.g. SQL via PostgreSQL)
BASE_HOURS = {3: 30, 2: 20, 1: 12}  # learning effort by role weight when no course is available
PREREQ_HOURS = 15


class UnknownRoleError(ValueError):
    pass


def _role(target_role: str) -> Role:
    tax = get_taxonomy()
    role = tax.find_role(target_role)
    if not role:
        raise UnknownRoleError(f"Unknown role '{target_role}'. Available: {', '.join(sorted(tax.roles))}")
    return role


def _normalise(skills: list[dict]) -> dict[str, str]:
    """[{name, level}] → {canonical name: level} keeping the highest level."""
    tax = get_taxonomy()
    order = list(LEVEL_CREDIT)
    out: dict[str, str] = {}
    for s in skills or []:
        name = tax.canonical(s.get("name", "") if isinstance(s, dict) else str(s))
        level = (s.get("level") if isinstance(s, dict) else None) or "intermediate"
        level = level if level in LEVEL_CREDIT else "intermediate"
        if name and (name not in out or order.index(level) > order.index(out[name])):
            out[name] = level
    return out


# ------------------------------------------------------------- skill gap
def skill_gap(skills: list[dict], target_role: str) -> dict:
    tax = get_taxonomy()
    role = _role(target_role)
    known = _normalise(skills)
    implied = tax.implied_skills(set(known))

    matched, weak, missing = [], [], []
    earned = possible = 0.0
    for name, weight in sorted(role.skills.items(), key=lambda kv: -kv[1]):
        possible += weight
        category = tax.skills[name].category if name in tax.skills else "other"
        if name in known:
            credit = LEVEL_CREDIT[known[name]]
            earned += weight * credit
            entry = {"skill": name, "weight": weight, "level": known[name], "category": category}
            (weak if known[name] == "beginner" and weight >= 2 else matched).append(entry)
        elif name in implied:
            earned += weight * IMPLIED_CREDIT
            weak.append({"skill": name, "weight": weight, "level": "implied", "category": category})
        else:
            missing.append({"skill": name, "weight": weight, "category": category})

    coverage = round(100 * earned / possible) if possible else 0
    readiness = ("Job-ready" if coverage >= 80 else "Almost there" if coverage >= 60
                 else "Building foundations" if coverage >= 35 else "Just starting")
    core_missing = [m["skill"] for m in missing if m["weight"] == 3]
    summary = f"You cover {coverage}% of the {role.title} skill profile ({readiness.lower()})."
    if core_missing:
        summary += f" Priority gaps: {', '.join(core_missing[:4])}."
    return {
        "role": role.title,
        "description": role.description,
        "coverage": coverage,
        "readiness": readiness,
        "matched": matched,
        "weak": weak,
        "missing": missing,
        "summary": summary,
        "method": "weighted coverage of the role's skill profile (weights 1-3), with level-based partial credit",
    }


# ------------------------------------------------------------- roadmap
def _pick_course(skill: str, level: str, courses: list[dict]) -> dict | None:
    candidates = [c for c in courses if skill in get_taxonomy().canonical_list(c.get("skills", []))]
    if not candidates:
        return None
    exact = [c for c in candidates if c.get("level") == level]
    return (exact or sorted(candidates, key=lambda c: ["beginner", "intermediate", "advanced"].index(c.get("level", "beginner"))))[0]


def roadmap(skills: list[dict], target_role: str, hours_per_week: int, courses: list[dict]) -> dict:
    """
    1. Take the role's missing + weak skills.
    2. Add any prerequisites the learner lacks (transitively).
    3. Topologically sort so prerequisites always come first (Kahn's algorithm);
       among skills that are ready, pick the most important first.
    4. Estimate hours (course duration × 1.5 for practice, else a weight-based default)
       and lay the steps out on a week-by-week schedule.
    """
    tax = get_taxonomy()
    gap = skill_gap(skills, target_role)
    role = tax.roles[gap["role"]]
    known = set(_normalise(skills))
    implied = tax.implied_skills(known)

    targets: dict[str, dict] = {}
    for m in gap["missing"]:
        targets[m["skill"]] = {"reason": f"{'Core' if m['weight'] == 3 else 'Important' if m['weight'] == 2 else 'Useful'} skill for {role.title}", "weight": m["weight"], "level": "beginner"}
    for w in gap["weak"]:
        targets[w["skill"]] = {"reason": f"Strengthen — currently {w['level']}", "weight": w["weight"], "level": "intermediate"}

    # Add missing prerequisites.
    queue = list(targets)
    while queue:
        s = queue.pop()
        for p in tax.skills[s].prerequisites if s in tax.skills else []:
            if p not in known and p not in implied and p not in targets:
                targets[p] = {"reason": f"Prerequisite for {s}", "weight": role.skills.get(p, 1), "level": "beginner"}
                queue.append(p)

    # Kahn's topological sort with a priority queue (higher weight first).
    deps = {s: {p for p in (tax.skills[s].prerequisites if s in tax.skills else []) if p in targets} for s in targets}
    dependents: dict[str, set[str]] = {s: set() for s in targets}
    for s, ps in deps.items():
        for p in ps:
            dependents[p].add(s)
    ready = [(-targets[s]["weight"], s) for s, ps in deps.items() if not ps]
    heapq.heapify(ready)
    ordered = []
    while ready:
        _, s = heapq.heappop(ready)
        ordered.append(s)
        for d in dependents[s]:
            deps[d].discard(s)
            if not deps[d]:
                heapq.heappush(ready, (-targets[d]["weight"], d))
    ordered += [s for s in targets if s not in ordered]  # safety net for cycles in data

    steps, hour_cursor = [], 0.0
    for s in ordered:
        info = targets[s]
        course = _pick_course(s, info["level"], courses)
        hours = round(course["duration_hours"] * 1.5, 1) if course else (PREREQ_HOURS if info["reason"].startswith("Prerequisite") else BASE_HOURS.get(info["weight"], 12))
        start_week = int(hour_cursor // hours_per_week) + 1
        hour_cursor += hours
        end_week = max(start_week, int((hour_cursor - 0.001) // hours_per_week) + 1)
        steps.append({
            "skill": s,
            "reason": info["reason"],
            "weight": info["weight"],
            "prerequisites": [p for p in (tax.skills[s].prerequisites if s in tax.skills else [])],
            "estimated_hours": hours,
            "week_start": start_week,
            "week_end": end_week,
            "course": {"id": course["id"], "title": course["title"], "level": course.get("level")} if course else None,
            "milestone": f"Build a small project or exercise that uses {s} and add it to your portfolio.",
        })

    return {
        "role": role.title,
        "coverage": gap["coverage"],
        "hours_per_week": hours_per_week,
        "total_hours": round(hour_cursor, 1),
        "total_weeks": steps[-1]["week_end"] if steps else 0,
        "steps": steps,
        "method": "skill-gap analysis + prerequisite graph topological sort + course matching",
    }


# ------------------------------------------------------------- skill recommendations
def recommend_skills(skills: list[str], target_role: str | None, limit: int = 10) -> dict:
    """
    Content-based ranking of skills the user does not have yet:
      0.45 × importance for the target role (weight / 3)
    + 0.30 × co-occurrence with the user's skills in job postings
    + 0.15 × overall market demand (share of jobs requiring it)
    + 0.10 × readiness (are its prerequisites already known?)
    """
    tax = get_taxonomy()
    corpus = get_corpus()
    known = set(tax.canonical_list(skills))
    implied = tax.implied_skills(known)
    role = tax.find_role(target_role) if target_role else None

    scored = []
    for name, sk in tax.skills.items():
        if name in known or sk.category == "soft":
            continue
        role_w = (role.skills.get(name, 0) / 3) if role else 0.0
        cooc = corpus.cooccurrence_score(name, list(known))
        demand = corpus.demand_score(name)
        prereqs = sk.prerequisites
        readiness = 1.0 if all(p in known or p in implied for p in prereqs) else 0.3
        weights = (0.45, 0.30, 0.15, 0.10) if role else (0.0, 0.55, 0.30, 0.15)
        score = weights[0] * role_w + weights[1] * min(1.0, cooc * 2) + weights[2] * demand + weights[3] * readiness
        if score <= 0.05:
            continue
        reasons = []
        if role_w:
            reasons.append(f"{'Core' if role_w == 1 else 'Important' if role_w > 0.5 else 'Useful'} for {role.title}")
        if cooc >= 0.15:
            reasons.append(f"Often required alongside your skills ({round(cooc * 100)}% co-occurrence)")
        if demand >= 0.25:
            reasons.append(f"High demand: listed in {corpus.demand.get(name, 0)} of {corpus.job_count} job postings")
        if readiness == 1.0 and prereqs:
            reasons.append(f"You already know the prerequisites ({', '.join(prereqs)})")
        elif readiness < 1:
            reasons.append(f"Learn first: {', '.join(p for p in prereqs if p not in known and p not in implied)}")
        scored.append({"skill": name, "category": sk.category, "score": round(score * 100), "reasons": reasons})

    scored.sort(key=lambda x: -x["score"])
    return {
        "items": scored[:limit],
        "target_role": role.title if role else None,
        "method": "content-based ranking: role weights + job co-occurrence + demand + prerequisite readiness",
    }
