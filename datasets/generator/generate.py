"""
SkillBridge AI — synthetic dataset generator.

Produces reproducible, internally consistent demo data in datasets/generated/.
Everything is SYNTHETIC: names are random combinations, e-mails use the
reserved ".example" domain, and universities/companies are fictional.

Usage (from the repository root):
    python datasets/generator/generate.py            # default seed 42
    python datasets/generator/generate.py --seed 7   # different but reproducible data

Only the Python standard library is used.
"""
from __future__ import annotations

import argparse
import csv
import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TAXONOMY = ROOT / "taxonomy"
OUT = ROOT / "generated"

# Fixed reference date so the output is identical on every run.
BASE_DATE = datetime(2026, 10, 1, 12, 0, tzinfo=timezone.utc)

COUNTS = {
    "users": 1000,
    "projects": 500,
    "jobs": 300,
    "resumes": 500,
    "mentor_offers": 260,
    "mentor_sessions": 900,
    "enrollments": 3000,
    "bookmarks": 2500,
    "applications": 1500,
    "join_requests": 450,
    "career_goals": 700,
}

FIRST_NAMES = [
    "Aarav", "Aditi", "Akira", "Alex", "Amara", "Ana", "Arjun", "Ava", "Bilal", "Camila", "Chen", "Chloe",
    "Daniel", "Diya", "Elena", "Emeka", "Ethan", "Fatima", "Felix", "Grace", "Hana", "Hugo", "Isha", "Ivan",
    "Jae", "Jordan", "Kabir", "Kai", "Lara", "Leo", "Lina", "Luca", "Maya", "Mateo", "Mei", "Nadia", "Nikhil",
    "Noah", "Omar", "Priya", "Rahul", "Riya", "Rohan", "Sam", "Sara", "Sofia", "Tariq", "Tara", "Uma", "Victor",
    "Wei", "Yara", "Yusuf", "Zara", "Zoe", "Ishaan", "Meera", "Kofi", "Ines", "Sven", "Ananya", "Diego", "Ayesha",
    "Kenji", "Lucia", "Mohan", "Nora", "Pavel", "Quinn", "Rosa", "Siddharth", "Tomas", "Vanya", "Yuki",
]
LAST_NAMES = [
    "Sharma", "Patel", "Nguyen", "Garcia", "Kim", "Okafor", "Silva", "Rossi", "Müller", "Haddad", "Rao",
    "Iyer", "Chen", "Lopez", "Kowalski", "Mensah", "Novak", "Tanaka", "Ali", "Fernandes", "Reddy", "Singh",
    "Ahmed", "Costa", "Dubois", "Eriksen", "Fischer", "Gupta", "Hassan", "Ivanova", "Jensen", "Kumar",
    "Larsen", "Mehta", "Nair", "Ortiz", "Park", "Qureshi", "Ramos", "Sato", "Thomas", "Varga", "Walker",
    "Xu", "Yilmaz", "Zhang", "Bose", "Menon", "Pillai", "Das",
]
# Fictional institutions (do not correspond to real universities).
UNIVERSITIES = [
    "Northbridge Institute of Technology", "Riverside Polytechnic University", "Lakeshore College of Engineering",
    "Summit State University", "Eastfield Technical Institute", "Harborview University", "Crestwood Institute of Science",
    "Silverline University", "Westgate College of Computing", "Meadowbrook University", "Ironwood Engineering College",
    "Bluehill Institute of Technology",
]
CITIES = [
    "Bengaluru, India", "Hyderabad, India", "Pune, India", "Chennai, India", "Delhi, India", "Mumbai, India",
    "London, UK", "Berlin, Germany", "Toronto, Canada", "Austin, USA", "Seattle, USA", "Singapore",
    "Lagos, Nigeria", "Nairobi, Kenya", "São Paulo, Brazil", "Sydney, Australia", "Dublin, Ireland", "Remote",
]
INTERESTS = [
    "open source", "hackathons", "fintech", "edtech", "healthtech", "climate tech", "gaming", "robotics",
    "startups", "competitive programming", "design systems", "data journalism", "accessibility", "cybersecurity",
    "AI ethics", "mobile apps", "cloud", "music tech", "sports analytics", "social impact",
]
# Fictional company names built from parts.
COMPANY_A = ["Nimbus", "Quanta", "Brightpath", "Cobalt", "Driftwood", "Evergreen", "Foxglove", "Granite", "Helix",
             "Indigo", "Juniper", "Kestrel", "Lumen", "Mosaic", "Northwind", "Orbit", "Pinecrest", "Quill",
             "Redwood", "Sable", "Tidal", "Umbra", "Vantage", "Willow", "Zephyr"]
