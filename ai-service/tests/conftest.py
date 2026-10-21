import io
import os

import pytest

os.environ.setdefault("AI_SERVICE_KEY", "test-key")
os.environ.setdefault("LLM_PROVIDER", "none")

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app, headers={"X-Internal-Key": "test-key"}) as c:
        yield c


def make_pdf(lines: list[str]) -> bytes:
    """Build a minimal valid PDF containing the given text lines (no extra dependencies)."""
    content = "BT /F1 11 Tf 50 780 Td 14 TL " + " ".join(
        "(" + ln.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)") + ") Tj T*" for ln in lines
    ) + " ET"
    objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        f"<< /Length {len(content)} >>\nstream\n{content}\nendstream",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = io.BytesIO()
    out.write(b"%PDF-1.4\n")
    offsets = []
    for i, obj in enumerate(objects, 1):
        offsets.append(out.tell())
        out.write(f"{i} 0 obj\n{obj}\nendobj\n".encode("latin-1"))
    xref = out.tell()
    out.write(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode())
    for off in offsets:
        out.write(f"{off:010d} 00000 n \n".encode())
    out.write(f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode())
    return out.getvalue()


def make_docx(lines: list[str]) -> bytes:
    from docx import Document

    doc = Document()
    for ln in lines:
        doc.add_paragraph(ln)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


SAMPLE_RESUME = [
    "Priya Example",
    "priya@example.com | +91 98765 43210 | github.com/priya-example",
    "SUMMARY",
    "Full stack developer focused on React and Node.js.",
    "SKILLS",
    "JavaScript, React, Node.js, Express, MongoDB, Docker, Git, PostgreSQL",
    "EXPERIENCE",
    "Software Intern - Example Labs (Jan 2023 - Dec 2024)",
    "- Built a REST API with Express serving 2,000 users",
    "- Reduced page load time by 40% by optimizing React rendering",
    "- Automated deployments with GitHub Actions",
    "PROJECTS",
    "- Campus Marketplace: built with React, Node.js and MongoDB",
    "EDUCATION",
    "B.Tech in Computer Science, Example Institute (2025)",
]
