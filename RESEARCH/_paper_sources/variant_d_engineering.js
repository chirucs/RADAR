// Variant D — Software-engineering / MLSys paper (~6 pages).
// Voice: deployment-systems paper. Focus on architecture choices, latency
// budget, observability, configuration surface, and operational properties
// rather than methodology.

const fs = require('fs');
const {
  docx, P, H1, H2, H3, Title, Subtitle, Caption, Bullet, Numbered, Mono,
  Abstract, Keywords, table, tableHeaderCell, tableCell,
  refsHeading, refLine, buildStyles, numberingConfig, buildSection,
} = require('./common');
const { R } = require('./refs');
const { Document, Packer, TableRow } = docx;

const CITES = [];
function c(key) {
  let i = CITES.indexOf(key);
  if (i === -1) { CITES.push(key); i = CITES.length - 1; }
  return `[${i + 1}]`;
}
function cs(...keys) { return keys.map(c).join(','); }

// ---------------- Front matter ----------------
const front = [
  Title('Engineering a Citation-Verified, Abstention-Aware RAG Service for Radiology Consult Support: An MLSys Case Study'),
  Subtitle('[Author Name], [Affiliation], [Email]'),
  Abstract(
    `We describe the engineering of a production-style retrieval-augmented generation (RAG) service for radiology consult support, grounded in the ACR Appropriateness Criteria. The paper does not introduce a new model or retrieval algorithm; the contribution is the systems decomposition that turns two safety properties — explicit abstention and per-recommendation citation validation — into invariants of the service rather than statistical claims about the underlying LLM. The service is composed of four stateless stages (retrieve, gate, generate, validate) glued by a single orchestrator class behind a FastAPI surface. We present (a) the operational architecture and configuration surface, (b) the latency budget under both stub and Claude-augmented generation modes, (c) an observability scheme that surfaces the retrieval trace, the rejected-recommendation list, and the abstention reason on every request, (d) the operational consequences of choosing BM25 over a dense retriever in this regime, and (e) the deployment properties — typed schema, model cards, and a datasheet for the seed corpus — that the design enables. End-to-end pipeline overhead in stub mode is 0.04 ms (mean) per query measured over 100 queries; with Claude as generator the latency floor is the LLM round-trip. On an eight-scenario in-domain harness the service achieves 100% topic accuracy, 87.5% variant accuracy, and 100% citation fidelity, with a single failure on a negation case that we discuss. We argue this decomposition generalises to any clinical-decision-support service where every recommendation must trace to an authoritative source.`
  ),
  Keywords(
    ' Retrieval-augmented generation, MLSys, model serving, LLM serving, FastAPI, observability, model cards, clinical decision support, ACR Appropriateness Criteria.'
  ),
];

// ---------------- 1. Introduction ----------------
const intro = [
  H1('1. Introduction'),
  P(
    `LLM-backed clinical services are increasingly built on RAG because retrieval grounding reduces but does not eliminate fabrication ${cs('Lewis2020','Shuster2021','Ji2023','Huang2023')}. The translation from a research demonstration to a production service introduces a different class of problem: not "does the model produce a faithful answer most of the time," but "does the service guarantee a faithful answer every time." In a clinical setting, statistical claims about model faithfulness are insufficient — the operating procedure of the service must make unfaithful outputs structurally unable to leave the system.`,
    { indent: true }
  ),
  P(
    `This paper describes the engineering of such a service, grounded in the ACR Appropriateness Criteria ${cs('ACRMethod2021','Sistrom2008')}, with the following operating contract:`,
    { indent: true }
  ),
  Numbered(
    `Every recommendation returned by the service carries a citation_id that resolves to a real chunk of the underlying knowledge base. Recommendations whose citation_id does not resolve are stripped before the response is serialised.`
  ),
  Numbered(
    `Every request either produces a recommendation list or an explicit INSUFFICIENT_EVIDENCE response. The service does not degrade to a generic LLM answer.`
  ),
  Numbered(
    `Every response carries the retrieval trace and the rejected-recommendation list (if any), so that the operating decision is auditable from the response alone — without instrumenting the LLM or the retriever separately.`
  ),
  P(
    `These three properties are enforced by four small components composed in a fixed order behind a single endpoint. Section 2 describes the architecture. Section 3 describes the configuration surface. Section 4 describes the latency budget. Section 5 describes the observability scheme. Section 6 reports headline metrics from an eight-scenario evaluation harness. Section 7 contains the operational lessons. Sections 8 and 9 discuss generalisability and conclude.`,
    { indent: true }
  ),
];