COMPANY_B = ["Labs", "Systems", "Analytics", "Works", "Digital", "Health", "Robotics", "Cloud", "Studios",
             "Finance", "Logistics", "Learning", "Security", "AI", "Networks"]

LEVELS = ["beginner", "intermediate", "advanced", "expert"]

PROJECT_IDEAS = {
    "web": [("Campus Marketplace", "a marketplace where students buy and sell used books and gear"),
            ("Study Group Finder", "a web app that matches students into study groups by course and schedule"),
            ("Event Hub", "a platform for clubs to publish events and track RSVPs"),
            ("Portfolio Builder", "a tool that generates developer portfolios from GitHub data"),
            ("Recipe Planner", "a meal planner that builds weekly grocery lists from recipes"),
            ("Volunteer Connect", "a site connecting NGOs with student volunteers"),
            ("Internship Tracker", "a dashboard for tracking internship applications and deadlines"),
            ("Expense Splitter", "an app for roommates to split shared expenses fairly")],
    "mobile": [("Habit Streaks", "a mobile habit tracker with streaks and reminders"),
               ("Campus Navigator", "an indoor/outdoor navigation app for large campuses"),
               ("Flashcard Coach", "a spaced-repetition flashcard app for exam prep"),
               ("Fitness Buddy", "a workout logging app with progress charts"),
               ("Lost & Found", "a mobile app to report and claim lost items on campus")],
    "ai-ml": [("Resume Screener", "an NLP model that ranks resumes against job descriptions"),
              ("Plant Disease Detector", "a CNN that detects plant diseases from leaf photos"),
              ("Lecture Summarizer", "a tool that transcribes and summarizes recorded lectures"),
              ("Sentiment Dashboard", "a dashboard analysing sentiment of course feedback"),
              ("Course Recommender", "a recommender system that suggests elective courses"),
              ("Study Assistant Bot", "a retrieval-augmented chatbot over course notes")],
    "data": [("Air Quality Analysis", "an analysis of city air-quality data with interactive charts"),
             ("Placement Insights", "a dashboard of campus placement statistics over five years"),
             ("Library Usage Trends", "an analysis of library check-out data to optimise opening hours"),
             ("Sports Stats Explorer", "an interactive explorer for cricket and football statistics")],
    "devops": [("Deploy Bot", "a CI/CD pipeline template that deploys student projects automatically"),
               ("Cluster Monitor", "a monitoring stack for a small Kubernetes cluster"),
               ("Infra Starter Kit", "Terraform modules for a secure three-tier web architecture")],
    "security": [("Phishing Simulator", "a safe phishing-awareness training platform for clubs"),
                 ("Password Auditor", "a tool that audits password policies and checks for breached hashes"),
                 ("Network Scanner Dashboard", "a dashboard that visualises scans of a lab network")],
    "game": [("Pixel Platformer", "a 2D platformer with procedurally generated levels"),
             ("Campus Quest", "an educational RPG about campus life"),
             ("Physics Puzzle", "a physics-based puzzle game")],
    "iot": [("Smart Plant Monitor", "an ESP32 device that tracks soil moisture and sends alerts"),
            ("Room Occupancy Sensor", "sensors that report study-room occupancy in real time"),
            ("Energy Tracker", "a hostel energy-usage tracker with a live dashboard")],
    "blockchain": [("Certificate Verifier", "a blockchain-backed academic certificate verification tool"),
                   ("Club Treasury DAO", "a transparent treasury for student club funds")],
}
CATEGORY_STACKS = {
    "web": ["React", "Node.js", "Express.js", "MongoDB", "JavaScript", "TypeScript", "PostgreSQL", "Next.js",
            "Tailwind CSS", "Django", "Python", "REST APIs", "Authentication", "Docker", "Redis", "WebSockets"],
    "mobile": ["React Native", "Flutter", "Dart", "Kotlin", "Swift", "Firebase", "REST APIs", "TypeScript", "Figma"],
    "ai-ml": ["Python", "Machine Learning", "Deep Learning", "PyTorch", "TensorFlow", "scikit-learn", "Pandas",
              "Natural Language Processing", "Large Language Models", "FastAPI", "Computer Vision", "Docker"],
    "data": ["Python", "Pandas", "SQL", "Data Visualization", "Statistics", "Power BI", "Tableau", "Jupyter",
             "Data Analysis", "ETL"],
    "devops": ["Docker", "Kubernetes", "Terraform", "AWS", "CI/CD", "GitHub Actions", "Linux", "Prometheus", "Bash"],
    "security": ["Python", "Network Security", "Penetration Testing", "Web Security", "Linux", "Cryptography",
                 "OWASP Top 10", "Wireshark", "React"],
    "game": ["Unity", "C#", "Game Design", "C++", "Unreal Engine", "Figma"],
    "iot": ["Arduino", "C", "C++", "IoT", "Embedded Systems", "Python", "MongoDB", "React"],
    "blockchain": ["Solidity", "Blockchain", "JavaScript", "React", "Node.js", "Cryptography"],
}
TRACK_TO_CATEGORY = {
    "Frontend Developer": "web", "Backend Developer": "web", "Full Stack Developer": "web",
    "Data Analyst": "data", "Data Scientist": "ai-ml", "Machine Learning Engineer": "ai-ml",
    "AI / LLM Engineer": "ai-ml", "DevOps Engineer": "devops", "Cloud Engineer": "devops",
    "Mobile App Developer": "mobile", "Cybersecurity Analyst": "security", "UI/UX Designer": "web",
    "QA Automation Engineer": "web", "Data Engineer": "data", "Software Engineer": "web",
    "Game Developer": "game", "Embedded Systems Engineer": "iot",
}
REVIEW_COMMENTS = {
    5: ["Explained everything clearly and shared great resources.", "Super patient and practical — highly recommend!",
        "Helped me fix my project in one session.", "Clear explanations with real-world examples."],
    4: ["Very helpful session, a bit rushed at the end.", "Good mentor, gave me a clear plan to follow.",
        "Useful tips, would book again."],
    3: ["Decent session but we didn't cover everything I hoped.", "Okay overall, some parts were too advanced for me."],
    2: ["Session started late and felt unstructured."],
    1: ["Mentor did not show up on time and the session was cut short."],
}
MODULE_TEMPLATES = {
    "beginner": ["Introduction to {s}", "Setting up your {s} environment", "{s} core concepts", "Hands-on: your first {s} exercise",
                 "Common mistakes in {s}", "Mini project with {s}", "Quiz and recap"],
    "intermediate": ["{s} in real projects", "Patterns and best practices in {s}", "Debugging {s}", "Testing {s} code",
                     "Performance tips for {s}", "Project: build a feature with {s}", "Code review checklist"],
    "advanced": ["{s} internals", "Scaling {s} in production", "Advanced patterns in {s}", "Security considerations for {s}",
                 "Case study: {s} at scale", "Capstone project", "Interview-style deep dive"],
}


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


