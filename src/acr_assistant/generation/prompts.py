SYSTEM_PROMPT = """You are a radiology consult-support assistant grounded in the ACR Appropriateness Criteria.
You support radiologists during consultation; you do not replace clinical judgment.

You MUST follow these rules without exception:

1. GROUNDING: Recommend ONLY procedures that appear verbatim in the retrieved CONTEXT below.
   Never recommend a procedure that is not present in the retrieved context.

2. CITATION: Every recommendation MUST include a `citation_id` that exactly matches the
   `chunk_id` of one of the retrieved chunks. No citation_id may be invented.

3. INSUFFICIENT EVIDENCE: If the retrieved context does not adequately match the clinical
   scenario, set `topic_match` to "INSUFFICIENT_EVIDENCE" and return an empty
   `recommendations` list. Do not guess.

4. STRUCTURE: Return a single JSON object matching the requested schema. No prose outside JSON.

5. SAFETY FLAGS: Surface radiation (RRL) and IV-contrast considerations explicitly when present.

6. ORDERING: Recommendations must be ordered by appropriateness score, descending.
"""


OUTPUT_SCHEMA = """{
  "topic_match": "<topic_id from the retrieved context, or INSUFFICIENT_EVIDENCE>",
  "variant_match": "<variant_id from the retrieved context, or null>",
  "matched_scenario": "<the scenario string of the matched variant, or null>",
  "recommendations": [
    {
      "procedure": "<exact procedure name from context>",
      "appropriateness": <int 1-9>,
      "category": "<Usually Appropriate | May Be Appropriate | Usually Not Appropriate>",
      "rationale": "<one-sentence rationale grounded in the context>",
      "rrl": "<O | low | medium | high | very_high>",
      "uses_contrast": <true|false>,
      "citation_id": "<chunk_id, must match a retrieved chunk>"
    }
  ],
  "safety_flags": {
    "radiation_concerns": "<short note or null>",
    "contrast_concerns": "<short note or null>"
  },
  "what_would_change_management": "<one-sentence note on conditional modifiers, or null>",
  "confidence": "<high | medium | low>"
}"""


def _format_chunk(chunk_id: str, text: str, citation: str) -> str:
    return f"[CHUNK_ID: {chunk_id}]\n[CITATION: {citation}]\n{text}\n"


def build_user_prompt(clinical_scenario: str, retrieved_chunks) -> str:
    """retrieved_chunks: List[RetrievalResult]"""
    if not retrieved_chunks:
        context = "(no relevant context retrieved)"
    else:
        context = "\n---\n".join(
            _format_chunk(r.chunk.chunk_id, r.chunk.text, r.chunk.citation)
            for r in retrieved_chunks
        )
    return f"""CLINICAL SCENARIO:
{clinical_scenario}

RETRIEVED CONTEXT:
{context}

Return a single JSON object matching this schema (no prose outside JSON):

{OUTPUT_SCHEMA}
"""
