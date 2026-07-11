import json
import re
from typing import Any, Dict, List, Optional, Protocol

from ..retrieval.retriever import RetrievalResult
from .prompts import SYSTEM_PROMPT, build_user_prompt


class Generator(Protocol):
    def __call__(self, scenario: str, retrieved: List[RetrievalResult]) -> Dict[str, Any]: ...


def _empty_response(reason: str) -> Dict[str, Any]:
    return {
        "topic_match": "INSUFFICIENT_EVIDENCE",
        "variant_match": None,
        "matched_scenario": None,
        "recommendations": [],
        "safety_flags": {"radiation_concerns": None, "contrast_concerns": None},
        "what_would_change_management": None,
        "confidence": "low",
        "_reason": reason,
    }


def _extract_json(text: str) -> Dict[str, Any]:
    """Extract the first JSON object from a model response."""
    # Try direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Look for ```json fenced block
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if m:
        return json.loads(m.group(1))
    # Greedy: take the largest { ... } block
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if m:
        return json.loads(m.group(0))
    raise ValueError(f"Could not extract JSON from response: {text[:200]!r}")


class StubGenerator:
    """Deterministic fallback that builds a structured response from the top-retrieved
    variant without calling an LLM. Lets the pipeline run end-to-end without an API key
    and gives the eval harness a stable baseline."""

    def __call__(self, scenario: str, retrieved: List[RetrievalResult]) -> Dict[str, Any]:
        if not retrieved:
            return _empty_response("no retrieval results")
        top = retrieved[0]
        chunk = top.chunk
        # Sort procedures by appropriateness desc.
        ranked = sorted(chunk.procedures, key=lambda p: p.appropriateness, reverse=True)
        recs = [
            {
                "procedure": p.procedure,
                "appropriateness": p.appropriateness,
                "category": p.category,
                "rationale": p.comment or f"{p.category} per matched ACR variant.",
                "rrl": p.rrl,
                "uses_contrast": p.uses_contrast,
                "citation_id": chunk.chunk_id,
            }
            for p in ranked
        ]
        rrl_concerns = (
            "Recommended option(s) involve ionizing radiation; weigh against alternatives."
            if any(p.rrl in {"medium", "high", "very_high"} for p in ranked[:3])
            else None
        )
        contrast_concerns = (
            "Top option(s) use IV contrast; verify renal function and allergy history."
            if any(p.uses_contrast for p in ranked[:3])
            else None
        )
        return {
            "topic_match": chunk.topic_id,
            "variant_match": chunk.variant_id,
            "matched_scenario": next(
                (line[len("Scenario: "):]
                 for line in chunk.text.splitlines()
                 if line.startswith("Scenario: ")),
                None,
            ),
            "recommendations": recs,
            "safety_flags": {
                "radiation_concerns": rrl_concerns,
                "contrast_concerns": contrast_concerns,
            },
            "what_would_change_management": None,
            "confidence": "medium" if top.normalized_score > 0.6 else "low",
            "_mode": "stub",
        }


class ClaudeGenerator:
    def __init__(self, api_key: str, model: str, max_tokens: int = 1500):
        from anthropic import Anthropic
        self.client = Anthropic(api_key=api_key)
        self.model = model
        self.max_tokens = max_tokens

    def __call__(self, scenario: str, retrieved: List[RetrievalResult]) -> Dict[str, Any]:
        if not retrieved:
            return _empty_response("no retrieval results")
        user = build_user_prompt(scenario, retrieved)
        resp = self.client.messages.create(
            model=self.model,
            max_tokens=self.max_tokens,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user}],
        )
        text = "".join(b.text for b in resp.content if hasattr(b, "text"))
        try:
            obj = _extract_json(text)
        except Exception as e:
            return _empty_response(f"json parse failure: {e}")
        obj.setdefault("_mode", "claude")
        return obj


def generate_consult(
    scenario: str,
    retrieved: List[RetrievalResult],
    api_key: str = "",
    model: str = "claude-opus-4-8",
    max_tokens: int = 1500,
) -> Dict[str, Any]:
    gen: Generator
    if api_key:
        gen = ClaudeGenerator(api_key=api_key, model=model, max_tokens=max_tokens)
    else:
        gen = StubGenerator()
    return gen(scenario, retrieved)