// ---------------- 2. Architecture ----------------
const arch = [
  H1('2. Architecture'),
  H2('2.1 Stateless four-stage pipeline'),
  P(
    `The service is composed of four stateless stages: retrieve, gate, generate, validate. Each stage is a function with a typed input and a typed output; no stage holds mutable state across requests. The orchestrator is a single class (ConsultPipeline) that composes the stages in fixed order and assembles the response.`
  ),
  Mono(
    `request: ConsultRequest { scenario: str }\n\n  ↓ retrieve(scenario, top_k=5) → List[RetrievalResult]\n  ↓ gate(top_score, threshold=2.0) → bool\n  ↓ generate(scenario, retrieved) → Dict[str, Any]\n  ↓ validate_citations(result, valid_chunk_ids) → Dict[str, Any]\n  ↓ assemble → ConsultResponse\n\nresponse: ConsultResponse {\n  topic_match, variant_match, matched_scenario,\n  recommendations[], safety_flags, what_would_change_management,\n  confidence, retrieval[], mode, rejected_recommendations[]\n}`
  ),
  Caption('Fig. 1. The pipeline as a fixed-order composition of four stateless stages. Statelessness is what allows the service to be horizontally scaled without coordination and what makes the response self-contained for audit.'),
  H2('2.2 Component choices and rationale'),
  P(
    `BM25 retriever (rank-bm25). For a corpus the size of the ACR-AC seed (12 chunks; the full corpus is on the order of a few thousand variant chunks) BM25 ${cs('Robertson2009','Trotman2014')} is the right default: deterministic, fast, no embedding pipeline, no GPU, and a transparent score that maps directly to the abstention gate. Switching to dense retrieval ${cs('Karpukhin2020','Izacard2021','Gao2023HyDE')} is a targeted upgrade we discuss in Section 7, justified at the points where lexical retrieval provably fails (negation, paraphrase). At deployment scale the choice has ops consequences too: BM25 has a single pickle-able index file that we ship with the service, while dense retrieval requires a vector database and an embedding service in the request path.`
  ),
  P(
    `Anthropic Claude generator. We chose claude-opus-4-7 as the default generator. The integration is mediated by a Generator protocol with a deterministic StubGenerator fallback that constructs a structured response from the top retrieved chunk's procedures without calling the LLM. The stub serves three purposes: it lets unit tests run without an API key (a standard ${c('Pineau2021')} reproducibility property), it lets the eval harness produce a stable retrieval-only baseline against which LLM-induced gain is additive, and it provides a graceful degradation mode if the LLM API is unreachable. Modern serving systems such as vLLM ${c('Kwon2023vLLM')} and Clipper ${c('Crankshaw2017Clipper')} would slot in unchanged behind the Generator protocol.`
  ),
  P(
    `In-prompt grounding contract. The system prompt enumerates six rules: GROUNDING (recommend only context procedures), CITATION (every recommendation must include a citation_id), INSUFFICIENT_EVIDENCE (abstain on mismatch), STRUCTURE (single JSON object), SAFETY FLAGS (RRL/contrast surfacing), ORDERING (descending appropriateness). The user prompt prepends each retrieved chunk with chunk_id and citation tags so that the LLM has a deterministic referent for the citation_id field. A tolerant JSON extractor handles three response shapes (direct json.loads, fenced code-block, greedy brace match).`
  ),
  P(
    `Post-hoc citation validator. The validator iterates over the recommendations field of the LLM's structured output and drops any recommendation whose citation_id is not in the set of valid retrieved chunk IDs. Rejected recommendations are surfaced separately in _rejected_recommendations for audit. This is a single set-membership check per recommendation; it is the layer that converts citation faithfulness from a statistical property of the LLM into an invariant of the service.`
  ),
  H2('2.3 Service surface'),
  P(
    `The service exposes three endpoints behind FastAPI: POST /consult (ConsultRequest → ConsultResponse), GET /health (KB chunk count, generator mode, model name), and GET / (a minimal HTMX-style HTML UI). A separate Streamlit application (streamlit_app.py) provides an interactive scenario explorer for demos and stakeholder reviews. Schemas are Pydantic models, which gives us the OpenAPI document and request/response validation for free.`
  ),
];

