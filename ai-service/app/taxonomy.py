"""
Skill taxonomy: canonical skill names, aliases, prerequisites and role profiles,
loaded from datasets/taxonomy/. Also provides rule-based skill extraction from
free text (resumes, job descriptions, chat messages).
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from functools import lru_cache

from .config import settings

# Short or common-word aliases are only trusted on "list-like" lines
# (lines containing commas, pipes, slashes or bullets) to avoid false positives
# such as "the rest of the team" → REST APIs or "Go to market" → Go.
AMBIGUOUS_TERMS = {
    "go", "c", "r", "rest", "express", "node", "spring", "auth", "testing", "caching", "monitoring",
    "containers", "spark", "tf", "ts", "dl", "ml", "rails", "ios", "android", "unity", "tableau",
    "excel", "swift", "rust", "dart", "ruby", "scala", "kotlin", "unix", "networking", "documentation",
    "collaboration", "accessibility", "prototyping", "mentoring", "prompting", "torch", "expo",
}
# URLs and e-mail addresses are links, not skill claims ("github.com/me" ≠ GitHub skill).
URL_RX = re.compile(r"(https?://\S+|www\.\S+|[\w.+-]+@[\w-]+\.[\w.-]+|\b[\w-]+\.(?:com|org|io|dev|me|example|net|app)/\S*)", re.I)
LIST_LINE = re.compile(r"[,|/•·;]|^\s*[-*]\s")


@dataclass
class Skill:
    name: str
    category: str
    aliases: list[str] = field(default_factory=list)
    prerequisites: list[str] = field(default_factory=list)
    case_sensitive: bool = False


@dataclass
class Role:
    title: str
    description: str
    skills: dict[str, int]  # skill name -> weight (1..3)


def _term_regex(term: str, case_sensitive: bool) -> re.Pattern:
    # Boundaries that work for names containing symbols (C++, C#, Node.js, CI/CD).
    # "." in the look-behind stops "js" matching inside "Node.js".
    pattern = rf"(?<![A-Za-z0-9+#.]){re.escape(term)}(?![A-Za-z0-9+#&])"
    return re.compile(pattern, 0 if case_sensitive else re.IGNORECASE)


class Taxonomy:
    def __init__(self, skills: list[dict], roles: list[dict], questions: list[dict]):
        self.skills: dict[str, Skill] = {}
        for s in skills:
            self.skills[s["name"]] = Skill(
                name=s["name"], category=s.get("category", "other"), aliases=s.get("aliases", []),
                prerequisites=s.get("prerequisites", []), case_sensitive=s.get("case_sensitive", False),
            )
        self.roles: dict[str, Role] = {
            r["title"]: Role(r["title"], r.get("description", ""), {x["name"]: int(x["weight"]) for x in r["skills"]})
            for r in roles
        }
        self.questions = questions

        # lookup: lowercase name/alias -> canonical name
        self._lookup: dict[str, str] = {}
        for s in self.skills.values():
            self._lookup[s.name.lower()] = s.name
            for a in s.aliases:
                self._lookup.setdefault(a.lower(), s.name)

        # compiled patterns: (canonical, regex, ambiguous)
        self._patterns: list[tuple[str, re.Pattern, bool]] = []
        for s in self.skills.values():
            terms = [s.name] + s.aliases
            for t in terms:
                cs = s.case_sensitive and t == s.name
                ambiguous = t.lower() in AMBIGUOUS_TERMS or cs
                self._patterns.append((s.name, _term_regex(t, cs), ambiguous))

    # ---------- lookups ----------
    def canonical(self, name: str) -> str:
        """Map a user-entered skill to its canonical taxonomy name (or keep it as given)."""
        clean = (name or "").strip()
        return self._lookup.get(clean.lower(), clean)

    def canonical_list(self, names) -> list[str]:
        out: list[str] = []
        for n in names or []:
            c = self.canonical(n)
            if c and c not in out:
                out.append(c)
        return out

    def find_role(self, title: str | None) -> Role | None:
        if not title:
            return None
        t = title.strip().lower()
        for r in self.roles.values():
            if r.title.lower() == t:
                return r
        # Loose match: best token overlap (e.g. "ml engineer" → Machine Learning Engineer).
        tokens = set(re.findall(r"[a-z]+", t.replace("ml", "machine learning")))
        best, best_score = None, 0.0
        for r in self.roles.values():
            rt = set(re.findall(r"[a-z]+", r.title.lower()))
            score = len(tokens & rt) / max(1, len(tokens | rt))
            if score > best_score:
                best, best_score = r, score
        return best if best_score >= 0.34 else None

    def prerequisites_closure(self, name: str) -> set[str]:
        """All direct and indirect prerequisites of a skill."""
        seen: set[str] = set()
        stack = list(self.skills.get(name, Skill(name, "other")).prerequisites)
        while stack:
            p = stack.pop()
            if p in seen:
                continue
            seen.add(p)
            stack.extend(self.skills.get(p, Skill(p, "other")).prerequisites)
        return seen

    def implied_skills(self, known: set[str]) -> set[str]:
        """Skills implied by knowing others (knowing PostgreSQL implies SQL)."""
        implied: set[str] = set()
        for k in known:
            implied |= self.prerequisites_closure(k)
        return implied - known

    # ---------- extraction ----------
    def extract_skills(self, text: str) -> list[str]:
        """Find canonical skills mentioned in text, ordered by first appearance."""
        if not text:
            return []
        found: dict[str, int] = {}
        text = URL_RX.sub(lambda m: " " * len(m.group(0)), text)  # keep positions stable
        lines = text.splitlines() or [text]
        offset = 0
        for line in lines:
            listy = bool(LIST_LINE.search(line))
            hits: list[tuple[int, int, str]] = []
            for name, rx, ambiguous in self._patterns:
                if ambiguous and not listy:
                    continue
                hits += [(m.start(), m.end(), name) for m in rx.finditer(line)]
            # Longest match wins: "React Native" must not also count as "React",
            # nor "Tailwind CSS" as "CSS".
            hits.sort(key=lambda h: (-(h[1] - h[0]), h[0]))
            taken: list[tuple[int, int]] = []
            for start, end, name in hits:
                if any(start >= s and end <= e for s, e in taken):
                    continue
                taken.append((start, end))
                pos = offset + start
                if name not in found or pos < found[name]:
                    found[name] = pos
            offset += len(line) + 1
        return [n for n, _ in sorted(found.items(), key=lambda kv: kv[1])]


@lru_cache(maxsize=1)
def get_taxonomy() -> Taxonomy:
    base = settings.data_dir / "taxonomy"
    load = lambda n: json.loads((base / n).read_text(encoding="utf-8"))  # noqa: E731
    return Taxonomy(load("skills.json"), load("roles.json"), load("interview_questions.json"))
