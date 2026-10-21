from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import SAMPLE_RESUME, make_docx, make_pdf


def test_health_is_public(client):
    r = TestClient(app).get("/health")
    assert r.status_code == 200 and r.json()["skills"] > 100


def test_requires_internal_key():
    r = TestClient(app).post("/skill-gap", json={"skills": [], "target_role": "Data Analyst"})
    assert r.status_code == 401


def test_parse_pdf(client):
    r = client.post("/resume/parse", files={"file": ("cv.pdf", make_pdf(SAMPLE_RESUME), "application/pdf")})
    assert r.status_code == 200, r.text
    body = r.json()
    assert "React" in body["skills"] and body["analysis"]["score"] > 0


def test_parse_docx(client):
    mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    r = client.post("/resume/parse", files={"file": ("cv.docx", make_docx(SAMPLE_RESUME), mime)})
    assert r.status_code == 200, r.text
    assert "experience" in r.json()["sections"]


def test_parse_rejects_corrupt_and_empty(client):
    r = client.post("/resume/parse", files={"file": ("cv.pdf", b"%PDF-1.4 garbage", "application/pdf")})
    assert r.status_code == 400
    r = client.post("/resume/parse", files={"file": ("cv.txt", b"too short", "text/plain")})
    assert r.status_code == 400


def test_match_endpoint(client):
    r = client.post("/match", json={
        "candidate": {"skills": ["Python", "SQL"], "text": "data analyst", "years_experience": 1},
        "job": {"title": "Data Analyst", "description": "SQL and Python", "required_skills": ["SQL", "Python", "Excel"]},
    })
    assert r.status_code == 200 and r.json()["missing_required"] == ["Excel"]


def test_unknown_role_is_400(client):
    r = client.post("/skill-gap", json={"skills": [], "target_role": "Astronaut Chef"})
    assert r.status_code == 400 and "Available" in r.json()["detail"]


def test_validation_errors_are_422(client):
    r = client.post("/interview/evaluate", json={"qid": "js-1", "answer": ""})
    assert r.status_code == 422


def test_interview_flow(client):
    q = client.post("/interview/questions", json={"role": "Data Scientist", "count": 4, "seed": 3}).json()["questions"]
    assert len(q) == 4
    r = client.post("/interview/evaluate", json={"qid": q[0]["qid"], "answer": "I would explain it with an example."})
    assert r.status_code == 200 and 0 <= r.json()["score"] <= 100


def test_assistant_endpoint(client):
    r = client.post("/assistant", json={"message": "hello", "context": {"name": "Sam"}})
    assert r.status_code == 200 and "Sam" in r.json()["reply"]
