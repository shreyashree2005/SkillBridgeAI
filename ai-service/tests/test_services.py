import json
from datetime import date

from app.config import settings
from app.services import assistant, career, interview, matcher, recommender, resume_parser
from app.taxonomy import get_taxonomy
from tests.conftest import SAMPLE_RESUME


# ---------------------------------------------------------------- taxonomy
def test_skill_extraction_aliases_and_boundaries():
    tax = get_taxonomy()
    found = tax.extract_skills("Worked with ReactJS, node js and Postgres; wrote C++ and C# code.")
    assert {"React", "Node.js", "PostgreSQL", "C++", "C#"} <= set(found)
    assert "C" not in found  # "C++" / "C#" must not count as C


def test_ambiguous_terms_need_list_context():
    tax = get_taxonomy()
    assert "REST APIs" not in tax.extract_skills("I finished the rest of the work and will go home.")
    assert "Go" not in tax.extract_skills("Go to the market before noon.")
    assert "Go" in tax.extract_skills("Languages: Go, Python, Rust")


def test_links_are_not_skill_claims():
    tax = get_taxonomy()
    assert tax.extract_skills("me@example.com | github.com/me | https://linkedin.com/in/me") == []
    assert tax.extract_skills("Tools: GitHub, Docker") == ["GitHub", "Docker"]


def test_canonical_and_implied():
    tax = get_taxonomy()
    assert tax.canonical("reactjs") == "React"
    assert tax.canonical("Some Unknown Skill") == "Some Unknown Skill"
    assert "SQL" in tax.implied_skills({"PostgreSQL"})
    assert "JavaScript" in tax.implied_skills({"Next.js"})  # transitive: Next.js → React → JavaScript


# ---------------------------------------------------------------- resume parser
def test_parse_sample_resume():
    text = "\n".join(SAMPLE_RESUME)
    parsed = resume_parser.parse_resume(text)
    assert {"React", "Node.js", "MongoDB", "Docker", "Express.js", "GitHub Actions"} <= set(parsed["skills"])
    assert {"skills", "experience", "projects", "education", "summary"} <= set(parsed["sections"])
    assert 1.8 <= parsed["years_experience"] <= 2.1  # Jan 2023 – Dec 2024
    assert parsed["education"] and "B.Tech" in parsed["education"][0]
    analysis = resume_parser.analyse(text, parsed)
    assert analysis["score"] >= 60
    assert sum(b["max"] for b in analysis["breakdown"]) == 100


def test_years_merges_overlaps_and_caps_future():
    text = "Intern (2021 - 2022)\nPart-time (Jun 2022 - Dec 2022)\nDeveloper (Jan 2024 - Present)"
    yrs = resume_parser.estimate_years(text, today=date(2025, 1, 15))
    assert 3.0 <= yrs <= 3.1  # 24 months (2021-2022) + 13 months (Jan 2024 - Jan 2025), overlap merged
    assert resume_parser.estimate_years("Role (2025 - 2030)", today=date(2025, 6, 1)) < 1


def test_weak_resume_gets_suggestions():
    text = "John\nI am a student. I like computers and I want a job."
    parsed = resume_parser.parse_resume(text)
    analysis = resume_parser.analyse(text, parsed)
    assert analysis["score"] < 40
    assert any("SKILLS" in s for s in analysis["suggestions"])


def test_parser_accuracy_on_synthetic_resumes():
    """Evaluate skill extraction against the ground truth of all 500 synthetic resumes."""
    path = settings.data_dir / "generated" / "resumes.json"
    resumes = json.loads(path.read_text(encoding="utf-8"))
    tp = fp = fn = 0
    for r in resumes:
        found = set(resume_parser.parse_resume(r["text"])["skills"])
        expected = set(r["expectedSkills"])
        tp += len(found & expected)
        fp += len(found - expected)
        fn += len(expected - found)
    precision, recall = tp / (tp + fp), tp / (tp + fn)
    print(f"\nSkill extraction on {len(resumes)} synthetic resumes: precision={precision:.3f} recall={recall:.3f}")
    assert recall >= 0.95
    assert precision >= 0.97


# ---------------------------------------------------------------- matcher
JOB = {
    "title": "Junior Backend Developer",
    "description": "Build REST APIs with Node.js and PostgreSQL. Requirements: Node.js, SQL, Docker.",
    "required_skills": ["Node.js", "SQL", "REST APIs", "Docker"],
    "nice_to_have_skills": ["Redis"],
    "min_years": 1,
}


def test_match_scores_and_inference():
    strong = matcher.match({"skills": ["Node.js", "PostgreSQL", "REST APIs", "Docker", "Redis"],
                            "text": "Backend developer building APIs with Node.js, PostgreSQL and Docker", "years_experience": 2}, JOB)
    weak = matcher.match({"skills": ["Figma"], "text": "UI designer", "years_experience": 0}, JOB)
    assert strong["score"] > 80 > weak["score"]
    assert "SQL" in strong["inferred_required"]  # PostgreSQL implies SQL
    assert set(weak["missing_required"]) == set(JOB["required_skills"])
    assert abs(sum(b["max"] for b in strong["breakdown"]) - 100) < 0.5


