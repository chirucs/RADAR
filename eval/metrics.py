"""The four metrics from §5 of the manuscript:
  1. Topic accuracy           — did the system pick the correct ACR topic?
  2. Variant accuracy         — within that topic, did it pick the correct variant?
  3. Appropriateness concordance — do recommended scores match the ACR ratings?
  4. Citation fidelity        — does every recommendation cite a real KB chunk?
"""
from dataclasses import dataclass, field
from typing import Any, Dict, List, Set


@dataclass
class ScenarioOutcome:
    scenario_id: str
    topic_correct: bool
    variant_correct: bool
    appropriateness_concordance: float    # fraction of expected scores recovered exactly
    citation_fidelity: float              # fraction of recs with valid citations
    top_procedure_correct: bool
    detail: Dict[str, Any] = field(default_factory=dict)


@dataclass
class EvalReport:
    outcomes: List[ScenarioOutcome]

    def summary(self) -> Dict[str, float]:
        n = len(self.outcomes) or 1
        return {
            "n": float(len(self.outcomes)),
            "topic_accuracy": sum(o.topic_correct for o in self.outcomes) / n,
            "variant_accuracy": sum(o.variant_correct for o in self.outcomes) / n,
            "top_procedure_accuracy": sum(o.top_procedure_correct for o in self.outcomes) / n,
            "appropriateness_concordance": sum(o.appropriateness_concordance for o in self.outcomes) / n,
            "citation_fidelity": sum(o.citation_fidelity for o in self.outcomes) / n,
        }


def score_scenario(
    scenario: Dict[str, Any],
    pipeline_result: Dict[str, Any],
    valid_chunk_ids: Set[str],
) -> ScenarioOutcome:
    expected_topic = scenario["expected_topic"]
    expected_variant = scenario["expected_variant"]
    expected_top = scenario["expected_top_procedure"]
    expected_scores: Dict[str, int] = scenario.get("expected_appropriateness", {}) or {}

    topic_correct = pipeline_result.get("topic_match") == expected_topic
    variant_correct = pipeline_result.get("variant_match") == expected_variant

    recs = pipeline_result.get("recommendations") or []
    top_procedure_correct = bool(recs) and recs[0].get("procedure") == expected_top

    # Appropriateness concordance: of the expected procedures, how many are returned
    # with the matching score?
    if expected_scores:
        rec_by_proc = {r.get("procedure"): r.get("appropriateness") for r in recs}
        hits = sum(
            1 for proc, score in expected_scores.items()
            if rec_by_proc.get(proc) == score
        )
        concordance = hits / len(expected_scores)
    else:
        concordance = 1.0 if topic_correct else 0.0

    # Citation fidelity: fraction of recommendations that reference a real chunk_id.
    if recs:
        valid = sum(1 for r in recs if r.get("citation_id") in valid_chunk_ids)
        fidelity = valid / len(recs)
    else:
        fidelity = 1.0 if pipeline_result.get("topic_match") == "INSUFFICIENT_EVIDENCE" else 0.0

    return ScenarioOutcome(
        scenario_id=scenario["id"],
        topic_correct=topic_correct,
        variant_correct=variant_correct,
        appropriateness_concordance=concordance,
        citation_fidelity=fidelity,
        top_procedure_correct=top_procedure_correct,
        detail={
            "expected_topic": expected_topic,
            "got_topic": pipeline_result.get("topic_match"),
            "expected_variant": expected_variant,
            "got_variant": pipeline_result.get("variant_match"),
            "expected_top_procedure": expected_top,
            "got_top_procedure": recs[0].get("procedure") if recs else None,
            "n_recs": len(recs),
            "rejected": pipeline_result.get("_rejected_recommendations", []),
        },
    )
