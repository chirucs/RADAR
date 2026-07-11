"""Build the BM25 index from the KB JSON file. Run once after changes to the KB."""
import sys
from pathlib import Path

# allow running from project root: `python scripts/build_index.py`
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from acr_assistant.config import get_settings
from acr_assistant.ingestion.parser import kb_to_chunks, load_kb
from acr_assistant.retrieval.retriever import build_index, save_index


def main() -> None:
    s = get_settings()
    kb_path = s.kb_abs()
    index_path = s.index_abs()
    print(f"Loading KB from {kb_path}")
    kb = load_kb(kb_path)
    chunks = kb_to_chunks(kb)
    print(f"  parsed {len(kb.topics)} topic(s) -> {len(chunks)} chunk(s)")
    retriever = build_index(chunks)
    save_index(retriever, index_path)
    print(f"Index saved to {index_path}")


if __name__ == "__main__":
    main()