def test_match_free_text_job_extracts_skills():
    job = {"title": "Data role", "description": "Requirements:\n- Python, SQL, Pandas\nNice to have:\n- Tableau", "min_years": 0}
    res = matcher.match({"skills": ["Python", "SQL"], "text": "", "years_experience": 0}, job)
    assert set(res["matched_required"]) == {"Python", "SQL"}
    assert res["missing_required"] == ["Pandas"]
    assert res["missing_nice_to_have"] == ["Tableau"]


# ---------------------------------------------------------------- career
def test_skill_gap_coverage_monotonic():
    none = career.skill_gap([], "Frontend Developer")
    some = career.skill_gap([{"name": "HTML", "level": "advanced"}, {"name": "CSS", "level": "intermediate"}], "Frontend Developer")
    assert none["coverage"] == 0 < some["coverage"]
    assert any(m["skill"] == "React" for m in some["missing"])


def test_roadmap_orders_prerequisites_first():
    plan = career.roadmap([], "Frontend Developer", 10, [])
    order = [s["skill"] for s in plan["steps"]]
    assert order.index("JavaScript") < order.index("React")
    assert order.index("HTML") < order.index("CSS")
    assert order.index("Programming Fundamentals") < order.index("JavaScript")
    assert plan["total_weeks"] >= 1 and plan["steps"][0]["week_start"] == 1


def test_roadmap_uses_matching_course():
    courses = [{"id": "c1", "title": "React Foundations", "skills": ["React"], "level": "beginner", "duration_hours": 4}]
    plan = career.roadmap([{"name": "JavaScript", "level": "advanced"}, {"name": "HTML", "level": "advanced"},
                           {"name": "CSS", "level": "advanced"}], "Frontend Developer", 8, courses)
    react = next(s for s in plan["steps"] if s["skill"] == "React")
    assert react["course"]["id"] == "c1" and react["estimated_hours"] == 6.0


def test_unknown_role_raises():
    try:
        career.skill_gap([], "Astronaut Chef")
    except career.UnknownRoleError:
        return
    raise AssertionError("expected UnknownRoleError")


def test_recommend_skills_excludes_known_and_prefers_role():
    rec = career.recommend_skills(["HTML", "CSS", "JavaScript"], "Frontend Developer", 5)
    names = [r["skill"] for r in rec["items"]]
    assert "HTML" not in names and "React" in names


# ---------------------------------------------------------------- recommender
def test_project_recommendations_rank_relevant_first():
    projects = [
        {"id": "a", "title": "Game", "description": "Unity platformer", "tech_stack": ["Unity", "C#"], "roles_needed": ["Game Design"]},
        {"id": "b", "title": "Marketplace", "description": "React and Node app", "tech_stack": ["React", "Node.js", "MongoDB"], "roles_needed": ["Docker"]},
    ]
    res = recommender.recommend_projects(["React", "Node.js", "Docker"], [], projects)
    assert res["items"][0]["id"] == "b"
    assert "Docker" in res["items"][0]["fills_roles"]


def test_teammates_are_complementary():
    project = {"tech_stack": ["React", "Node.js"], "roles_needed": ["Docker", "UI/UX Design"], "member_skills": ["React", "Node.js"]}
    cands = [
        {"id": "dup", "skills": [{"name": "React", "level": "expert"}], "availability": "full-time", "rating": 5},
        {"id": "ops", "skills": [{"name": "Docker", "level": "advanced"}], "availability": "part-time", "rating": 0},
        {"id": "ux", "skills": [{"name": "Figma"}, {"name": "UI/UX Design", "level": "advanced"}], "availability": "part-time", "rating": 0},
    ]
    res = recommender.recommend_teammates(project, cands, 3)
    top_two = {r["id"] for r in res["items"][:2]}
    assert top_two == {"ops", "ux"}
    assert res["uncovered"] == []


# ---------------------------------------------------------------- interview
def test_questions_deterministic_with_seed_and_mix():
    a = interview.select_questions("Backend Developer", [], 5, seed=1)
    b = interview.select_questions("Backend Developer", [], 5, seed=1)
    assert a == b and len(a["questions"]) == 5
    assert sum(q["type"] == "behavioral" for q in a["questions"]) == 1


def test_evaluation_rewards_better_answers():
    good = ("var is function-scoped while let and const are block-scoped. All are hoisted, but let/const sit in the "
            "temporal dead zone until declared. const prevents reassignment of the binding, however objects can still be mutated. "
            "For example, in my project I used const for config objects and let for loop counters.")
    bad = "They are ways to make variables."
    g, b = interview.evaluate("js-1", good), interview.evaluate("js-1", bad)
    assert g["score"] >= 75 > 30 > b["score"]
    assert len(g["missed_points"]) == 0 and len(b["missed_points"]) == 4


# ---------------------------------------------------------------- assistant
def test_assistant_grounded_skill_gap():
    ctx = {"name": "Ana", "skills": [{"name": "HTML", "level": "advanced"}], "target_role": "Frontend Developer"}
    res = assistant.respond("What skills am I missing?", [], ctx)
    assert res["provider"] == "rules" and res["intent"] == "skill_gap"
    assert "Frontend Developer" in res["reply"] and "React" in res["reply"]


def test_assistant_does_not_invent_resume():
    res = assistant.respond("How is my resume?", [], {"name": "Ana"})
    assert "haven't uploaded" in res["reply"]
