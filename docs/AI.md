# AI features

All AI logic lives in `ai-service/app/services/`. The service is **stateless**: the Node server sends it the data
each algorithm needs. None of the features below is a trained machine-learning model — they are rule-based and
statistical methods chosen because they are **explainable** (every score shows its parts), work offline, need no
labelled training data, and are fast. Shared knowledge comes from `datasets/taxonomy/`.

Common building blocks:
- **Skill taxonomy** (`taxonomy.py`): 144 canonical skills with aliases and prerequisites. Extraction uses
  word-boundary regexes, longest-match-wins (so "React Native" ≠ "React"), ignores URLs/e-mails, and only trusts
  short/ambiguous aliases (e.g. `Go`, `R`, `rest`, `express`) on list-like lines.
- **Implied skills:** knowing a skill implies its prerequisites (PostgreSQL ⇒ SQL, Next.js ⇒ React ⇒ JavaScript).
- **Job corpus** (`corpus.py`): a scikit-learn TF-IDF vectorizer fitted on the 300 job descriptions, plus skill
  demand counts and pairwise co-occurrence.

---

## 1. Resume analyzer — `resume_parser.py`
- **Purpose:** turn an uploaded resume into structured data and actionable feedback.
- **Input:** PDF (pypdf), DOCX (python-docx) or TXT bytes. **Output:** text, skills, sections, years of experience,
  education lines, word count, score 0-100 with a per-criterion breakdown, strengths, suggestions.
- **Algorithm:** heading detection for sections; regex date ranges (e.g. `Jan 2022 – Present`) merged into
  non-overlapping intervals and capped at today; 100-point rubric — contact info 10, section completeness 25, skills
  breadth 20, quantified impact & action verbs 20, length 10, readability 15.
- **Why:** deterministic and explainable; students can see exactly what to fix.
- **Integration:** `POST /api/resumes` → Node validates type/size/signature → AI `/resume/parse` → stored in `resumes`.
- **Test:** `pytest -k "resume or parse"`; accuracy test on 500 synthetic resumes — **precision 0.997, recall 1.000**.
- **Limitations:** no OCR for scanned PDFs; multi-column PDFs may extract in a mixed order; synthetic-data accuracy
  overstates real-world accuracy.

## 2. Resume ↔ job match score — `matcher.py`
- **Input:** candidate `{skills, text, years_experience}`, job `{title, description, required_skills, nice_to_have_skills, min_years}`.
- **Output:** score, label, breakdown, matched / inferred / missing skills, suggestions.
- **Algorithm:** 50% required-skill coverage (including inferred skills) + 15% nice-to-have coverage + 15%
  experience fit (`min(1, years / required)`) + 20% TF-IDF cosine similarity (saturating at 0.45). Inapplicable
  components are removed and their weight redistributed. For pasted job descriptions without skill lists, skills are
  extracted from the text and split by "Requirements" / "Nice to have" headings.
- **Limitations:** keyword-level; it cannot judge depth of experience or soft skills.

## 3. Skill-gap analysis — `career.skill_gap`
- **Input:** user skills with levels, target role. **Output:** coverage %, readiness label, matched / weak / missing skills.
- **Algorithm:** each role skill has weight 1-3 (useful/important/core). Credit = weight × level factor
  (beginner 0.6, intermediate 0.85, advanced/expert 1.0; implied-only 0.5). Coverage = earned / possible.
- **Limitations:** role profiles are hand-curated averages, not company-specific.

## 4. Learning roadmap — `career.roadmap`
- **Output:** ordered steps with reason, prerequisites, estimated hours, week range, matched course.
- **Algorithm:** missing + weak skills → add unmet prerequisites transitively → **Kahn's topological sort** with a
  priority queue (most important first among ready skills) → hours = matched course duration × 1.5 (practice), else
  30/20/12 h by weight → scheduled by the learner's hours per week.
- **Test:** `test_roadmap_orders_prerequisites_first`, `test_roadmap_uses_matching_course`.
- **Limitations:** time estimates are heuristics.

## 5. Skill recommendations — `career.recommend_skills`
- **Algorithm (content-based ranking):** `0.45 × role importance + 0.30 × co-occurrence with the user's skills in job
  postings + 0.15 × market demand + 0.10 × prerequisite readiness` (without a target role the weights shift to
  co-occurrence and demand). Each result lists its reasons.
- **Limitations:** demand reflects the synthetic job corpus.

## 6. Project recommendations — `recommender.recommend_projects`
- **Algorithm:** `0.40 × TF-IDF similarity (profile text vs project text, normalised to the best match) + 0.35 × share
  of the project's stack the user knows + 0.25 × share of open roles the user can fill`.
- **Integration:** Node sends the 400 newest open projects the user isn't in.

## 7. Teammate recommendations — `recommender.recommend_teammates`
- **Algorithm:** project needs = roles needed ∪ (tech stack − skills the team already has). Greedy selection: pick
  the candidate with the best level-weighted coverage of the *still uncovered* needs (roles needed ×1.5), plus
  availability 15%, mentor rating 10% and low redundancy with the team 10%. This yields a complementary team rather
  than ten similar profiles.
- **Integration:** only project members can request it; candidates are users with `lookingForTeam: true`.

## 8. Interview preparation — `interview.py`
- **Questions:** 99 curated questions (technical, conceptual, behavioural), each with 3-5 key points and keywords.
  Selection weights questions by the role's skill weights and the user's own skills, covers distinct skills first,
  adds 1-2 behavioural questions and avoids the last three sessions' questions.
- **Evaluation (transparent rubric):** key points covered 60 (a point counts if any of its keywords appears), depth 15
  (answer length), structure 15 (example / trade-off language / multiple sentences; STAR signals for behavioural),
  specificity 10 (numbers, recognised technologies). Returns covered and missed points and feedback.
- **Limitations:** keyword matching can miss correct answers phrased differently, and can be gamed by keyword
  stuffing; it is a practice aid, not an assessment.

## 9. Career assistant (chatbot) — `assistant.py`, `llm.py`
- **Step 1 (always):** intent classification by keyword rules (skill gap, roadmap, resume, applications, interview,
  courses, projects, recommendations), then an answer **computed from the user's data** using the algorithms above.
- **Step 2 (optional):** if `LLM_PROVIDER` is `ollama` or `anthropic`, the facts and the draft answer are sent to the
  model with instructions to stay grounded. The Anthropic path uses the official SDK (`claude-opus-5-5` by default,
  low effort, server-side refusal fallback). On any LLM error the grounded answer is returned.
- **Transparency:** each stored reply records `provider` (`rules`, `ollama:<model>`, `anthropic:<model>`) and the data
  sources used; the UI shows them.
- **Verified:** rules engine (tests), Ollama with `qwen2.5-coder:3b`, fallback when Ollama is unreachable.
  **Not verified:** live Anthropic calls (no API key was available).
- **Limitations:** the rules engine handles a fixed set of intents; general questions get a help message unless an
  LLM is configured.

## 10. Career dashboard — `server/controllers/dashboard.controller.js`
Pure aggregation (no AI): learning hours from completed module durations, application funnel and weekly
"applied" events from status history, skill-level distribution, interview score trend, profile completeness.
