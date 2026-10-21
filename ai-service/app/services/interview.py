"""
Interview preparation.

Questions come from a curated bank (datasets/taxonomy/interview_questions.json)
where each question lists the key points a strong answer covers.

Evaluation is a transparent rubric, NOT a language model:
  * Key-point coverage (60): a point counts as covered if the answer mentions
    any of its keywords.
  * Depth (15): based on answer length.
  * Structure (15): examples, trade-offs / comparison language, multiple sentences
    (behavioural answers: STAR — situation, action, result signals).
  * Specificity (10): concrete numbers and recognised technologies.
"""
from __future__ import annotations

import random
import re

from ..taxonomy import get_taxonomy

EXAMPLE_RX = re.compile(r"\b(for example|for instance|e\.g\.|such as|like when|in my project|i used|we used)\b", re.I)
TRADEOFF_RX = re.compile(r"\b(however|whereas|trade-?off|on the other hand|but|instead|while|compared to|downside|advantage)\b", re.I)
RESULT_RX = re.compile(r"\b(result|outcome|as a result|reduced|improved|increased|learned|delivered|saved)\b", re.I)
ACTION_RX = re.compile(r"\bi (decided|built|led|implemented|wrote|designed|created|organized|organised|proposed|fixed|talked|asked)\b", re.I)
NUMBER_RX = re.compile(r"\d")


class UnknownQuestionError(ValueError):
    pass


def select_questions(role: str, skills: list[str], count: int = 5, exclude: list[str] | None = None, seed: int | None = None) -> dict:
    tax = get_taxonomy()
    rng = random.Random(seed)
    exclude = set(exclude or [])
    role_obj = tax.find_role(role)
    role_weights = dict(role_obj.skills) if role_obj else {}
    for s in tax.canonical_list(skills):
        role_weights[s] = role_weights.get(s, 0) + 1  # user's own skills get asked about too

    bank = [q for q in tax.questions if q["qid"] not in exclude] or tax.questions
    behavioral = [q for q in bank if q["type"] == "behavioral"]
    technical = [q for q in bank if q["type"] != "behavioral" and q["skill"] in role_weights]
    if not technical:  # unknown role and no skills → general software questions
        general = {"Data Structures", "Algorithms", "Object-Oriented Programming", "Git", "SQL", "REST APIs"}
        technical = [q for q in bank if q["skill"] in general]

    n_behavioral = 1 if count < 6 else 2
    n_technical = count - n_behavioral

    # Weighted sampling without replacement, one question per skill first for variety.
    chosen, used_skills = [], set()
    pool = technical[:]
    rng.shuffle(pool)
    pool.sort(key=lambda q: -role_weights.get(q["skill"], 1) + rng.random())
    for q in pool:
        if len(chosen) >= n_technical:
            break
        if q["skill"] not in used_skills:
            chosen.append(q)
            used_skills.add(q["skill"])
    for q in pool:
        if len(chosen) >= n_technical:
            break
        if q not in chosen:
            chosen.append(q)
    chosen += rng.sample(behavioral, min(n_behavioral, len(behavioral)))

    return {
        "role": role_obj.title if role_obj else role,
        "questions": [
            {"qid": q["qid"], "question": q["question"], "skill": q["skill"], "type": q["type"],
             "expected_points": [p["label"] for p in q["points"]]}
            for q in chosen
        ],
    }


def evaluate(qid: str, answer: str) -> dict:
    tax = get_taxonomy()
    q = next((x for x in tax.questions if x["qid"] == qid), None)
    if not q:
        raise UnknownQuestionError(f"Unknown question id '{qid}'")
    text = answer.strip()
    lower = text.lower()
    words = re.findall(r"\b\w+\b", text)
    sentences = [s for s in re.split(r"[.!?]+\s", text) if s.strip()]

    covered, missed = [], []
    for p in q["points"]:
        (covered if any(k.lower() in lower for k in p["keywords"]) else missed).append(p["label"])
    coverage_pts = 60 * len(covered) / max(1, len(q["points"]))

    wc = len(words)
    depth = 3 if wc < 25 else 8 if wc < 60 else 15 if wc <= 300 else 11

    if q["type"] == "behavioral":
        structure = 5 * bool(ACTION_RX.search(text)) + 5 * bool(RESULT_RX.search(text)) + 5 * (len(sentences) >= 4)
        structure_detail = "STAR signals: personal actions, result, enough detail"
    else:
        structure = 5 * bool(EXAMPLE_RX.search(text)) + 5 * bool(TRADEOFF_RX.search(text)) + 5 * (len(sentences) >= 3)
        structure_detail = "example given, trade-offs/comparison, multi-sentence explanation"

    tech_terms = tax.extract_skills(text)
    specificity = min(10, 4 * bool(NUMBER_RX.search(text)) + 2 * len(tech_terms))

    score = round(coverage_pts + depth + structure + specificity)
    criteria = [
        {"name": "Key points covered", "score": round(coverage_pts, 1), "max": 60, "detail": f"{len(covered)}/{len(q['points'])} expected points"},
        {"name": "Depth", "score": depth, "max": 15, "detail": f"{wc} words (aim for 60-300)"},
        {"name": "Structure", "score": structure, "max": 15, "detail": structure_detail},
        {"name": "Specificity", "score": specificity, "max": 10, "detail": f"numbers {'✓' if NUMBER_RX.search(text) else '✗'}, {len(tech_terms)} technical term(s)"},
    ]

    feedback = []
    if missed:
        feedback.append("Also mention: " + "; ".join(missed) + ".")
    if wc < 60:
        feedback.append("Expand your answer — explain the 'why', not just the 'what'.")
    elif wc > 300:
        feedback.append("Tighten your answer — interviewers prefer concise, structured responses.")
    if q["type"] == "behavioral":
        if not ACTION_RX.search(text):
            feedback.append("Describe what YOU did (e.g. 'I decided…', 'I built…').")
        if not RESULT_RX.search(text):
            feedback.append("End with the result and what you learned, ideally with a number.")
    else:
        if not EXAMPLE_RX.search(text):
            feedback.append("Add a concrete example from a project you worked on.")
        if not TRADEOFF_RX.search(text):
            feedback.append("Discuss trade-offs or when you would choose a different approach.")
    if not feedback:
        feedback.append("Strong answer — clear, complete and specific.")

    return {"score": max(0, min(100, score)), "criteria": criteria, "feedback": feedback,
            "covered_points": covered, "missed_points": missed,
            "method": "keyword-based key-point coverage + structure heuristics (transparent rubric)"}
