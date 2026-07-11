import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from acr_assistant.config import get_settings  # noqa: E402
from acr_assistant.ingestion.parser import kb_to_chunks, load_kb  # noqa: E402
from acr_assistant.pipeline import ConsultPipeline  # noqa: E402
from acr_assistant.retrieval.retriever import build_index  # noqa: E402


@pytest.fixture(scope="module")
def pipeline():
    s = get_settings()
    s.anthropic_api_key = ""  # force stub mode for tests
    kb = load_kb(s.kb_abs())
    retriever = build_index(kb_to_chunks(kb))
    return ConsultPipeline(retriever, s)


def test_kb_loads():
    s = get_settings()
    kb = load_kb(s.kb_abs())
    assert len(kb.topics) >= 5
    chunks = kb_to_chunks(kb)
    assert all(c.chunk_id and c.citation for c in chunks)


def test_thunderclap_headache_routes_to_correct_variant(pipeline):
    r = pipeline.run("42F sudden severe headache, worst of life, no trauma")
    assert r["topic_match"] == "acr-headache"
    assert r["variant_match"] == "acr-headache-v1"
    assert r["recommendations"][0]["procedure"] == "CT head without IV contrast"
    assert r["recommendations"][0]["appropriateness"] == 9


def test_pregnant_rlq_routes_to_pregnancy_variant(pipeline):
    r = pipeline.run("28F pregnant, second trimester, RLQ pain, fever, suspected appendicitis")
    assert r["topic_match"] == "acr-rlq-pain"
    assert r["variant_match"] == "acr-rlq-v2"
    assert r["recommendations"][0]["procedure"] == "US abdomen RLQ"


def test_recommendations_are_sorted_descending(pipeline):
    r = pipeline.run("low back pain with fever, weight loss, cancer history, saddle anesthesia")
    scores = [rec["appropriateness"] for rec in r["recommendations"]]
    assert scores == sorted(scores, reverse=True)


def test_all_recommendations_have_valid_citations(pipeline):
    r = pipeline.run("suspected pulmonary embolism, intermediate Wells, normal renal function")
    valid = pipeline._valid_chunk_ids
    for rec in r["recommendations"]:
        assert rec["citation_id"] in valid


def test_off_topic_scenario_returns_insufficient_evidence(pipeline):
    r = pipeline.run("xyzzy plover wibble glorp")
    assert r["topic_match"] == "INSUFFICIENT_EVIDENCE"
    assert r["recommendations"] == []


def test_safety_flags_surface_for_radiation_and_contrast(pipeline):
    r = pipeline.run("sudden severe headache, worst of life")
    flags = r["safety_flags"]
    # Top procedure (non-contrast CT head) is high RRL → radiation flag should fire.
    assert flags["radiation_concerns"]
