"""Settings loaded once from environment variables (and ai-service/.env)."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

SERVICE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(SERVICE_DIR / ".env")


@dataclass(frozen=True)
class Settings:
    # Shared secret the Node server must send in X-Internal-Key. Empty = disabled (dev only).
    service_key: str = os.getenv("AI_SERVICE_KEY", "")
    environment: str = os.getenv("AI_ENV", "development")
    data_dir: Path = Path(os.getenv("DATA_DIR", str(SERVICE_DIR.parent / "datasets")))
    max_upload_mb: float = float(os.getenv("MAX_UPLOAD_MB", "5"))

    # Optional language-model provider for the career assistant: none | ollama | anthropic
    llm_provider: str = os.getenv("LLM_PROVIDER", "none").strip().lower()
    llm_timeout: float = float(os.getenv("LLM_TIMEOUT_SECONDS", "45"))
    ollama_url: str = os.getenv("OLLAMA_URL", "http://localhost:11434")
    ollama_model: str = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
    anthropic_model: str = os.getenv("ANTHROPIC_MODEL", "claude-opus-5-5")


settings = Settings()
