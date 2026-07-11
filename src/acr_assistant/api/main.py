from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse

from ..config import PROJECT_ROOT, get_settings
from ..pipeline import ConsultPipeline
from .schemas import ConsultRequest, ConsultResponse, Recommendation, SafetyFlags


app = FastAPI(
    title="RADAR — ACR Appropriateness Criteria Consult Assistant",
    version="0.1.0",
    description="LLM + RAG consult support tool grounded in ACR-AC.",
)

_settings = get_settings()
_pipeline: ConsultPipeline | None = None


def _get_pipeline() -> ConsultPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = ConsultPipeline.from_settings(_settings)
    return _pipeline


@app.get("/health")
def health() -> dict:
    p = _get_pipeline()
    return {
        "status": "ok",
        "kb_chunks": len(p.retriever.chunks),
        "llm_mode": "claude" if _settings.anthropic_api_key else "stub",
        "model": _settings.llm_model,
    }


@app.post("/consult", response_model=ConsultResponse)
def consult(req: ConsultRequest) -> ConsultResponse:
    if not req.scenario.strip():
        raise HTTPException(status_code=400, detail="scenario must not be empty")
    p = _get_pipeline()
    raw = p.run(req.scenario)
    return ConsultResponse(
        topic_match=raw.get("topic_match", "INSUFFICIENT_EVIDENCE"),
        variant_match=raw.get("variant_match"),
        matched_scenario=raw.get("matched_scenario"),
        recommendations=[Recommendation(**r) for r in raw.get("recommendations", [])],
        safety_flags=SafetyFlags(**(raw.get("safety_flags") or {})),
        what_would_change_management=raw.get("what_would_change_management"),
        confidence=raw.get("confidence", "low"),
        retrieval=raw.get("_retrieval", []),
        mode=raw.get("_mode"),
        rejected_recommendations=raw.get("_rejected_recommendations", []),
    )


@app.get("/", response_class=HTMLResponse)
def index() -> str:
    return (PROJECT_ROOT / "web" / "index.html").read_text(encoding="utf-8")
