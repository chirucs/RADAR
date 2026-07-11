import pickle
import re
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

from rank_bm25 import BM25Okapi

from ..ingestion.schema import Chunk


_TOKEN_RE = re.compile(r"[a-z0-9]+")


def _tokenize(text: str) -> List[str]:
    return _TOKEN_RE.findall(text.lower())


@dataclass
class RetrievalResult:
    chunk: Chunk
    score: float
    normalized_score: float


class BM25Retriever:
    def __init__(self, chunks: List[Chunk]):
        self.chunks = chunks
        self._tokenized = [_tokenize(c.text + " " + " ".join(c.keywords)) for c in chunks]
        self.bm25 = BM25Okapi(self._tokenized)

    def retrieve(
        self,
        query: str,
        top_k: int = 5,
        confidence_threshold: float = 0.0,
        min_top_score: float = 2.0,
    ) -> List[RetrievalResult]:
        """Confidence filter: an absolute BM25 floor on the top score. Off-topic queries
        match only on rare incidental tokens and score below ~1.5; real medical queries
        with topic-specific terms score >= 5. Below the floor we return empty, which the
        pipeline interprets as INSUFFICIENT_EVIDENCE.

        confidence_threshold is reserved for future extensions (e.g. distance-from-runner-up
        gating once multiple topics are at play). Currently a no-op to keep the relative
        gate from over-firing when several variants of the same topic legitimately co-rank.
        """
        tokens = _tokenize(query)
        if not tokens:
            return []
        scores = self.bm25.get_scores(tokens)
        max_score = float(scores.max()) if len(scores) else 0.0
        if max_score < min_top_score:
            return []
        ranked = sorted(
            zip(self.chunks, scores), key=lambda x: x[1], reverse=True
        )[:top_k]
        return [
            RetrievalResult(
                chunk=c,
                score=float(s),
                normalized_score=float(s) / max_score,
            )
            for c, s in ranked
            if s > 0
        ]


def build_index(chunks: List[Chunk]) -> BM25Retriever:
    return BM25Retriever(chunks)


def save_index(retriever: BM25Retriever, path: str | Path) -> None:
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "wb") as f:
        pickle.dump(retriever, f)


def load_index(path: str | Path) -> BM25Retriever:
    with open(path, "rb") as f:
        return pickle.load(f)
