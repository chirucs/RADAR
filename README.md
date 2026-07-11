# RADAR : Radiology Appropriateness Decision & Advisory Resource

LLM + RAG consult-support tool for radiologists, grounded in the ACR Appropriateness Criteria.
Implements the system described in *"A Large Language Model–Based Consult Support Tool for Radiologists Using ACR Appropriateness Criteria"*.

## What it does

Takes a free-text clinical scenario from a radiologist (e.g. *"42F, sudden severe headache, worst of life, no trauma"*) and returns:

- The matched ACR topic + variant
- Ranked imaging recommendations with appropriateness scores (1–9)
- Rationale and conditional modifiers
- Radiation (RRL) and IV-contrast safety flags
- Direct citations back to the ACR knowledge base
- A `confidence` score; below threshold returns `INSUFFICIENT_EVIDENCE` instead of guessing

## Architecture

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐    ┌─────────────┐
│ Clinician   │───▶│ FastAPI      │───▶│ Retriever    │───▶│ Generator   │
│ free-text   │    │ /consult     │    │ (BM25 +      │    │ (Claude     │
│ scenario    │    │              │    │  threshold)  │    │  + citation │
└─────────────┘    └──────────────┘    └──────────────┘    │  guardrail) │
                          │                    │           └─────────────┘
                          ▼                    ▼                  │
                   ┌──────────────┐    ┌──────────────┐          ▼
                   │ Web UI       │    │ ACR-AC KB    │   Structured JSON
                   │ (web/        │    │ (data/raw)   │   with citations
                   │  index.html) │    └──────────────┘
                   └──────────────┘
```

## Project layout

```
ACR_Assistant/
├── data/raw/sample_acr_kb.json    # Seed KB (synthetic, illustrative)
├── src/acr_assistant/
│   ├── config.py                  # Settings (env-driven)
│   ├── ingestion/                 # Parse KB → chunks
│   ├── retrieval/                 # BM25 + confidence threshold
│   ├── generation/                # Claude wrapper + citation prompt
│   ├── pipeline.py                # End-to-end orchestration
│   └── api/                       # FastAPI app + Pydantic schemas
├── web/index.html                 # Minimal HTMX-style UI
├── scripts/build_index.py         # Build retriever index from KB
├── eval/                          # 4-metric evaluation harness
└── tests/                         # pytest unit tests
```

## Quick start

```bash
cd "t:/Amy_Research Paper/ACR_Assistant"
pip install -r requirements.txt

# 1. Build the retriever index from the seed KB
python scripts/build_index.py

# 2. Run the eval harness (uses stub LLM, no API key needed)
python eval/run_eval.py

# 3. Launch the API + UI
uvicorn acr_assistant.api.main:app --app-dir src --reload --port 8000
# open http://localhost:8000
```

To use the real Claude model, copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY`.
Without it, the system runs in **stub mode** — the retriever still works against the real KB, and the generator produces a deterministic structured response from the top-retrieved variant. Useful for testing the pipeline end-to-end.

## Knowledge base

`data/raw/sample_acr_kb.json` ships with five illustrative topics covering common consult scenarios:

1. Headache — thunderclap / sudden severe
2. Acute Low Back Pain
3. Acute Chest Pain — low/intermediate probability ACS
4. Right Lower Quadrant Pain — suspected appendicitis
5. Suspected Pulmonary Embolism

> **Important**: the seed data is *synthetic and illustrative*. The official ACR Appropriateness Criteria® are copyrighted by the American College of Radiology. Production deployment requires properly licensed ingestion. The schema mirrors the real ACR-AC structure (topic → variants → procedures with 1–9 appropriateness ratings + RRL).

## Evaluation metrics

`eval/run_eval.py` reports the four metrics defined in §5 of the manuscript:

| Metric | What it checks |
|---|---|
| Topic accuracy | Did the system pick the correct ACR topic? |
| Variant accuracy | Within that topic, did it pick the correct variant? |
| Appropriateness concordance | Do the recommended procedures' scores match the ACR ratings? |
| Citation fidelity | Does every recommendation cite a real KB entry (no hallucinated citations)? |

### Current baseline (BM25 retrieval + stub generator, 8 scenarios)

| Metric | Score |
|---|---|
| topic_accuracy | **100.0%** |
| variant_accuracy | 87.5% |
| top_procedure_accuracy | 87.5% |
| appropriateness_concordance | 87.5% |
| citation_fidelity | **100.0%** |

The single failing scenario is `eval-002` — *"34M, 3 days mild low back pain, NO fever, NO weight loss, NO cancer history"*. BM25 cannot handle negation: it matches positively on "fever" / "weight loss" / "cancer history" in the query and routes to the red-flag variant. This is exactly the kind of case dense embeddings or LLM-based variant selection are needed for, and is left as a documented motivating case for the next iteration.

## Citation guardrails

The generator prompt (`src/acr_assistant/generation/prompts.py`) enforces three rules:

1. Every recommendation must include a `citation_id` that matches a retrieved chunk.
2. If retrieval confidence is below threshold, return `INSUFFICIENT_EVIDENCE` instead of generating.
3. Procedures not present in the retrieved context are forbidden.

The pipeline (`src/acr_assistant/pipeline.py`) double-checks citations after generation and strips any that don't validate.

## License + safety

This is a research prototype. Not for clinical use. No PHI should be entered into the system.
