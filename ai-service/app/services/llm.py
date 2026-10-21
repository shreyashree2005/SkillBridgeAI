"""
Optional language-model providers for the career assistant.

LLM_PROVIDER=none       → no LLM; the assistant uses its grounded rule-based engine only.
LLM_PROVIDER=ollama     → a local model served by Ollama (free, runs on your machine).
LLM_PROVIDER=anthropic  → Claude via the official Anthropic SDK (needs ANTHROPIC_API_KEY).

Every provider returns plain text or raises LLMError; the caller falls back to
the rule-based answer on error, so the assistant never breaks.
"""
from __future__ import annotations

import httpx

from ..config import settings


class LLMError(RuntimeError):
    pass


def provider_label() -> str:
    if settings.llm_provider == "ollama":
        return f"ollama:{settings.ollama_model}"
    if settings.llm_provider == "anthropic":
        return f"anthropic:{settings.anthropic_model}"
    return "rules"


def is_enabled() -> bool:
    if settings.llm_provider == "anthropic":
        return bool(settings.anthropic_api_key)
    return settings.llm_provider == "ollama"


def _ollama(system: str, messages: list[dict]) -> str:
    try:
        res = httpx.post(
            f"{settings.ollama_url.rstrip('/')}/api/chat",
            json={"model": settings.ollama_model, "stream": False, "options": {"temperature": 0.3},
                  "messages": [{"role": "system", "content": system}, *messages]},
            timeout=settings.llm_timeout,
        )
        res.raise_for_status()
        text = res.json().get("message", {}).get("content", "").strip()
    except (httpx.HTTPError, ValueError) as exc:
        raise LLMError(f"Ollama request failed: {exc}") from exc
    if not text:
        raise LLMError("Ollama returned an empty reply")
    return text


def _anthropic(system: str, messages: list[dict]) -> str:
    try:
        import anthropic
    except ImportError as exc:
        raise LLMError("The 'anthropic' package is not installed (pip install -r requirements.txt)") from exc

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key, timeout=settings.llm_timeout, max_retries=2)
    try:
        # Server-side fallback: if the model declines for policy reasons the API
        # retries on a suitable fallback model inside the same call.
        response = client.beta.messages.create(
            model=settings.anthropic_model,
            max_tokens=4000,
            system=system,
            messages=messages,
            output_config={"effort": "low"},  # short chat answers; thinking depth kept low for latency/cost
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
    except anthropic.AuthenticationError as exc:
        raise LLMError("Anthropic API key is invalid") from exc
    except anthropic.RateLimitError as exc:
        raise LLMError("Anthropic rate limit reached") from exc
    except anthropic.APIStatusError as exc:
        raise LLMError(f"Anthropic API error {exc.status_code}") from exc
    except anthropic.APIConnectionError as exc:
        raise LLMError("Could not reach the Anthropic API") from exc

    if response.stop_reason == "refusal":
        raise LLMError("The model declined this request")
    text = "".join(b.text for b in response.content if b.type == "text").strip()
    if not text:
        raise LLMError("Anthropic returned an empty reply")
    return text


def chat(system: str, messages: list[dict]) -> str:
    if settings.llm_provider == "ollama":
        return _ollama(system, messages)
    if settings.llm_provider == "anthropic":
        if not settings.anthropic_api_key:
            raise LLMError("ANTHROPIC_API_KEY is not set")
        return _anthropic(system, messages)
    raise LLMError("No LLM provider configured")