def load_json(name: str):
    return json.loads((TAXONOMY / name).read_text(encoding="utf-8"))


class Generator:
    def __init__(self, seed: int):
        self.rng = random.Random(seed)
        self.skills = load_json("skills.json")
        self.roles = load_json("roles.json")
        self.skill_names = [s["name"] for s in self.skills]
        self.skill_category = {s["name"]: s["category"] for s in self.skills}

    # ---------- helpers ----------
    def past(self, max_days: int, min_days: int = 0) -> datetime:
        return BASE_DATE - timedelta(days=self.rng.uniform(min_days, max_days), minutes=self.rng.randint(0, 1440))

    def weighted_role_skills(self, role: dict, k: int) -> list[str]:
        pool = [(s["name"], s["weight"]) for s in role["skills"]]
        chosen: list[str] = []
        while pool and len(chosen) < k:
            total = sum(w for _, w in pool)
            r = self.rng.uniform(0, total)
            acc = 0.0
            for i, (name, w) in enumerate(pool):
                acc += w
                if r <= acc:
                    chosen.append(name)
                    pool.pop(i)
                    break
        return chosen

    # ---------- users ----------
    def users(self) -> list[dict]:
        out = []
        for i in range(1, COUNTS["users"] + 1):
            first, last = self.rng.choice(FIRST_NAMES), self.rng.choice(LAST_NAMES)
            track = self.rng.choice(self.roles)
            k = self.rng.randint(4, min(10, len(track["skills"])))
            names = self.weighted_role_skills(track, k)
            extras = self.rng.sample(["Git", "Communication", "Teamwork", "Problem Solving", "Agile", "Excel",
                                      "Python", "SQL", "Figma", "Linux"], self.rng.randint(0, 3))
            for e in extras:
                if e not in names:
                    names.append(e)
            grad_year = self.rng.choice([2025, 2026, 2026, 2027, 2027, 2028, 2029])
            seniority = max(0, 2026 - grad_year + self.rng.choice([0, 0, 1, 2]))
            skills = []
            for n in names:
                lvl = self.rng.choices(LEVELS, weights=[4, 5, 3, 1 if seniority < 2 else 2])[0]
                years = round(min(seniority + 1, {"beginner": 0.5, "intermediate": 1.5, "advanced": 2.5, "expert": 4}[lvl]
                                  * self.rng.uniform(0.6, 1.4)), 1)
                skills.append({"name": n, "level": lvl, "yearsOfExperience": years})
            role = self.rng.choices(["student", "mentor", "both"], weights=[70, 8, 22])[0]
            created = self.past(540, 5)
            out.append({
                "id": f"user-{i:04d}",
                "firstName": first,
                "lastName": last,
                "email": f"{first.lower()}.{last.lower().replace('ü', 'u')}.{i:04d}@skillbridge.example",
                "role": role,
                "headline": f"{'Aspiring ' if role == 'student' else ''}{track['title']} · {', '.join(names[:3])}",
                "bio": (f"Synthetic demo profile. I'm a student at {self.rng.choice(UNIVERSITIES)} focusing on "
                        f"{track['title'].lower()} work. I enjoy {self.rng.choice(INTERESTS)} and building projects with "
                        f"{' and '.join(names[:2])}."),
                "location": self.rng.choice(CITIES),
                "university": self.rng.choice(UNIVERSITIES),
                "graduationYear": grad_year,
                "track": track["title"],
                "skills": skills,
                "interests": self.rng.sample(INTERESTS, self.rng.randint(1, 4)),
                "lookingForTeam": self.rng.random() < 0.45,
                "availability": self.rng.choice(["full-time", "part-time", "part-time", "weekends"]),
                "links": {"github": f"https://github.example/{first.lower()}{i:04d}", "linkedin": "", "portfolio": ""},
                "createdAt": iso(created),
                "isSynthetic": True,
            })
        return out

    # ---------- courses ----------
    def courses(self) -> list[dict]:
        # One course per (important skill, level). Importance = appears in role profiles.
        importance: dict[str, int] = {}
        for r in self.roles:
            for s in r["skills"]:
                importance[s["name"]] = importance.get(s["name"], 0) + s["weight"]
        ranked = sorted(importance, key=lambda n: -importance[n])
        out = []
        n = 0
        for skill in ranked:
            levels = ["beginner", "intermediate", "advanced"] if importance[skill] >= 8 else ["beginner", "intermediate"]
            for level in levels:
                n += 1
                mods = [{"title": t.format(s=skill), "durationMinutes": self.rng.choice([20, 30, 45, 60, 75])}
                        for t in MODULE_TEMPLATES[level][: self.rng.randint(5, 7)]]
                related = [p for p in next((s["prerequisites"] for s in self.skills if s["name"] == skill), [])][:1]
                out.append({
                    "id": f"course-{n:03d}",
                    "slug": f"{skill.lower().replace(' ', '-').replace('/', '-').replace('.', '').replace('+', 'p').replace('#', 'sharp')}-{level}",
                    "title": f"{skill} {'Foundations' if level == 'beginner' else 'in Practice' if level == 'intermediate' else 'Mastery'}",
                    "provider": "SkillBridge Academy (synthetic)",
                    "description": (f"A {level} course on {skill}. Learn through short lessons and a hands-on project. "
                                    f"Synthetic catalog entry for demo purposes."),
                    "skills": [skill] + related,
                    "level": level,
                    "modules": mods,
                    "durationHours": round(sum(m["durationMinutes"] for m in mods) / 60, 1),
                    "ratingAverage": round(self.rng.uniform(3.6, 4.9), 1),
                    "ratingCount": self.rng.randint(5, 400),
                    "isSynthetic": True,
                })
        return out

    # ---------- projects ----------
    def projects(self, users: list[dict]) -> list[dict]:
        by_track: dict[str, list[dict]] = {}
        for u in users:
            by_track.setdefault(u["track"], []).append(u)
        out = []
        for i in range(1, COUNTS["projects"] + 1):
            owner = self.rng.choice(users)
            category = TRACK_TO_CATEGORY.get(owner["track"], "web")
            if self.rng.random() < 0.2:
                category = self.rng.choice(list(PROJECT_IDEAS))
            title, pitch = self.rng.choice(PROJECT_IDEAS[category])
            stack_pool = CATEGORY_STACKS[category]
            owner_skills = [s["name"] for s in owner["skills"] if s["name"] in stack_pool]
            stack = list(dict.fromkeys(owner_skills[:3] + self.rng.sample(stack_pool, self.rng.randint(2, 4))))[:6]
            needed = [s for s in self.rng.sample(stack_pool, min(len(stack_pool), 4)) if s not in stack][:3]
            max_team = self.rng.choice([3, 4, 4, 5, 6])
            peers = [u for u in by_track.get(owner["track"], []) if u["id"] != owner["id"]]
            members = [owner["id"]] + [u["id"] for u in self.rng.sample(peers, min(len(peers), self.rng.randint(0, max_team - 2)))]
            status = self.rng.choices(["idea", "in-progress", "completed"], weights=[3, 5, 2])[0]
            created = self.past(400, 1)
            suffix = self.rng.choice(["", " 2.0", " Lite", " Pro", " for Clubs", " Mobile", " AI"])
            out.append({
                "id": f"project-{i:04d}",
                "owner": owner["id"],
                "title": f"{title}{suffix}",
                "summary": pitch[0].upper() + pitch[1:] + ".",
                "description": (f"We are building {pitch}. The goal is to ship a working MVP that real students can use, "
                                f"then iterate on feedback. Current stack: {', '.join(stack)}. "
                                + (f"We are looking for help with {', '.join(needed)}. " if needed else "")
                                + "This is a synthetic demo project."),
                "category": category,
                "techStack": stack,
                "rolesNeeded": needed,
                "status": status,
                "difficulty": self.rng.choice(["beginner", "intermediate", "intermediate", "advanced"]),
                "repoUrl": f"https://github.example/{owner['firstName'].lower()}/{title.lower().replace(' ', '-')}",
                "members": members,
                "maxTeamSize": max(max_team, len(members)),
                "lookingForMembers": status != "completed" and len(members) < max_team,
                "createdAt": iso(created),
                "isSynthetic": True,
            })
        return out

    # ---------- jobs ----------
    def jobs(self) -> list[dict]:
        out = []
        for i in range(1, COUNTS["jobs"] + 1):
            role = self.rng.choice(self.roles)
            level = self.rng.choices(["internship", "entry", "mid", "senior"], weights=[30, 40, 22, 8])[0]
            core = [s["name"] for s in role["skills"] if s["weight"] >= 2]
            nice = [s["name"] for s in role["skills"] if s["weight"] == 1]
            required = self.rng.sample(core, min(len(core), self.rng.randint(4, 7)))
            nice_pick = self.rng.sample(nice, min(len(nice), self.rng.randint(1, 4)))
            years = {"internship": 0, "entry": self.rng.choice([0, 1]), "mid": self.rng.choice([2, 3]), "senior": self.rng.choice([5, 6])}[level]
            company = f"{self.rng.choice(COMPANY_A)} {self.rng.choice(COMPANY_B)}"
            title_prefix = {"internship": "", "entry": "Junior ", "mid": "", "senior": "Senior "}[level]
            title = f"{title_prefix}{role['title']}{' Intern' if level == 'internship' else ''}"
            remote = self.rng.random() < 0.4
            base = {"internship": 1500, "entry": 55000, "mid": 85000, "senior": 125000}[level]
            employment = "internship" if level == "internship" else self.rng.choices(["full-time", "contract", "part-time"], weights=[85, 10, 5])[0]
            description = "\n\n".join([
                f"{company} is a fictional company used for SkillBridge AI demos. We are hiring a {title} to join our team.",
                f"About the role: {role['description']} You will collaborate with designers, engineers and product managers to ship features end to end.",
                "Requirements:\n" + "\n".join(f"- Experience with {s}" for s in required)
                + (f"\n- {years}+ years of relevant experience" if years else "\n- Open to students and recent graduates"),
                "Nice to have:\n" + "\n".join(f"- {s}" for s in nice_pick),
                "We value curiosity, clear communication and a growth mindset.",
            ])
            out.append({
                "id": f"job-{i:04d}",
                "externalId": f"job-{i:04d}",
                "title": title,
                "company": company,
                "location": "Remote" if remote else self.rng.choice(CITIES[:-1]),
                "employmentType": employment,
                "remote": remote,
                "experienceLevel": level,
                "description": description,
                "requiredSkills": required,
                "niceToHaveSkills": nice_pick,
                "minYearsExperience": years,
                "salaryMin": int(base * self.rng.uniform(0.85, 1.0)),
                "salaryMax": int(base * self.rng.uniform(1.15, 1.4)),
                "currency": "USD",
                "postedAt": iso(self.past(60)),
                "isSynthetic": True,
            })
        return out

    # ---------- resumes (text samples with ground-truth skills) ----------
    def resumes(self, users: list[dict]) -> list[dict]:
        out = []
        sample = self.rng.sample(users, COUNTS["resumes"])
        for n, u in enumerate(sample, 1):
            skills = [s["name"] for s in u["skills"]]
            years = max((s["yearsOfExperience"] for s in u["skills"]), default=0)
            exp_years = int(years)
            start_year = 2026 - max(1, exp_years)
            quality = self.rng.choice(["strong", "average", "weak"])
            artifact = self.rng.choice(["dashboard", "REST API", "mobile app", "data pipeline", "ML model"])
            bullets = [
                f"Built a {artifact} using {skills[0]}"
                + (f" and {skills[1]}" if len(skills) > 1 else "")
                + (f", improving response time by {self.rng.randint(15, 60)}%" if quality == "strong" else ""),
                f"Collaborated with a team of {self.rng.randint(3, 8)} using Git and Agile practices",
            ]
            if quality != "weak":
                bullets.append(f"Wrote unit tests and documentation for {self.rng.randint(5, 30)} modules")
            sections = [
                f"{u['firstName']} {u['lastName']}",
                f"{u['email']} | {u['location']} | {u['links']['github']}",
            ]
            if quality != "weak":
                sections += ["", "SUMMARY", f"{u['headline']}. Synthetic resume sample generated for testing."]
            sections += ["", "SKILLS", ", ".join(skills)]
            if exp_years >= 1 or quality == "strong":
                sections += ["", "EXPERIENCE",
                             f"Software Intern — {self.rng.choice(COMPANY_A)} {self.rng.choice(COMPANY_B)} ({start_year} - 2026)"]
                sections += [f"- {b}" for b in bullets]
            sections += ["", "PROJECTS", f"- {self.rng.choice(sum(PROJECT_IDEAS.values(), []))[0]}: built with {', '.join(skills[:3])}"]
            sections += ["", "EDUCATION", f"B.Tech in Computer Science, {u['university']} ({u['graduationYear']})"]
            if quality == "strong":
                sections += ["", "CERTIFICATIONS", f"- {skills[0]} certificate (synthetic)"]
            # Ground truth = listed skills + skills implied by the experience bullets.
            expected = list(skills)
            if exp_years >= 1 or quality == "strong":
                implied = ["Git", "Agile"] + {"REST API": ["REST APIs"], "ML model": ["Machine Learning"],
                                              "data pipeline": ["ETL"]}.get(artifact, [])
                if quality != "weak":
                    implied += ["Unit Testing", "Technical Writing"]
                expected += [s for s in implied if s not in expected]
            out.append({
                "id": f"resume-{n:04d}",
                "user": u["id"],
                "quality": quality,
                "expectedSkills": expected,
                "expectedYears": exp_years if (exp_years >= 1 or quality == "strong") else 0,
                "text": "\n".join(sections),
                "isSynthetic": True,
            })
        return out

    # ---------- relationships ----------
    def mentor_offers(self, users: list[dict]) -> list[dict]:
        mentors = [u for u in users if u["role"] in ("mentor", "both")]
        out, seen = [], set()
        while len(out) < COUNTS["mentor_offers"]:
            m = self.rng.choice(mentors)
            strong = [s for s in m["skills"] if s["level"] in ("intermediate", "advanced", "expert")] or m["skills"]
            s = self.rng.choice(strong)
            if (m["id"], s["name"]) in seen:
                continue
            seen.add((m["id"], s["name"]))
            level = "beginner" if s["level"] == "intermediate" else self.rng.choice(["beginner", "intermediate", "advanced"])
            out.append({
                "id": f"offer-{len(out) + 1:04d}",
                "mentor": m["id"],
                "title": self.rng.choice([f"{s['name']} for beginners", f"Get unstuck with {s['name']}",
                                          f"{s['name']} project review", f"1:1 {s['name']} mentoring"]),
                "skill": s["name"],
                "description": f"Synthetic offer. I can help you learn {s['name']}, review your code and plan next steps.",
                "level": level,
                "sessionMinutes": self.rng.choice([30, 45, 60, 60, 90]),
                "mode": self.rng.choice(["online", "online", "in-person"]),
                "isActive": True,
                "createdAt": iso(self.past(300, 30)),
                "isSynthetic": True,
            })
        return out

    def mentor_sessions(self, users, offers):
        out, reviews = [], []
        user_ids = [u["id"] for u in users]
        for i in range(1, COUNTS["mentor_sessions"] + 1):
            offer = self.rng.choice(offers)
            learner = self.rng.choice(user_ids)
            while learner == offer["mentor"]:
                learner = self.rng.choice(user_ids)
            status = self.rng.choices(["requested", "accepted", "declined", "completed", "cancelled"], weights=[10, 12, 8, 60, 10])[0]
            if status in ("requested", "accepted"):
                when = BASE_DATE + timedelta(days=self.rng.uniform(1, 30))
            else:
                when = self.past(200, 2)
            session = {
                "id": f"session-{i:04d}",
                "offer": offer["id"],
                "mentor": offer["mentor"],
                "learner": learner,
                "skill": offer["skill"],
                "scheduledAt": iso(when),
                "durationMinutes": offer["sessionMinutes"],
                "message": f"Hi! I'd like help with {offer['skill']}. (synthetic)",
                "status": status,
                "reviewed": False,
                "createdAt": iso(min(when, BASE_DATE) - timedelta(days=self.rng.randint(1, 10))),
                "isSynthetic": True,
            }
            if status == "completed" and self.rng.random() < 0.75:
                rating = self.rng.choices([5, 4, 3, 2, 1], weights=[45, 32, 13, 6, 4])[0]
                session["reviewed"] = True
                reviews.append({
                    "id": f"review-{len(reviews) + 1:04d}",
                    "reviewer": learner,
                    "subject": offer["mentor"],
                    "session": session["id"],
                    "rating": rating,
                    "comment": self.rng.choice(REVIEW_COMMENTS[rating]),
                    "createdAt": iso(when + timedelta(hours=self.rng.randint(2, 72))),
                    "isSynthetic": True,
                })
            out.append(session)
        return out, reviews

    def enrollments(self, users, courses):
        out, seen = [], set()
        by_skill: dict[str, list[dict]] = {}
        for c in courses:
            for s in c["skills"]:
                by_skill.setdefault(s, []).append(c)
        while len(out) < COUNTS["enrollments"]:
            u = self.rng.choice(users)
            # Prefer courses related to the user's track (realistic learning history).
            track = next(r for r in self.roles if r["title"] == u["track"])
            candidates = [c for s in track["skills"] for c in by_skill.get(s["name"], [])] or courses
            c = self.rng.choice(candidates)
            if (u["id"], c["id"]) in seen:
                continue
            seen.add((u["id"], c["id"]))
            total = len(c["modules"])
            done_n = self.rng.choices([0, self.rng.randint(1, max(1, total - 1)), total], weights=[15, 55, 30])[0]
            done = sorted(self.rng.sample(range(total), done_n))
            last = self.past(120)
            progress = round(done_n / total * 100)
            out.append({
                "id": f"enrollment-{len(out) + 1:05d}",
                "user": u["id"],
                "course": c["id"],
                "completedModules": done,
                "progress": progress,
                "status": "completed" if progress == 100 else "in-progress",
                "lastActivityAt": iso(last),
                "completedAt": iso(last) if progress == 100 else None,
                "isSynthetic": True,
            })
        return out

    def bookmarks(self, users, projects):
        out, seen = [], set()
        while len(out) < COUNTS["bookmarks"]:
            u, p = self.rng.choice(users), self.rng.choice(projects)
            if (u["id"], p["id"]) in seen or p["owner"] == u["id"]:
                continue
            seen.add((u["id"], p["id"]))
            out.append({"id": f"bookmark-{len(out) + 1:05d}", "user": u["id"], "project": p["id"],
                        "createdAt": iso(self.past(200)), "isSynthetic": True})
        return out

    def join_requests(self, users, projects):
        out, seen = [], set()
        open_projects = [p for p in projects if p["lookingForMembers"]]
        while len(out) < COUNTS["join_requests"]:
            p, u = self.rng.choice(open_projects), self.rng.choice(users)
            if u["id"] in p["members"] or (p["id"], u["id"]) in seen:
                continue
            seen.add((p["id"], u["id"]))
            out.append({"id": f"joinreq-{len(out) + 1:04d}", "project": p["id"], "user": u["id"],
                        "message": "I'd love to contribute to this project! (synthetic)",
                        "status": self.rng.choices(["pending", "declined"], weights=[80, 20])[0],
                        "createdAt": iso(self.past(60)), "isSynthetic": True})
        return out

    def applications(self, users, jobs):
        out, seen = [], set()
        flow = ["saved", "applied", "interviewing", "offer"]
        while len(out) < COUNTS["applications"]:
            u, j = self.rng.choice(users), self.rng.choice(jobs)
            if (u["id"], j["id"]) in seen:
                continue
            seen.add((u["id"], j["id"]))
            final = self.rng.choices(["saved", "applied", "interviewing", "offer", "rejected", "withdrawn"],
                                     weights=[20, 35, 15, 5, 20, 5])[0]
            t = datetime.fromisoformat(j["postedAt"].replace("Z", "+00:00")) + timedelta(days=self.rng.uniform(0, 5))
            history = []
            path = flow[: flow.index(final) + 1] if final in flow else flow[: self.rng.randint(2, 3)] + [final]
            for st in path:
                history.append({"status": st, "at": iso(min(t, BASE_DATE))})
                t += timedelta(days=self.rng.uniform(1, 12))
            applied = next((h["at"] for h in history if h["status"] == "applied"), None)
            out.append({"id": f"application-{len(out) + 1:05d}", "user": u["id"], "job": j["id"], "status": final,
                        "notes": "", "appliedAt": applied, "statusHistory": history, "isSynthetic": True})
        return out

    def career_goals(self, users):
        out = []
        for u in self.rng.sample(users, COUNTS["career_goals"]):
            target = u["track"] if self.rng.random() < 0.8 else self.rng.choice(self.roles)["title"]
            out.append({"id": f"goal-{len(out) + 1:04d}", "user": u["id"], "targetRole": target,
                        "targetDate": iso(BASE_DATE + timedelta(days=self.rng.randint(60, 400))),
                        "hoursPerWeek": self.rng.choice([4, 6, 8, 10, 12, 15]),
                        "status": self.rng.choices(["active", "paused", "achieved"], weights=[80, 12, 8])[0],
                        "notes": "", "isSynthetic": True})
        return out

    def notifications(self, sessions, reviews, join_requests, enrollments, projects):
        out = []
        proj = {p["id"]: p for p in projects}

        def add(user, ntype, title, link, at, read):
            out.append({"id": f"notification-{len(out) + 1:05d}", "user": user, "type": ntype, "title": title,
                        "body": "", "link": link, "read": read, "createdAt": at, "isSynthetic": True})

        for s in sessions:
            add(s["mentor"], "session-requested", f"New {s['skill']} session request", "/mentoring?tab=sessions",
                s["createdAt"], s["status"] != "requested")
        for r in reviews:
            add(r["subject"], "review-received", f"You received a {r['rating']}★ review", "/profile",
                r["createdAt"], self.rng.random() < 0.7)
        for jr in join_requests:
            add(proj[jr["project"]]["owner"], "join-request", f"Someone wants to join \"{proj[jr['project']]['title']}\"",
                f"/projects/{jr['project']}", jr["createdAt"], jr["status"] != "pending")
        for e in enrollments:
            if e["status"] == "completed":
                add(e["user"], "course-completed", "Course completed 🎓", f"/learning/{e['course']}",
                    e["completedAt"], True)
        return out


