"""
Resume ↔ job match score (weighted, rule-based — not a trained model).

score = 50% required-skill coverage
      + 15% nice-to-have coverage
      + 15% experience fit
      + 20% text similarity (TF-IDF cosine, fitted on the job corpus)

Skills are compared after normalising aliases ("ReactJS" → React). Knowing a
skill also counts for its prerequisites (PostgreSQL ⇒ SQL); these are shown
separately as "inferred" so the result stays explainable. When a component
does not apply (e.g. the job lists no nice-to-have skills) its weight is
redistributed proportionally across the remaining components.
"""
from __future__ import annotations

import re

from ..taxonomy import get_taxonomy
from .corpus import get_corpus

WEIGHTS = {"required": 50, "nice_to_have": 15, "experience": 15, "similarity": 20}
REQ_HEADINGS = re.compile(r"(requirements|qualifications|must have|what you.ll need|you have|required)", re.IGNORECASE)
NICE_HEADINGS = re.compile(r"(nice to have|bonus|preferred|good to have|plus)", re.IGNORECASE)
SIMILARITY_SATURATION = 0.45  # cosine ≥ this counts as a full text-similarity score


def _skills_from_description(description: str) -> tuple[list[str], list[str]]:
    """When a job has no structured skill lists, extract them from its text."""
    tax = get_taxonomy()
    required, nice, mode = [], [], None
    for line in description.splitlines():
        if NICE_HEADINGS.search(line) and len(line.split()) <= 6:
            mode = "nice"
        elif REQ_HEADINGS.search(line) and len(line.split()) <= 6:
            mode = "req"
        for s in tax.extract_skills(line):
            target = nice if mode == "nice" else required
            if s not in required and s not in nice:
                target.append(s)
    return required, nice


def match(candidate: dict, job: dict) -> dict:
    tax = get_taxonomy()
    corpus = get_corpus()

    cand_skills = set(tax.canonical_list(candidate.get("skills", [])))
    cand_skills |= set(tax.extract_skills(candidate.get("text", "")))
    inferred = tax.implied_skills(cand_skills)
    have = cand_skills | inferred

    required = tax.canonical_list(job.get("required_skills", []))
    nice = [s for s in tax.canonical_list(job.get("nice_to_have_skills", [])) if s not in required]
    if not required and not nice:
        required, nice = _skills_from_description(job.get("description", ""))

    matched_req = [s for s in required if s in cand_skills]
    inferred_req = [s for s in required if s not in cand_skills and s in inferred]
    missing_req = [s for s in required if s not in have]
    matched_nice = [s for s in nice if s in have]
    missing_nice = [s for s in nice if s not in have]

    years = float(candidate.get("years_experience") or 0)
    min_years = float(job.get("min_years") or 0)
    sim = corpus.similarity(candidate.get("text", ""), f"{job.get('title', '')}\n{job.get('description', '')}")

    components = {}
    if required:
        components["required"] = (len(matched_req) + len(inferred_req)) / len(required)
    if nice:
        components["nice_to_have"] = len(matched_nice) / len(nice)
    components["experience"] = 1.0 if min_years <= 0 else min(1.0, years / min_years)
    components["similarity"] = min(1.0, sim / SIMILARITY_SATURATION)

    total_weight = sum(WEIGHTS[k] for k in components)
    breakdown = []
    score = 0.0
    details = {
        "required": f"{len(matched_req) + len(inferred_req)}/{len(required)} required skills",
        "nice_to_have": f"{len(matched_nice)}/{len(nice)} nice-to-have skills",
        "experience": f"{years:g} yrs vs {min_years:g} required",
        "similarity": f"text similarity {sim:.2f} (TF-IDF cosine)",
    }
    for key, value in components.items():
        weight = WEIGHTS[key] * 100 / total_weight
        points = value * weight
        score += points
        breakdown.append({"criterion": key, "score": round(points, 1), "max": round(weight, 1), "detail": details[key]})

    score = round(score)
    label = "Strong match" if score >= 75 else "Good match" if score >= 55 else "Partial match" if score >= 35 else "Low match"

    suggestions = []
    if missing_req:
        suggestions.append(f"Close the gap on required skills: {', '.join(missing_req[:5])}.")
    if inferred_req:
        suggestions.append(f"Mention {', '.join(inferred_req[:4])} explicitly — you likely know them, but your resume doesn't say so.")
    if min_years and years < min_years:
        suggestions.append(f"The role asks for {min_years:g}+ years; highlight internships and substantial projects to compensate.")
    if components["similarity"] < 0.4:
        suggestions.append("Tailor your summary and bullet points to use the job's own wording.")
    if missing_nice:
        suggestions.append(f"Bonus skills that would strengthen your application: {', '.join(missing_nice[:4])}.")

    return {
        "score": score,
        "label": label,
        "breakdown": breakdown,
        "matched_required": matched_req,
        "inferred_required": inferred_req,
        "missing_required": missing_req,
        "matched_nice_to_have": matched_nice,
        "missing_nice_to_have": missing_nice,
        "experience": {"candidate_years": years, "required_years": min_years},
        "suggestions": suggestions,
        "method": "weighted rule-based scoring + TF-IDF cosine similarity",
    }