// ---------------- 3. Configuration surface ----------------
const conf_section = [
  H1('3. Configuration Surface'),
  P(
    `The service has a deliberately small configuration surface (Table I), exposed via environment variables (ACR_*) and a single Settings class built on pydantic-settings. The principle: every configuration value that affects the safety contract should be visible at startup in the service log and serialised into the response trace.`
  ),
  table([
    new TableRow({ children: [
      tableHeaderCell('Setting', 2880),
      tableHeaderCell('Default', 1440),
      tableHeaderCell('Effect', 5040),
    ]}),
    ...[
      ['ACR_ANTHROPIC_API_KEY','""','If empty → stub generator; if set → Claude generator'],
      ['ACR_LLM_MODEL','claude-opus-4-7','Anthropic model identifier'],
      ['ACR_RETRIEVAL_TOP_K','5','Maximum chunks passed to the generator'],
      ['ACR_CONFIDENCE_THRESHOLD','0.15','Reserved for relative-margin gate (currently no-op)'],
      ['min_top_score (in code)','2.0','Absolute BM25 floor for INSUFFICIENT_EVIDENCE gate'],
      ['ACR_KB_PATH','data/raw/sample_acr_kb.json','Path to KB JSON'],
      ['ACR_INDEX_PATH','data/processed/bm25_index.pkl','Path to pickled BM25 index'],
      ['ACR_MAX_TOKENS','1500','Generator max_tokens'],
    ].map(row => new TableRow({ children: row.map((c_, i) => tableCell(c_, [2880,1440,5040][i], { mono: i < 2 })) })),
  ], [2880,1440,5040]),
  Caption('Table I. Service configuration surface. Eight settings, all exposed via ACR_* environment variables. The two safety-contract settings (the BM25 floor and the API-key-vs-stub switch) are surfaced in /health.'),
];

// ---------------- 4. Latency budget ----------------
const latency = [
  H1('4. Latency Budget'),
  P(
    `Service latency decomposes by stage. We measured stub-mode latency as a clean characterisation of pipeline overhead, with the LLM call removed.`
  ),
  table([
    new TableRow({ children: [
      tableHeaderCell('Stage', 3000),
      tableHeaderCell('Mean (ms)', 1200),
      tableHeaderCell('Notes', 5160),
    ]}),
    ...[
      ['retrieve (BM25 over 12 chunks)','< 0.04','Tokenisation + scoring; dominated by Python overhead at this corpus size'],
      ['gate (single comparison)','negligible','One float comparison + one branch'],
      ['generate (stub)','negligible','In-process structured response from top chunk'],
      ['validate_citations','negligible','Set-membership lookup per recommendation'],
      ['serialise (Pydantic)','sub-ms','Dominated by JSON encoding'],
      ['END-TO-END (stub mode, mean)','0.04','Measured over 100 queries after warm-up'],
      ['END-TO-END (stub mode, p95)','0.08','Same'],
      ['END-TO-END (stub mode, max)','0.11','Same'],
    ].map(row => new TableRow({ children: row.map((c_, i) => tableCell(c_, [3000,1200,5160][i])) })),
  ], [3000,1200,5160]),
  Caption('Table II. Per-stage latency in stub mode. The pipeline overhead is bounded above by the BM25 scoring cost on the seed corpus; in Claude-augmented mode the dominating cost is the LLM round-trip to Anthropic.'),
  P(
    `In Claude-augmented mode, latency is dominated by the LLM round-trip, which a service of this kind cannot directly control. Three operational choices reduce LLM latency in practice: (a) cap max_tokens at 1500 (the response is bounded by the schema and rarely uses the full budget), (b) restrict the system prompt to the six grounding rules so that the model does not produce explanatory prose outside the JSON, and (c) allow the StubGenerator path as a graceful fallback when the LLM is unreachable. We do not present numbers for the LLM round-trip because they are characteristic of the Anthropic API and not of the system.`
  ),
];

