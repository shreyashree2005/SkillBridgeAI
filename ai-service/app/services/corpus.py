"""
Statistics learned from the job-description corpus (datasets/generated/jobs.json):

* a TF-IDF vectorizer (scikit-learn) used for text similarity, so common words
  get low weight and distinctive terms get high weight;
* skill demand (how often each skill is required) and skill co-occurrence
  (which skills appear together in the same job), used for recommendations.

If the generated dataset is missing, it falls back to a corpus built from the
role profiles so the service still starts.
"""
from __future__ import annotations

import json
from collections import Counter
from functools import lru_cache

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from ..config import settings
from ..taxonomy import get_taxonomy


class Corpus:
    def __init__(self, jobs: list[dict]):
        tax = get_taxonomy()
        self.job_count = len(jobs)
        docs = [f"{j['title']} {j['description']} {' '.join(j.get('requiredSkills', []))}" for j in jobs]
        self.vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), min_df=1, sublinear_tf=True, max_features=20000)
        self.vectorizer.fit(docs or ["placeholder"])

        self.demand: Counter = Counter()
        self.cooc: dict[str, Counter] = {}
        for j in jobs:
            skills = set(tax.canonical_list(j.get("requiredSkills", []) + j.get("niceToHaveSkills", [])))
            for s in skills:
                self.demand[s] += 1
                self.cooc.setdefault(s, Counter()).update(skills - {s})
        self.max_demand = max(self.demand.values(), default=1)

    def similarity(self, a: str, b: str) -> float:
        if not a.strip() or not b.strip():
            return 0.0
        m = self.vectorizer.transform([a, b])
        return float(cosine_similarity(m[0], m[1])[0, 0])

    def similarity_many(self, query: str, docs: list[str]) -> np.ndarray:
        if not docs:
            return np.zeros(0)
        m = self.vectorizer.transform([query] + docs)
        return cosine_similarity(m[0], m[1:])[0]

    def demand_score(self, skill: str) -> float:
        return self.demand.get(skill, 0) / self.max_demand

    def cooccurrence_score(self, skill: str, known: list[str]) -> float:
        """Average P(skill appears | known skill appears) over the user's skills."""
        if not known:
            return 0.0
        probs = []
        for k in known:
            total = self.demand.get(k, 0)
            if total:
                probs.append(self.cooc.get(k, Counter()).get(skill, 0) / total)
        return float(np.mean(probs)) if probs else 0.0


@lru_cache(maxsize=1)
def get_corpus() -> Corpus:
    path = settings.data_dir / "generated" / "jobs.json"
    if path.exists():
        jobs = json.loads(path.read_text(encoding="utf-8"))
    else:
        tax = get_taxonomy()
        jobs = [{"title": r.title, "description": r.description, "requiredSkills": list(r.skills)} for r in tax.roles.values()]
    return Corpus(jobs)
