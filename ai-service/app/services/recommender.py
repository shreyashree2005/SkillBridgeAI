"""
Project and teammate recommendations (content-based, explainable).
"""
from __future__ import annotations

from ..taxonomy import get_taxonomy
from .corpus import get_corpus

LEVEL_WEIGHT = {"beginner": 0.6, "intermediate": 0.85, "advanced": 1.0, "expert": 1.0}
AVAILABILITY = {"full-time": 1.0, "part-time": 0.8, "weekends": 0.6, "unavailable": 0.0}


def recommend_projects(skills: list[str], interests: list[str], projects: list[dict], limit: int = 9) -> dict:
    """
    score = 0.40 × TF-IDF cosine(user profile text, project text)
          + 0.35 × share of the project's stack the user already knows
          + 0.25 × share of the project's open roles the user can fill
    """
    tax = get_taxonomy()
    corpus = get_corpus()
    known = set(tax.canonical_list(skills))
    have = known | tax.implied_skills(known)
    profile_text = " ".join(list(known) * 2 + list(interests or []))

    docs = [
        f"{p.get('title', '')} {p.get('summary', '')} {' '.join(p.get('tech_stack', [])) * 2} "
        f"{' '.join(p.get('roles_needed', [])) * 2} {p.get('description', '')}"
        for p in projects
    ]
    sims = corpus.similarity_many(profile_text, docs)
    max_sim = float(sims.max()) if len(sims) and sims.max() > 0 else 1.0

    items = []
    for p, sim in zip(projects, sims):
        stack = set(tax.canonical_list(p.get("tech_stack", [])))
        needed = set(tax.canonical_list(p.get("roles_needed", [])))
        overlap = stack & have
        fills = needed & have
        stack_share = len(overlap) / len(stack) if stack else 0.0
        fill_share = len(fills) / len(needed) if needed else 0.0
        score = 0.40 * (float(sim) / max_sim) + 0.35 * stack_share + 0.25 * fill_share
        if score <= 0.05:
            continue
        reasons = []
        if fills:
            reasons.append(f"The team needs {', '.join(sorted(fills))} — you have it")
        if overlap:
            reasons.append(f"You know {len(overlap)}/{len(stack)} of the stack ({', '.join(sorted(overlap)[:4])})")
        learn = sorted(stack - have)[:3]
        if learn:
            reasons.append(f"You'd learn: {', '.join(learn)}")
        items.append({
            "id": p["id"], "score": round(score * 100), "matched_skills": sorted(overlap | fills),
            "fills_roles": sorted(fills), "reasons": reasons,
        })
    items.sort(key=lambda x: -x["score"])
    return {"items": items[:limit], "method": "content-based: TF-IDF similarity + skill overlap + open-role fit"}


def recommend_teammates(project: dict, candidates: list[dict], limit: int = 10) -> dict:
    """
    Greedy complementary-skills selection:
      1. The project's needs = roles needed ∪ (tech stack − skills the team already has).
      2. Each candidate covers some needs (weighted by their skill level).
      3. Pick the best candidate, then re-score the rest on the needs still uncovered,
         so the list suggests a complementary team rather than ten copies of one profile.
    Final score also considers availability (15%) and mentor rating (10%).
    """
    tax = get_taxonomy()
    member_skills = set(tax.canonical_list(project.get("member_skills", [])))
    needed_roles = set(tax.canonical_list(project.get("roles_needed", [])))
    stack = set(tax.canonical_list(project.get("tech_stack", [])))
    needs = needed_roles | (stack - member_skills)
    if not needs:
        needs = stack or needed_roles

    profiles = []
    for c in candidates:
        levels = {}
        for s in c.get("skills", []):
            name = tax.canonical(s["name"] if isinstance(s, dict) else s)
            levels[name] = LEVEL_WEIGHT.get(s.get("level", "intermediate") if isinstance(s, dict) else "intermediate", 0.85)
        profiles.append((c, levels))

    remaining = set(needs)
    picked, results = set(), []
    while len(results) < limit and len(picked) < len(profiles):
        best, best_score, best_cover = None, -1.0, set()
        for i, (c, levels) in enumerate(profiles):
            if i in picked:
                continue
            target = remaining or needs
            cover = {n for n in target if n in levels}
            coverage = sum(levels[n] * (1.5 if n in needed_roles else 1.0) for n in cover) / max(1, len(target))
            redundancy = len(set(levels) & member_skills) / max(1, len(levels))
            score = (0.65 * min(1.0, coverage * 1.5) + 0.15 * AVAILABILITY.get(c.get("availability"), 0.7)
                     + 0.10 * (float(c.get("rating") or 0) / 5) + 0.10 * (1 - redundancy))
            if score > best_score:
                best, best_score, best_cover = i, score, cover
        if best is None:
            break
        picked.add(best)
        c, levels = profiles[best]
        if not best_cover and results:
            break  # nobody else adds anything new
        remaining -= best_cover
        reasons = []
        if best_cover:
            reasons.append(f"Covers {', '.join(sorted(best_cover))}")
        if c.get("availability") in ("full-time", "part-time"):
            reasons.append(f"Available {c['availability']}")
        if float(c.get("rating") or 0) >= 4:
            reasons.append(f"Rated {c['rating']}★ as a mentor")
        results.append({"id": c["id"], "score": round(best_score * 100), "covers": sorted(best_cover), "reasons": reasons})

    return {
        "items": results,
        "needs": sorted(needs),
        "uncovered": sorted(remaining),
        "method": "greedy complementary-skill coverage + availability + rating",
    }
