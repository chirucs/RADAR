"""Streamlit UI for the ACR Consult Assistant.

Run locally:
    streamlit run streamlit_app.py

Deploy online (Streamlit Community Cloud):
    1. Push this repo to GitHub
    2. Go to https://share.streamlit.io and connect the repo
    3. App entrypoint: streamlit_app.py
    4. (Optional) Add ANTHROPIC_API_KEY in app secrets to enable Claude mode
"""
import json
import os
import sys
from pathlib import Path

import streamlit as st

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "src"))

from acr_assistant.config import get_settings  # noqa: E402
from acr_assistant.ingestion.parser import kb_to_chunks, load_kb  # noqa: E402
from acr_assistant.pipeline import ConsultPipeline  # noqa: E402
from acr_assistant.retrieval.retriever import build_index  # noqa: E402


st.set_page_config(
    page_title="ACR Consult Assistant",
    page_icon="🩺",
    layout="wide",
    initial_sidebar_state="expanded",
)


# ----- pipeline (cached) -----
@st.cache_resource(show_spinner="Building index from knowledge base…")
def get_pipeline(api_key: str, model: str, top_k: int, min_top_score: float) -> ConsultPipeline:
    s = get_settings()
    s.anthropic_api_key = api_key
    s.llm_model = model
    s.retrieval_top_k = top_k
    kb = load_kb(s.kb_abs())
    retriever = build_index(kb_to_chunks(kb))
    pipeline = ConsultPipeline(retriever, s)
    pipeline._min_top_score = min_top_score
    return pipeline


def run_consult(pipeline: ConsultPipeline, scenario: str, min_top_score: float) -> dict:
    """Same as pipeline.run() but threads the user's min_top_score override through."""
    retrieved = pipeline.retriever.retrieve(
        scenario,
        top_k=pipeline.settings.retrieval_top_k,
        min_top_score=min_top_score,
    )
    from acr_assistant.generation.llm import generate_consult
    result = generate_consult(
        scenario=scenario,
        retrieved=retrieved,
        api_key=pipeline.settings.anthropic_api_key,
        model=pipeline.settings.llm_model,
        max_tokens=pipeline.settings.max_tokens,
    )
    result = pipeline._validate_citations(result)
    result["_retrieval"] = [
        {
            "chunk_id": r.chunk.chunk_id,
            "topic_id": r.chunk.topic_id,
            "variant_id": r.chunk.variant_id,
            "score": round(r.score, 4),
            "normalized_score": round(r.normalized_score, 4),
        }
        for r in retrieved
    ]
    return result