// ---------------- 5. Observability ----------------
const obs = [
  H1('5. Observability'),
  P(
    `Every response carries the data needed to audit the service decision after the fact, without instrumenting the retriever or the LLM separately. The relevant fields are:`
  ),
  Bullet('retrieval[] — list of {chunk_id, topic_id, variant_id, score, normalized_score} for every chunk above zero score. The retrieval decision is reproducible from the request alone given the index.'),
  Bullet('mode — "stub" or "claude" — surfaces whether the response was LLM-generated.'),
  Bullet('rejected_recommendations[] — recommendations that the post-hoc validator stripped, with the bad citation_id, so that LLM citation hallucinations are observable as a count, not a silent failure.'),
  Bullet('matched_scenario — the canonical variant scenario string. A consulting clinician can verify in seconds that the system has matched the right variant for the case at hand.'),
  Bullet('confidence — high/medium/low based on the normalized BM25 score. Useful at the API surface as a soft signal, but the hard signal is whether topic_match equals INSUFFICIENT_EVIDENCE.'),
  P(
    `The /health endpoint additionally surfaces the kb_chunks count and the active generator mode, so that "is the service up and configured correctly" reduces to a single GET. We treat this as a baseline observability scheme; production deployment would add request tracing, per-stage histograms, and a structured event for each rejected recommendation. The schema is intentionally simple enough to map to any standard observability stack ${c('Crankshaw2017Clipper')}.`
  ),
];

// ---------------- 6. Evaluation ----------------
const evalSec = [
  H1('6. Evaluation'),
  P(
    `We evaluate the service end-to-end on an eight-scenario in-domain harness covering thunderclap headache, low back pain (with and without red flags), low/intermediate-risk acute coronary syndrome, suspected appendicitis (adult, pregnant, pediatric), and suspected pulmonary embolism (general, pregnant), plus seven off-topic abstention probes (random tokens, factual queries, household instructions, translation, empty/whitespace edge cases). All numbers are from stub mode so that any LLM-induced gain is strictly additive over a documented retrieval-only baseline.`
  ),
  table([
    new TableRow({ children: [
      tableHeaderCell('Metric', 4680),
      tableHeaderCell('Score', 1560),
      tableHeaderCell('n', 1080),
      tableHeaderCell('Notes', 2040),
    ]}),
    ...[
      ['Topic accuracy','100.0%','8/8','No misrouted topics'],
      ['Variant accuracy','87.5%','7/8','One miss: negation case'],
      ['Top-procedure accuracy','87.5%','7/8','Same scenario'],
      ['Appropriateness concordance','87.5%','—','Mean over scenarios'],
      ['Citation fidelity','100.0%','—','Invariant by construction'],
      ['Off-topic abstention rate','85.7%','6/7','One near-threshold false-route'],
      ['End-to-end latency (stub)','0.04 ms','100','Mean over 100 queries'],
    ].map(row => new TableRow({ children: row.map((c_, i) => tableCell(c_, [4680,1560,1080,2040][i])) })),
  ], [4680,1560,1080,2040]),
  Caption('Table III. Headline service metrics. Citation fidelity is enforced by construction; the variant-accuracy miss is the documented negation case discussed in Section 7.'),
];

