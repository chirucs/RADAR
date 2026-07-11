import json
from pathlib import Path
from typing import List

from .schema import KnowledgeBase, Chunk, Topic


def load_kb(path: str | Path) -> KnowledgeBase:
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    return KnowledgeBase(topics=[Topic(**t) for t in raw["topics"]])


def _variant_to_text(topic: Topic, variant) -> str:
    """Flatten a variant into a single passage for retrieval. Includes topic name,
    scenario, keywords, and a compact rendering of each procedure with its rating.

    Variant-specific scenario_keywords are repeated to give BM25 stronger discriminative
    signal between variants of the same topic — without this, common-case ("adult, no
    qualifiers") variants tend to win retrieval over specialized ones (pregnant, pediatric)
    because shared topic tokens dominate the score.
    """
    procs = "\n".join(
        f"- {p.procedure} (appropriateness {p.appropriateness}, {p.category}, RRL={p.rrl}): {p.comment}"
        for p in variant.procedures
    )
    topic_kw = " ".join(topic.keywords)
    variant_kw_block = " ".join(variant.scenario_keywords)
    return (
        f"Topic: {topic.topic_name}\n"
        f"Scenario: {variant.scenario}\n"
        f"Topic keywords: {topic_kw}\n"
        # repeat variant keywords 3x so variant-specific tokens outweigh shared topic tokens
        f"Variant keywords: {variant_kw_block} {variant_kw_block} {variant_kw_block}\n"
        f"Recommended procedures:\n{procs}"
    )


def kb_to_chunks(kb: KnowledgeBase) -> List[Chunk]:
    chunks: List[Chunk] = []
    for topic in kb.topics:
        for variant in topic.variants:
            chunks.append(
                Chunk(
                    chunk_id=f"{topic.topic_id}::{variant.variant_id}",
                    topic_id=topic.topic_id,
                    topic_name=topic.topic_name,
                    variant_id=variant.variant_id,
                    citation=topic.citation,
                    text=_variant_to_text(topic, variant),
                    procedures=variant.procedures,
                    keywords=list(set(topic.keywords + variant.scenario_keywords)),
                )
            )
    return chunks