def write(name: str, rows: list[dict]):
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{name}.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")


def write_csv(name: str, rows: list[dict], fields: list[str]):
    with open(OUT / f"{name}.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(fields)
        for r in rows:
            vals = []
            for k in fields:
                v = r.get(k, "")
                if isinstance(v, list):
                    v = ";".join(x["name"] if isinstance(x, dict) else str(x) for x in v)
                vals.append(v)
            w.writerow(vals)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    g = Generator(args.seed)
    users = g.users()
    courses = g.courses()
    projects = g.projects(users)
    jobs = g.jobs()
    resumes = g.resumes(users)
    offers = g.mentor_offers(users)
    sessions, reviews = g.mentor_sessions(users, offers)
    enrollments = g.enrollments(users, courses)
    bookmarks = g.bookmarks(users, projects)
    join_requests = g.join_requests(users, projects)
    applications = g.applications(users, jobs)
    goals = g.career_goals(users)
    notifications = g.notifications(sessions, reviews, join_requests, enrollments, projects)

    data = {
        "users": users, "courses": courses, "projects": projects, "jobs": jobs, "resumes": resumes,
        "mentor_offers": offers, "mentor_sessions": sessions, "reviews": reviews, "enrollments": enrollments,
        "bookmarks": bookmarks, "join_requests": join_requests, "applications": applications,
        "career_goals": goals, "notifications": notifications,
    }
    for name, rows in data.items():
        write(name, rows)

    write_csv("users", users, ["id", "firstName", "lastName", "email", "role", "track", "university", "location",
                               "graduationYear", "skills", "lookingForTeam"])
    write_csv("projects", projects, ["id", "owner", "title", "category", "status", "techStack", "rolesNeeded", "members"])
    write_csv("jobs", jobs, ["id", "title", "company", "location", "experienceLevel", "employmentType", "remote",
                             "requiredSkills", "niceToHaveSkills", "minYearsExperience", "salaryMin", "salaryMax"])
    write_csv("courses", courses, ["id", "title", "level", "skills", "durationHours", "ratingAverage"])
    write_csv("resumes", resumes, ["id", "user", "quality", "expectedSkills", "expectedYears"])

    manifest = {"seed": args.seed, "baseDate": iso(BASE_DATE), "counts": {k: len(v) for k, v in data.items()},
                "note": "All records are synthetic and generated for demonstration and testing."}
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    for k, v in manifest["counts"].items():
        print(f"{k:>16}: {v}")


if __name__ == "__main__":
    main()