# ----- sidebar: settings -----
with st.sidebar:
    st.markdown("### ⚙️ Settings")

    secret_key = ""
    try:
        secret_key = st.secrets.get("ANTHROPIC_API_KEY", "")
    except Exception:
        pass
    env_key = os.getenv("ANTHROPIC_API_KEY", "")
    default_key = secret_key or env_key

    api_key = st.text_input(
        "Anthropic API key (optional)",
        value=default_key,
        type="password",
        help="Leave blank to use stub mode. Stub returns deterministic structured output from the top-retrieved variant — useful for verifying retrieval. With a key, Claude generates the response.",
    )

    model = st.selectbox(
        "Model",
        ["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
        index=0,
        disabled=not api_key,
    )

    st.markdown("---")
    st.markdown("**Retrieval**")
    top_k = st.slider("top-k", 1, 10, 5)
    min_top_score = st.slider(
        "min top BM25 score",
        0.0, 10.0, 2.0, step=0.5,
        help="Below this, return INSUFFICIENT_EVIDENCE. Real medical queries score >=5; off-topic queries score <2.",
    )

    st.markdown("---")
    show_retrieval = st.checkbox("Show retrieval debug", value=True)
    show_raw_json = st.checkbox("Show raw JSON", value=False)

    if st.button("🔄 Rebuild index"):
        get_pipeline.clear()
        st.success("Index will rebuild on next query.")

    st.markdown("---")
    st.caption(
        "**Mode:** "
        + ("🟢 Claude" if api_key else "🟡 Stub (no API key)")
    )


# ----- header -----
st.title("🩺 ACR Appropriateness Criteria — Consult Assistant")
st.caption("LLM + RAG consult-support tool grounded in the ACR Appropriateness Criteria. "
           "Research prototype — not for clinical use. Do not enter PHI.")


# ----- input -----
EXAMPLES = {
    "Thunderclap headache": "42-year-old woman with sudden severe headache, peak intensity within seconds, described as worst headache of her life. No prior trauma. What is the appropriate initial imaging?",
    "Pregnant RLQ pain": "28-year-old pregnant woman, second trimester, with right lower quadrant pain, fever, leukocytosis. Suspected appendicitis.",
    "Pediatric RLQ pain": "8-year-old boy, RLQ pain, fever, vomiting. Suspected appendicitis.",
    "Low-intermediate ACS": "55-year-old man, acute chest pain in ED. Two negative troponins, ECG non-diagnostic. Considered low-to-intermediate probability ACS. What rule-out imaging?",
    "Suspected PE": "45-year-old woman, dyspnea and pleuritic chest pain. Wells score intermediate. Normal renal function. Suspected pulmonary embolism.",
    "LBP with red flags": "67-year-old man with low back pain and a history of prostate cancer; new onset of bowel incontinence and saddle anesthesia.",
    "Acute LBP, no red flags": "34-year-old man with three days of mild low back pain after lifting groceries. No fever, no neurologic symptoms.",
    "Off-topic (negative test)": "What is the capital of France?",
}

if "scenario" not in st.session_state:
    st.session_state.scenario = ""

st.markdown("**Quick examples:**")
example_cols = st.columns(4)
for i, (name, text) in enumerate(EXAMPLES.items()):
    if example_cols[i % 4].button(name, key=f"ex_{i}", use_container_width=True):
        st.session_state.scenario = text

scenario = st.text_area(
    "Clinical scenario",
    value=st.session_state.scenario,
    height=100,
    placeholder="e.g. 42F, sudden severe headache, worst of life, no trauma. Initial imaging?",
    key="scenario_input",
)

c1, c2 = st.columns([1, 6])
submit = c1.button("Get recommendation", type="primary", use_container_width=True)
clear = c2.button("Clear", use_container_width=False)
if clear:
    st.session_state.scenario = ""
    st.rerun()


# ----- result rendering -----
def category_color(cat: str) -> str:
    if not cat:
        return "gray"
    c = cat.lower()
    if "usually appropriate" in c:
        return "green"
    if "may be" in c:
        return "orange"
    return "red"


def render_result(j: dict) -> None:
    if j.get("topic_match") == "INSUFFICIENT_EVIDENCE":
        st.warning(
            "**INSUFFICIENT_EVIDENCE** — no matching ACR guideline retrieved with sufficient confidence. "
            "Refine the scenario or the case may fall outside the loaded knowledge base."
        )
        if reason := j.get("_reason"):
            st.caption(f"reason: {reason}")
        return

    # Header row
    head_cols = st.columns([2, 2, 1, 1])
    head_cols[0].metric("Topic", j.get("topic_match") or "—")
    head_cols[1].metric("Variant", j.get("variant_match") or "—")
    head_cols[2].metric("Confidence", j.get("confidence") or "—")
    head_cols[3].metric("Mode", j.get("_mode") or "—")

    if scenario_text := j.get("matched_scenario"):
        st.info(f"**Matched scenario:** {scenario_text}")

    flags = j.get("safety_flags") or {}
    if flags.get("radiation_concerns"):
        st.warning(f"☢ **Radiation:** {flags['radiation_concerns']}")
    if flags.get("contrast_concerns"):
        st.warning(f"💧 **IV contrast:** {flags['contrast_concerns']}")

    rejected = j.get("_rejected_recommendations") or []
    if rejected:
        st.error(
            f"⚠️ {len(rejected)} recommendation(s) were stripped — citation_id did not match a retrieved chunk. "
            "(This is the post-generation citation guardrail in action.)"
        )
        with st.expander("Rejected recommendations"):
            st.json(rejected)

    recs = j.get("recommendations") or []
    if not recs:
        st.warning("No recommendations returned.")
    else:
        st.markdown("### Recommendations")
        for r in recs:
            color = category_color(r.get("category"))
            score = r.get("appropriateness")
            badges = []
            if r.get("rrl"):
                badges.append(f":gray-badge[RRL: {r['rrl']}]")
            if r.get("uses_contrast"):
                badges.append(":blue-badge[IV contrast]")
            badges_str = " ".join(badges)
            with st.container(border=True):
                line = f":{color}-badge[{score}/9 · {r.get('category','—')}] **{r.get('procedure','?')}** {badges_str}"
                st.markdown(line)
                if rationale := r.get("rationale"):
                    st.caption(rationale)
                st.caption(f"citation: `{r.get('citation_id','?')}`")

    if change := j.get("what_would_change_management"):
        st.markdown(f"**What would change management:** {change}")

    if show_retrieval:
        with st.expander("🔍 Retrieval debug"):
            ret = j.get("_retrieval") or []
            if ret:
                st.dataframe(ret, use_container_width=True, hide_index=True)
            else:
                st.caption("(no retrieval results)")

    if show_raw_json:
        with st.expander("📦 Raw JSON"):
            st.json(j)


# ----- run -----
if submit and scenario.strip():
    pipeline = get_pipeline(api_key, model, top_k, min_top_score)
    with st.spinner("Retrieving and generating…"):
        result = run_consult(pipeline, scenario.strip(), min_top_score)
    st.divider()
    render_result(result)
elif submit:
    st.warning("Please enter a clinical scenario.")


# ----- footer -----
st.divider()
with st.expander("ℹ️ About this tool"):
    st.markdown(
        """
**What it does.** Takes a free-text clinical scenario and returns ranked imaging recommendations
grounded in the ACR Appropriateness Criteria, with explicit citations.

**Pipeline:**
1. **Retrieve** — BM25 over the variant-level knowledge base, with an absolute-score floor that
   sends off-topic queries to `INSUFFICIENT_EVIDENCE`.
2. **Generate** — Claude (or a deterministic stub if no API key) produces structured JSON,
   constrained by a system prompt that forbids procedures or citations not in the retrieved context.
3. **Validate** — citations are re-checked post-generation; any rec citing a chunk_id outside
   the retrieved set is stripped.

**Knowledge base.** The seed `data/raw/sample_acr_kb.json` is *synthetic and illustrative*.
The official ACR Appropriateness Criteria® are copyrighted; production use requires licensed ingestion.

**Disclaimer.** Research prototype. Not for clinical use. Do not enter PHI.
        """
    )