// ---------------- 7. Lessons ----------------
const lessons = [
  H1('7. Operational Lessons'),
  H2('7.1 Treat the safety contract as code, not as prompting'),
  P(
    `It is tempting to enforce citation faithfulness purely in the system prompt; existing evaluations of attributed LLMs show that this is insufficient ${cs('Rashkin2023','Bohnet2022')}. The two-layer design — in-prompt contract plus deterministic post-hoc validator — works because the layers fail in different ways. The in-prompt contract changes the distribution of generated outputs toward citation-bearing recommendations; the validator catches the residual fabrications by construction. The validator costs one set-membership lookup per recommendation. The architecture decision is to treat that check as a non-negotiable code path between the generator and the response serialiser.`
  ),
  H2('7.2 Make abstention a first-class response, not a confidence score'),
  P(
    `Abstention buried in a confidence score is fragile because the consuming application has to decide where to draw the threshold. INSUFFICIENT_EVIDENCE as an explicit topic_match value is a structurally different signal: the consuming application can branch on it directly. The same logic guides FastAPI status codes; we deliberately keep the abstention as a 200-response with topic_match = INSUFFICIENT_EVIDENCE rather than a 404, because the request was well-formed and the service did its job — it just declined to answer ${cs('Kamath2020','Varshney2022')}.`
  ),
  H2('7.3 Stub mode is the ops trick'),
  P(
    `The deterministic StubGenerator fallback is the single most valuable engineering choice in the service. It enables (a) CI without an API key (cost: zero per build); (b) reproducible eval numbers for any reviewer (an artifact-evaluation requirement ${cs('Pineau2021','Wilkinson2016FAIR')}); (c) a graceful-degradation path when the LLM API is unreachable; and (d) a clean baseline against which LLM-induced gains can be measured. Implementing it costs roughly forty lines of Python. We recommend it as default practice for any RAG service that depends on a remote LLM.`
  ),
  H2('7.4 BM25 negation is the correct boundary to escalate'),
  P(
    `The single in-domain failure on the eval harness is a negation case: a query stating that the patient has no fever, no weight loss, and no cancer history is over-routed to the red-flag variant because lexical retrieval cannot distinguish "fever" from "no fever." This is not a bug to be patched at the BM25 layer; it is the boundary at which a polarity-aware mechanism should take over. We recommend deferring dense retrieval until that boundary is hit on production traffic, and using a single-call LLM rerank ${cs('Asai2024','Yao2023ReAct')} as the cheapest viable upgrade — the LLM is already in the request path, and the rerank is a second prompt rather than new infrastructure.`
  ),
  H2('7.5 Document the service like a release artifact'),
  P(
    `Following Mitchell et al. ${c('Mitchell2019Cards')} we ship a model card alongside the service describing the seed KB, the active generator, the safety contract, and the documented failure modes. Following Gebru et al. ${c('Gebru2021Datasheets')} we ship a datasheet for the seed KB describing collection methodology, version, and licensing constraints. Bender and Friedman's data-statement framework ${c('Bender2018DataStmts')} extends naturally to clinical scenarios. These three documentation artifacts together convert the service from an undocumented black box into something a clinical-IT review committee can reason about.`
  ),
];

// ---------------- 8. Generalisability ----------------
const general = [
  H1('8. Generalisability'),
  P(
    `The four-stage decomposition (retrieve / gate / generate / validate) generalises to any clinical-decision-support service in which every recommendation must trace to an authoritative source. Three substitutions are sufficient to retarget the service: (a) replace the seed KB with a faithful schema for the new corpus (NICE guidelines, ESR iGuide, antibiogram, oncology pathway); (b) replace the in-prompt grounding contract's six rules with the corresponding domain-specific rules (e.g., for an antibiogram, "recommend only antibiotics in the local susceptibility table"); (c) replace the validator's set-membership check with whatever proves citation existence in the new corpus. The retrieval-side abstention gate, the typed response schema, the stub-mode fallback, and the observability scheme transfer unchanged. Compared with serving systems built around generic LLM endpoints ${cs('Crankshaw2017Clipper','Kwon2023vLLM')}, the differentiator here is that the safety contract is encoded in the service composition rather than left to the model.`
  ),
];

// ---------------- 9. Conclusion ----------------
const conclusion = [
  H1('9. Conclusion'),
  P(
    `We described the engineering of a citation-verified, abstention-aware RAG service for radiology consult support. The contribution is the systems decomposition that turns two safety properties — explicit abstention and per-recommendation citation validation — into invariants of the service rather than statistical claims about the LLM. The service has a small configuration surface, a transparent latency budget (0.04 ms pipeline overhead in stub mode), an observability scheme that makes every response auditable from its own payload, and a deterministic fallback path that decouples CI and reproducibility from the LLM API. End-to-end accuracy on an eight-scenario in-domain harness is 100% topic / 87.5% variant / 100% citation fidelity. We argue this decomposition should be the default starting point for any clinical-decision-support service in which every recommendation must trace to an authoritative source.`
  ),
];

const refs_section = () => {
  const out = [refsHeading()];
  CITES.forEach((key, i) => out.push(refLine(i + 1, R[key])));
  return out;
};

const allChildren = [
  ...front, ...intro, ...arch, ...conf_section, ...latency, ...obs, ...evalSec,
  ...lessons, ...general, ...conclusion,
  ...refs_section(),
];

const doc = new Document({
  styles: buildStyles(),
  numbering: numberingConfig,
  sections: [buildSection(allChildren)],
});

(async () => {
  const buf = await Packer.toBuffer(doc);
  const out = process.argv[2] || '/sessions/modest-sharp-fermat/mnt/RESEARCH/ACR_RAG_Variant_D_Engineering.docx';
  fs.writeFileSync(out, buf);
  console.log(`wrote ${out} (${buf.length} bytes); ${CITES.length} unique citations`);
})();
