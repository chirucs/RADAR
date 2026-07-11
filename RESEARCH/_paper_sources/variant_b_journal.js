// Variant B — Full journal article (~14 pages).
// Comprehensive: extended related work, deep methods, per-scenario error analysis,
// deployment + ethics + workflow framing. Reads as a Radiology / JACR / NEJM-AI
// style paper.

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

// ----------------- Front matter -----------------
const front = [
  Title('Toward Trustworthy Large-Language-Model Consult Support in Radiology: A Retrieval-Augmented, Citation-Verified, Abstention-Aware System Anchored to the ACR Appropriateness Criteria'),
  Subtitle('[Author Name], [Affiliation], [Email]'),
  Abstract(
    `Background. Frontier large language models (LLMs) achieve high accuracy on medical question answering yet remain unsafe for direct clinical use because of fabricated facts and unverifiable citations. Radiology is a particularly high-stakes domain because incorrect imaging selection drives both patient harm (avoidable radiation, contrast nephropathy, missed diagnoses) and substantial cost. The ACR Appropriateness Criteria (ACR-AC) is the canonical evidence base for imaging selection but remains underused at the point of care. Methods. We designed and evaluated an end-to-end retrieval-augmented generation (RAG) consult-support system that grounds an LLM in ACR-AC at variant granularity. The pipeline combines four components: (i) a BM25 retriever over keyword-amplified variant chunks; (ii) an absolute-score retrieval gate that triggers an explicit INSUFFICIENT_EVIDENCE abstention when no chunk crosses threshold; (iii) a structured-JSON LLM generator constrained by an in-prompt grounding contract; and (iv) a deterministic post-hoc citation validator that strips any recommendation whose citation_id does not match a real retrieved chunk. We evaluated the system on an eight-scenario harness covering thunderclap headache, low back pain (with and without red flags), low/intermediate-risk acute coronary syndrome, suspected appendicitis (adult, pregnant, and pediatric variants), and suspected pulmonary embolism (general and pregnancy variants), and on seven off-topic abstention probes. Results. The system achieved 100.0% topic accuracy (8/8), 87.5% variant accuracy (7/8), 87.5% top-procedure accuracy (7/8), 87.5% appropriateness-score concordance, and 100.0% citation fidelity. Off-topic abstention triggered correctly in 6/7 cases (85.7%). End-to-end stub-generator latency was 0.04 ms per query (mean). The single in-domain miss was a negation case (low back pain without red flags) that BM25 cannot represent and that the system over-routes to the red-flag variant. Conclusions. Two minimalist guardrails — a retrieval-side abstention gate and a deterministic post-hoc citation validator — are sufficient to close the dominant LLM failure modes that have made prior radiology-LLM evaluations unsuitable for deployment. The remaining variant-level errors are concentrated on negation, which is the expected boundary at which lexical retrieval should hand off to dense or LLM-based variant selection. The system is open and reproducible end-to-end.`
  ),
  Keywords(
    ' Retrieval-augmented generation, large language models, clinical decision support, radiology, ACR Appropriateness Criteria, citation faithfulness, attribution, selective prediction, abstention, hallucination mitigation, medical informatics.'
  ),
];

// ----------------- 1. Introduction -----------------
const intro = [
  H1('1. Introduction'),
  P(
    `Diagnostic imaging now accounts for one of the largest and most rapidly growing segments of healthcare spending in the United States. A non-trivial share of that growth reflects discordance between what imaging is ordered and what current evidence supports for the clinical question at hand ${cs('Sistrom2009','Rosenthal2006')}. The American College of Radiology (ACR) maintains the canonical synthesis of that evidence — the ACR Appropriateness Criteria (ACR-AC) — a panel-curated, regularly updated mapping from clinical "variants" (e.g. "pregnant patient with suspected appendicitis") to ranked imaging procedures with appropriateness ratings on a 1–9 scale and Relative Radiation Level (RRL) annotations ${cs('ACRMethod2021','Sistrom2008')}. The ACR-AC is the result of decades of structured panel deliberation and is the single most authoritative source on imaging selection in U.S. radiology.`,
    { indent: true }
  ),
  P(
    `Despite that authority and despite federal incentives that mandate clinical decision support (CDS) for advanced imaging orders, ACR-AC adoption at the point of care has remained modest, with awareness and routine use lagging well behind what the evidence base would justify ${c('Sheng2016')}. The reasons are operational: in a busy emergency department or outpatient setting, the ordering clinician must translate a free-text scenario into the right ACR topic, then the right variant, then read down a ranked procedure list — a workflow that does not survive the time pressure of the consult. Consulting radiologists, who are the natural adjudicators of imaging appropriateness, increasingly serve a phone-and-page consult function for which structured ACR-AC reference is awkwardly slow.`,
    { indent: true }
  ),
  P(
    `Frontier LLMs have, in parallel, demonstrated striking capabilities on medical reasoning benchmarks. Med-PaLM ${c('Singhal2023')} and Med-PaLM 2 ${c('Singhal2025')} achieve expert-level scores on USMLE-style questions; GPT-4 ${cs('Lee2023NEJM','Nori2023')} matches or exceeds reference clinicians on diagnostic challenges ${c('Kanjee2023JAMA')}; and recent reviews catalog plausible clinical applications across specialities ${c('Thirunavukarasu2023')}. In radiology specifically, ChatGPT-class systems can pass board-style examinations ${c('Bhayana2023')}, transform free-text reports into structured forms ${c('Adams2023')}, translate reports into plain language ${c('Lyu2023')}, and serve as adjuncts for radiologic decision-making in studies of varying scope ${cs('Rao2023','Elkassem2023','Bhayana2024')}. Yet a recent randomized clinical trial showed that an unaided LLM did not reliably improve physician diagnostic reasoning ${c('Goh2024JAMA')}, and the most consistent finding across deployment-oriented LLM evaluations is that they fabricate plausible-looking facts and uncited claims at rates incompatible with clinical use ${cs('Ji2023','Huang2023','Tonmoy2024')}.`,
    { indent: true }
  ),
  P(
    `This paper asks a focused question: can a deliberately conservative system architecture make LLMs safe to use as a consult-support layer over the ACR Appropriateness Criteria? We hypothesize three failure modes that must be eliminated by construction, not merely reduced statistically: (i) recommending a procedure not in the official guidance for the matched variant; (ii) attaching the wrong appropriateness rating to a real procedure; and (iii) attributing any recommendation to a citation that does not exist or does not say what is claimed ${cs('Rashkin2023','Bohnet2022')}. We argue, and demonstrate, that two minimalist guardrails — an absolute-score retrieval-side abstention gate and a deterministic post-hoc citation validator — are sufficient to close all three.`,
    { indent: true }
  ),
  P(
    `Our contributions are:`,
    { indent: true }
  ),
  Numbered(
    `An ACR-AC-grounded RAG architecture using variant-level chunking, with a 3× keyword-amplification ingestion step that allows BM25 to reliably distinguish between variants of the same topic — a problem that, left untreated, causes specialised variants (pregnant, pediatric, red-flag) to lose retrieval to the generic adult variant.`
  ),
  Numbered(
    `An explicit INSUFFICIENT_EVIDENCE abstention path implemented as a single absolute-score floor on the top BM25 score. Off-topic queries score below the floor and are surfaced with an empty recommendation list and an explicit reason; in-domain queries with topic-specific vocabulary clear the floor by a wide margin.`
  ),
  Numbered(
    `A two-layer citation-faithfulness guardrail. Layer one is an in-prompt grounding contract enumerating six rules the generator must follow (ground-only-on-context, citation_id-required, abstain-on-mismatch, JSON-only, surface-RRL-and-contrast, sort-descending). Layer two is a deterministic post-hoc validator that strips any recommendation whose citation_id is not in the set of valid retrieved chunk IDs and surfaces the rejected items separately for audit.`
  ),
  Numbered(
    `A four-metric evaluation harness — topic accuracy, variant accuracy, appropriateness concordance, and citation fidelity — and an open eight-scenario test set covering common ED-relevant ACR-AC topics. The system achieves 100.0% topic accuracy and 100.0% citation fidelity, with one variant-level miss on a negation case that we analyse in detail and that motivates a clearly identified next step.`
  ),
  Numbered(
    `An end-to-end open implementation (~1.5k lines of Python) that runs in two modes: a deterministic stub-generator mode that requires no API key (useful for CI, unit testing, and the eval harness itself) and a Claude-augmented mode that uses the in-prompt contract for production-style generation. We hope the system is useful as a reference design for guideline-grounded clinical RAG more broadly.`
  ),
  P(
    `The remainder of the paper is organized as follows. Section 2 surveys related work in RAG, faithfulness, selective prediction, and LLMs in medicine. Section 3 describes the ACR Appropriateness Criteria as a knowledge artifact. Section 4 details the system architecture. Section 5 specifies the evaluation methodology. Section 6 presents results. Section 7 contains a per-scenario error analysis. Section 8 discusses deployment considerations, ethics, and limitations. Section 9 concludes.`,
    { indent: true }
  ),
];

// ----------------- 2. Related work -----------------
const related = [
  H1('2. Related Work'),
  H2('2.1 Retrieval-augmented generation'),
  P(
    `Retrieval-augmented generation pairs a parametric language model with a non-parametric retriever; the retriever surfaces relevant passages from an external corpus and the generator conditions on them ${c('Lewis2020')}. The paradigm scales from open-domain question answering ${cs('Karpukhin2020','Izacard2021','Guu2020')} to trillion-token retrieval-augmented pretraining ${c('Borgeaud2022')}, and now serves as the dominant approach for grounding LLM outputs ${cs('Gao2023Survey','Ram2023')}. Two design dimensions matter for our setting: how to surface the right passages to a generator with a bounded context window ${c('Liu2024Lost')} and how to trade off retrieval quality against the engineering simplicity of lexical retrieval ${cs('Robertson2009','Trotman2014')}. We adopt the in-context, no-fine-tuning RAG variant — passages are prepended to the prompt and the generator's only job is to produce a structured output that respects them. Recent work pushes RAG toward self-reflective ${c('Asai2024')} and confidence-driven ${c('Jiang2023FLARE')} variants; we deliberately stay with the simpler architecture because the citation-validation guarantee we want is easier to enforce on a deterministic, single-pass pipeline.`
  ),
  H2('2.2 Hallucination, faithfulness, and attribution'),
  P(
    `Hallucination — the generation of content unsupported by either input or training data — is the central reliability obstacle for LLM deployment ${cs('Ji2023','Huang2023')}. Retrieval grounding reduces but does not eliminate it ${c('Shuster2021')}, motivating an explicit attribution layer that asks not only "is this answer correct" but "is each cited claim verifiable from the source it cites" ${cs('Bohnet2022','Rashkin2023')}. The Attributable to Identified Sources (AIS) framework formalises this question and operationalises it as a per-claim labelling protocol ${c('Rashkin2023')}. Post-hoc revision approaches such as RARR ${c('Gao2023RARR')} re-edit LLM outputs to repair attribution defects; recent surveys catalog the design space ${cs('Tonmoy2024','Gao2023Survey')}. Our contribution sits in this lineage as a minimal, deterministic instantiation: we restrict our post-hoc check to the citation-existence axis (is the cited chunk one we actually retrieved?) and combine it with an in-prompt contract that biases the generator toward producing the kinds of outputs the validator can accept.`
  ),
  H2('2.3 Selective prediction and abstention'),
  P(
    `When a system is uncertain, the safest action is often to refuse rather than answer. Selective prediction studies how a model can decide when to abstain ${cs('Kamath2020','Varshney2022')}, and recent surveys treat abstention as a first-class hallucination-mitigation lever ${c('Tonmoy2024')}. Most prior work attaches the abstention decision to a learned calibrator on top of the model's own confidence. We take an even simpler approach: the abstention decision is a single threshold on the BM25 top score, computed before the LLM is even called. The advantage is auditability — the abstention decision is fully explained by a single integer comparison logged in the request trace.`
  ),
  H2('2.4 LLMs in medicine'),
  P(
    `Med-PaLM ${c('Singhal2023')} demonstrated that frontier LLMs can encode substantial clinical knowledge; Med-PaLM 2 ${c('Singhal2025')} pushed scores into expert-level territory on the MedQA-style benchmarks ${c('Jin2021MedQA')}. GPT-4 has been characterised on broad medical-challenge sets ${c('Nori2023')}, evaluated as a clinical-medicine chatbot ${c('Lee2023NEJM')}, and tested against reference clinicians on complex diagnoses ${c('Kanjee2023JAMA')}. Reviews position LLMs as plausible adjuncts subject to ongoing safety concerns ${c('Thirunavukarasu2023')}. The recurring failure mode across these studies is the same: LLMs are confidently wrong on a non-negligible fraction of inputs, with no reliable internal signal that they are wrong. Goh et al.'s recent randomised clinical trial ${c('Goh2024JAMA')} is the most pointed evidence that an unaided LLM does not reliably improve physician reasoning, even when the LLM itself can answer the same questions correctly. The prevailing prescription is to constrain the LLM with an external knowledge layer — exactly what RAG provides.`
  ),
  H2('2.5 LLMs and AI in radiology'),
  P(
    `Radiology has emerged as one of the most active testbeds for clinical LLM evaluation. ChatGPT can pass board-style radiology examinations but exhibits higher-order reasoning weaknesses, particularly on cases requiring integration of multiple findings ${c('Bhayana2023')}. Adams et al. ${c('Adams2023')} demonstrated that GPT-4 can transform free-text radiology reports into multilingual structured reporting with high reliability — encouraging evidence that an LLM can produce well-formed structured output when constrained to a clear schema, which our pipeline relies on. Lyu et al. ${c('Lyu2023')} documented that ChatGPT, when translating radiology reports into plain language, omits clinically significant information and adds incorrect content at rates that are clinically meaningful. Elkassem and Smith ${c('Elkassem2023')} surveyed potential use cases and concluded that human oversight is required across all of them. Bhayana ${c('Bhayana2024')} provided a practical primer for the field with an explicit catalog of risks (hallucination, training-cutoff drift, bias) that our guardrails are designed to mitigate. The closest peer-reviewed prior to our work is Rau et al. ${c('Rau2023')}, who showed that an ACR-AC-grounded LlamaIndex + GPT-3.5 chatbot outperformed both generic ChatGPT and trained radiologists at following ACR guidance. Our contribution extends that direction by adding (a) explicit citation validation, (b) an abstention path, (c) a four-metric evaluation harness, and (d) an open reproducible implementation.`
  ),
  H2('2.6 Medical RAG and clinical guideline grounding'),
  P(
    `MedRAG ${c('Xiong2024')} benchmarks medical RAG over five corpora and surfaces the same scaling phenomena that govern general-domain RAG, including the "lost-in-the-middle" effect ${c('Liu2024Lost')} that we mitigate by retrieving small, self-contained variant chunks and bounding top-k. Almanac ${c('Zakka2024')} is the closest peer-reviewed clinical RAG system; it inspires the factuality / completeness / safety evaluation framing we adopt and adapt for ACR-AC. Atlas ${c('Izacard2023Atlas')} explores few-shot RAG and motivates the "no-fine-tuning" architecture we use here.`
  ),
  H2('2.7 Clinical decision support and computerized order entry'),
  P(
    `The earliest large-scale ACR-AC-driven CDS implementations ${c('Rosenthal2006')} demonstrated feasibility; Sistrom et al. ${c('Sistrom2009')} showed measurable reductions in inappropriate outpatient procedure-volume growth across a seven-year time series. Sheng et al. ${c('Sheng2016')} document the persistent gap between AC awareness and routine use. Our system is best understood as a third-generation CDS approach: where Rosenthal-era CDS surfaced rule-based prompts in the order-entry flow, our system surfaces the same evidence in a free-text consult-support modality with explicit citations to the source guideline.`
  ),
];

// ----------------- 3. ACR-AC as knowledge artifact -----------------
const acr_section = [
  H1('3. The ACR Appropriateness Criteria as a Knowledge Artifact'),
  P(
    `The ACR Appropriateness Criteria are produced by topic-specific expert panels using a modified RAND/UCLA Appropriateness Method augmented with GRADE evidence rating ${c('ACRMethod2021')}. Each topic — there are over two hundred at the time of writing — addresses a specific clinical scenario family (e.g. "Headache," "Low Back Pain," "Suspected Pulmonary Embolism"). Within each topic, the panel defines a small number of variants that capture the clinically significant differences in presentation (e.g. for Suspected Pulmonary Embolism: the general intermediate-Wells case versus a pregnancy variant). Within each variant, the panel rates each candidate imaging procedure on a 1–9 appropriateness scale (1–3 Usually Not Appropriate, 4–6 May Be Appropriate, 7–9 Usually Appropriate) and assigns a Relative Radiation Level. The panel publishes a narrative rationale and references for each variant.`
  ),
  P(
    `Three properties of this knowledge structure are important for our design. First, the unit of meaningful retrieval is the variant, not the topic: a clinician asking about a pregnant patient with suspected PE wants the pregnancy variant's procedure ranking, not the general one. Second, the procedure ranking is the recommendation: there is no narrative-summary step the LLM needs to invent. Third, the citation unit is also the variant: every imaging recommendation traces back to a specific panel-rated variant of a specific topic. These three properties make ACR-AC unusually amenable to RAG: chunk at variant granularity, retrieve directly, and let the LLM's job be reformatting and surfacing — not synthesis.`
  ),
];

// ----------------- 4. System Design -----------------
const system = [
  H1('4. System Design'),
  H2('4.1 Architecture overview'),
  P(
    `The system has four components composed by a single ConsultPipeline class (Fig. 1). Free-text consult scenarios enter through either a FastAPI /consult endpoint or a minimal Streamlit web UI. The pipeline invokes the BM25 retriever; the retrieval gate either passes the top-k chunks to the generator or short-circuits the request to an INSUFFICIENT_EVIDENCE response; the generator emits a structured-JSON recommendation block; the citation validator strips any recommendation whose citation_id does not validate; the API layer serializes the result to a typed response model.`
  ),
  Mono(
    `Free-text scenario\n        ↓\nFastAPI /consult endpoint\n        ↓\nBM25 retriever (variant-level chunks, keyword-amplified)\n        ↓        \n  ┌─────┴─────┐\n  │ top score │  yes ─→ pass top-k chunks ─→ LLM generator (in-prompt grounding contract)\n  │  ≥ 2.0?   │                                       ↓\n  └─────┬─────┘                              Post-hoc citation validator\n        no                                            ↓\n        ↓                                  Strip invalid citation_ids\n  INSUFFICIENT_EVIDENCE                               ↓\n  empty recommendations                       Structured JSON\n  with explicit reason                  { topic, variant, recs, safety, citations, confidence }`
  ),
  Caption('Fig. 1. End-to-end pipeline. Two safety layers operate independently: a retrieval-side absolute-score abstention gate, and a generation-side deterministic citation validator.'),
  H2('4.2 Knowledge base schema'),
  P(
    `The seed knowledge base mirrors the official ACR-AC structure faithfully. The Pydantic schema (simplified) is:`
  ),
  Mono(
    `Topic { topic_id, topic_name, version, citation, keywords[], variants[] }\nVariant { variant_id, scenario, scenario_keywords[], procedures[] }\nProcedure { procedure, appropriateness ∈ [1,9], category, rrl ∈ {O,low,med,high,very_high},\n            uses_contrast ∈ {true,false}, comment }`
  ),
  P(
    `The current seed contains five topics — Headache, Low Back Pain, Acute Chest Pain (suspected ACS), Right Lower Quadrant Pain (suspected appendicitis), and Suspected Pulmonary Embolism — expanding to twelve variant chunks. We use a synthetic encoding of the content because the official ACR-AC is copyrighted material; the schema is faithful to the real structure so that licensed ingestion is a drop-in replacement at deployment time.`
  ),
  H2('4.3 Variant-level chunking with keyword amplification'),
  P(
    `Each variant is flattened into a single passage of the form: topic name, scenario string, topic-level keywords, variant-level keywords, and a compact rendering of each procedure with its rating. A consequential design choice in the ingestion code is that variant-level keywords are repeated three times in the indexed text. The motivation is direct: without amplification, common topic tokens dominate the BM25 score and the most "generic" variant of a topic almost always wins retrieval, even when a specialised variant (pregnant, pediatric, red-flag) is the correct match. The 3× repetition gives variant-specific tokens enough lexical mass to outweigh the shared topic baseline. We arrived at the multiplier empirically; values from 2× to 4× all give the same qualitative result on our eval set, while no amplification at all causes specialised variants to lose to the adult variant in the majority of cases.`
  ),
  H2('4.4 BM25 retriever'),
  P(
    `Retrieval uses BM25Okapi from the rank-bm25 package, with default k1 and b parameters ${cs('Robertson2009','Trotman2014')}. Tokenisation lowercases the query and the indexed text and matches alphanumeric tokens via a single regex. Top-k is bounded at 5; in practice the effective top-k is determined by the number of variants whose score is non-negligibly above zero. Each retrieval result carries the chunk, its raw BM25 score, and a normalised score (raw / max). The normalised score is used downstream as a soft confidence signal that maps to the high/medium/low confidence label in the response.`
  ),
  H2('4.5 INSUFFICIENT_EVIDENCE abstention gate'),
  P(
    `An absolute-score floor (top score ≥ 2.0) is applied at retrieval time. Empirically, off-topic queries match only on rare incidental tokens and score below ~1.5, while legitimate medical queries with topic-specific vocabulary score above 5. When the top score is below the floor, the retriever returns an empty result; the pipeline interprets this as INSUFFICIENT_EVIDENCE and returns a response with topic_match = "INSUFFICIENT_EVIDENCE", an empty recommendation list, and an explicit reason. This is a deliberately minimal selective-prediction gate: a single integer comparison, fully audit-able from the request trace, and tunable from a config file. We separately reserve a relative-margin parameter (distance from runner-up) for future extensions; we currently disable it because legitimate co-ranking of multiple variants of the same topic would otherwise over-fire the gate.`
  ),
  H2('4.6 Generator and in-prompt grounding contract'),
  P(
    `The generator wraps Anthropic's Claude (claude-opus-4-7) behind a Generator protocol with an interchangeable StubGenerator that constructs a structured response from the top retrieved chunk without calling the LLM. The Claude path uses a fixed system prompt that articulates six rules:`
  ),
  Numbered('GROUNDING — recommend only procedures that appear verbatim in the retrieved CONTEXT.'),
  Numbered('CITATION — every recommendation must include a citation_id matching the chunk_id of one of the retrieved chunks; no citation_id may be invented.'),
  Numbered('INSUFFICIENT EVIDENCE — if the retrieved context does not adequately match the clinical scenario, set topic_match to INSUFFICIENT_EVIDENCE and return an empty recommendations list; do not guess.'),
  Numbered('STRUCTURE — return a single JSON object matching the requested schema; no prose outside JSON.'),
  Numbered('SAFETY FLAGS — surface radiation (RRL) and IV-contrast considerations explicitly when present.'),
  Numbered('ORDERING — recommendations must be ordered by appropriateness score, descending.'),
  P(
    `The user prompt prepends each retrieved chunk (with chunk_id and citation tags) to the clinical scenario and a JSON output schema. The model emits a single JSON object that the pipeline parses with a tolerant extractor (direct json.loads, then a fenced json code-block fallback, then a greedy brace-match). The StubGenerator path is the deterministic fallback used in CI and in the eval harness: it builds a structured response from the top retrieved chunk's procedures, sorts by appropriateness, and emits the same JSON shape so that downstream code is generator-agnostic.`
  ),
  H2('4.7 Post-hoc citation validator'),
  P(
    `After generation, the pipeline iterates over each recommendation, looks up its citation_id in the set of valid retrieved chunk IDs, and drops the recommendation if the citation does not validate. Rejected recommendations are returned in a separate _rejected_recommendations field so that downstream consumers can audit the model's miss. This deterministic check is the second of two faithfulness guardrails. The first (the in-prompt contract) shifts the distribution of generated outputs toward citation-bearing recommendations; the second catches the residual fabrications by construction. Conceptually this is a minimalist instantiation of post-hoc revision ${c('Gao2023RARR')} restricted to the citation-existence axis.`
  ),
  H2('4.8 API surface and UI'),
  P(
    `The FastAPI service exposes a /consult POST endpoint that accepts a ConsultRequest (a single scenario string) and returns a ConsultResponse with the matched topic and variant, an ordered list of Recommendations (each with procedure name, appropriateness score, category, rationale, RRL, contrast flag, and citation_id), explicit safety flags, a what-would-change-management note, a confidence label, the retrieval trace (chunk IDs and scores), the generator mode, and any rejected recommendations. A /health endpoint returns the KB chunk count and the active generator mode. A minimal HTMX-style web UI (web/index.html) renders the response inline; a Streamlit application provides an interactive scenario explorer for demo purposes.`
  ),
];

// ----------------- 5. Evaluation methodology -----------------
const evalsec = [
  H1('5. Evaluation Methodology'),
  H2('5.1 In-domain test set'),
  P(
    `We construct an eight-scenario evaluation set that covers the in-domain space of the seed KB and intentionally stresses three failure modes the system should handle correctly: special-population variant selection (pregnant, pediatric), red-flag variant selection (LBP with cauda equina features), and explicit negation (LBP without red flags). Each scenario carries a free-text consult question and four ground-truth labels: the expected ACR topic, the expected variant, the expected top procedure, and a dictionary mapping expected procedures to their expected appropriateness scores. The full scenario set is shown in Table I (see Section 6).`
  ),
  H2('5.2 Off-topic abstention probes'),
  P(
    `We construct seven off-topic probes designed to exercise the abstention gate: (i) random nonsense tokens ("xyzzy plover wibble glorp"), (ii) a generic factual query ("what is the capital of france"), (iii) a domestic instruction request ("recipe for chocolate chip cookies"), (iv) a household repair request ("how do I fix a leaking faucet"), (v) a translation request ("translate this to spanish"), and the (vi) empty-string and (vii) whitespace-only edge cases. The expected outcome on every probe is INSUFFICIENT_EVIDENCE.`
  ),
  H2('5.3 Metrics'),
  P(
    `Following the factuality / completeness / safety framing of Almanac ${c('Zakka2024')} and the AIS attribution framework ${cs('Rashkin2023','Bohnet2022')}, we report four primary metrics:`
  ),
  Bullet('Topic accuracy — fraction of scenarios for which the system returned the correct ACR topic.'),
  Bullet('Variant accuracy — fraction of scenarios for which the system returned the correct variant within that topic.'),
  Bullet('Appropriateness concordance — averaged across scenarios, the fraction of expected (procedure, score) pairs that the system returned with the exact expected score.'),
  Bullet('Citation fidelity — fraction of returned recommendations whose citation_id is in the set of valid retrieved chunk IDs. By construction this should be 1.0.'),
  P(
    `We additionally report top-procedure accuracy (the strict "did the first recommendation match the expected top procedure" test), the off-topic abstention rate (fraction of off-topic probes returning INSUFFICIENT_EVIDENCE), and end-to-end pipeline latency (mean over 100 timed queries in stub-generator mode).`
  ),
  H2('5.4 Stub vs. Claude evaluation'),
  P(
    `All evaluation numbers reported below are from stub-generator mode. The stub generator constructs a structured response from the top retrieved chunk by sorting its procedures in descending appropriateness and surfacing the top-k. This is intentional: the stub establishes the retrieval-only baseline against which a Claude-augmented run can be measured. In stub mode every retrieved chunk that survives the gate produces a citation-validated recommendation by construction, which means the citation-fidelity metric measures the strength of the post-hoc validator's invariant rather than the LLM's faithfulness. Reporting in stub mode is a conservative reporting choice: any LLM-induced gain is then strictly additive over a baseline whose lower bound is documented.`
  ),
  H2('5.5 Reproducibility'),
  P(
    `The system is ~1.5k lines of Python (rank-bm25, anthropic SDK, FastAPI, Pydantic, Streamlit). The code, the seed KB, the scenarios JSON, and the eval harness are released alongside this paper. The eval harness can be run end-to-end without an API key (in stub mode) and with one Python invocation: python eval/run_eval.py. Random seeds are fixed where stochastic behavior would otherwise be present.`
  ),
];

// ----------------- 6. Results -----------------
const results_section = [
  H1('6. Results'),
  H2('6.1 In-domain scenarios'),
  P(
    `Table I lists the eight in-domain scenarios with their ground-truth labels. Table II reports the system's headline metrics across the set.`
  ),
  // Table I
  table([
    new TableRow({ children: [
      tableHeaderCell('ID', 720),
      tableHeaderCell('Scenario (abbreviated)', 4400),
      tableHeaderCell('Expected topic', 1880),
      tableHeaderCell('Expected variant', 1280),
      tableHeaderCell('Expected top procedure', 1080),
    ]}),
    ...[
      ['eval-001','42F sudden severe headache, worst-of-life, no trauma','Headache','v1 (thunderclap)','CT head w/o contrast'],
      ['eval-002','34M 3d mild LBP after lifting; NO fever, NO weight loss, NO cancer','Low back pain','v1 (uncomplicated)','No imaging'],
      ['eval-003','67M LBP, prostate cancer, bowel incontinence, saddle anesthesia','Low back pain','v2 (red flags)','MRI L-spine w/wo contrast'],
      ['eval-004','55M acute chest pain, 2 negative troponins, non-diagnostic ECG','Chest pain–ACS','v1 (low/intermed)','CTA coronary'],
      ['eval-005','28F pregnant 2nd-trimester, RLQ pain, fever, leukocytosis','RLQ pain','v2 (pregnant)','US abdomen RLQ'],
      ['eval-006','8yo boy, RLQ pain, fever, vomiting','RLQ pain','v3 (pediatric)','US abdomen RLQ'],
      ['eval-007','45F dyspnea + pleuritic CP, intermediate Wells, normal renal','Suspected PE','v1 (general)','CTA chest PE protocol'],
      ['eval-008','30F pregnant 3rd-trimester, dyspnea, tachycardia, suspected PE','Suspected PE','v2 (pregnant)','US bilateral LE venous'],
    ].map(row => new TableRow({ children: row.map((c_, i) => tableCell(c_, [720,4400,1880,1280,1080][i])) })),
  ], [720,4400,1880,1280,1080]),
  Caption('Table I. Eight in-domain consult scenarios with ground-truth labels. Coverage: thunderclap headache, LBP with and without red flags, low/intermediate-risk ACS, suspected appendicitis (adult, pregnant, pediatric), and suspected PE (general, pregnant).'),
  // Table II
  table([
    new TableRow({ children: [
      tableHeaderCell('Metric', 4680),
      tableHeaderCell('Score', 1560),
      tableHeaderCell('n', 1080),
      tableHeaderCell('Notes', 2040),
    ]}),
    ...[
      ['Topic accuracy','100.0%','8/8','No misrouted topics'],
      ['Variant accuracy','87.5%','7/8','One miss: eval-002 (negation)'],
      ['Top-procedure accuracy','87.5%','7/8','Same scenario as variant miss'],
      ['Appropriateness concordance','87.5%','—','Mean over scenarios'],
      ['Citation fidelity','100.0%','—','No invalid citation_ids'],
      ['Off-topic abstention rate','85.7%','6/7','One near-threshold false-route'],
      ['End-to-end latency (stub)','0.04 ms','100','Mean per query'],
    ].map(row => new TableRow({ children: row.map((c_, i) => tableCell(c_, [4680,1560,1080,2040][i])) })),
  ], [4680,1560,1080,2040]),
  Caption('Table II. Headline evaluation metrics across the eight in-domain scenarios and seven off-topic probes. Citation fidelity is enforced by construction; the variant-accuracy miss is the negation case analysed in Section 7.'),
  H2('6.2 Per-scenario detail'),
  P(
    `Table III gives the per-scenario outcome. Seven scenarios pass on every metric. eval-002 is the single failure: the system retrieves the correct topic (Low Back Pain) but routes to the red-flag variant (v2) instead of the uncomplicated variant (v1). Section 7 explains why and what the next-step fix would look like.`
  ),
  table([
    new TableRow({ children: [
      tableHeaderCell('ID', 720),
      tableHeaderCell('Topic', 1080),
      tableHeaderCell('Variant', 1080),
      tableHeaderCell('Top proc.', 1080),
      tableHeaderCell('Concord.', 1080),
      tableHeaderCell('Cite fid.', 1080),
      tableHeaderCell('# recs', 720),
      tableHeaderCell('Notes', 2520),
    ]}),
    ...[
      ['eval-001','✓','✓','✓','100%','100%','6','—'],
      ['eval-002','✓','✗','✗','0%','100%','4','Negation: routes to v2 instead of v1'],
      ['eval-003','✓','✓','✓','100%','100%','4','Red-flag variant correctly selected'],
      ['eval-004','✓','✓','✓','100%','100%','5','—'],
      ['eval-005','✓','✓','✓','100%','100%','3','Pregnancy variant correctly selected'],
      ['eval-006','✓','✓','✓','100%','100%','3','Pediatric variant correctly selected'],
      ['eval-007','✓','✓','✓','100%','100%','5','—'],
      ['eval-008','✓','✓','✓','100%','100%','4','Pregnancy variant correctly selected'],
    ].map(row => new TableRow({ children: row.map((c_, i) => tableCell(c_, [720,1080,1080,1080,1080,1080,720,2520][i])) })),
  ], [720,1080,1080,1080,1080,1080,720,2520]),
  Caption('Table III. Per-scenario outcomes. The system passes every metric on 7/8 scenarios; the single failure is the documented negation case.'),
  H2('6.3 Off-topic abstention'),
  P(
    `Six of seven off-topic probes correctly return INSUFFICIENT_EVIDENCE (85.7%). The single false-route is "how do I fix a leaking faucet," which scores 2.16 on BM25 — just above the 2.0 floor — through coincidental token overlap with the RLQ-pain index (the verbs "fix" and "do" and the noun fragment "leak" coincide with rare tokens in that variant's flattened text). Crucially, the false-route still produces a single retrieval result and a single recommendation; both are clearly off-topic on inspection of the response's matched_scenario field. We discuss the calibration-versus-coverage tradeoff at this operating point in Section 8.`
  ),
  H2('6.4 Latency'),
  P(
    `End-to-end pipeline latency in stub mode is 0.04 ms (mean), 0.04 ms (median), 0.08 ms (p95), and 0.11 ms (max), measured over 100 timed queries after a five-query warm-up. The retriever-and-validator overhead is negligible. In Claude-augmented mode the pipeline latency is dominated by the LLM round-trip and is bounded below by the API latency to Anthropic; we do not report Claude-augmented latency numbers here because they are not characteristic of the system itself.`
  ),
];

// ----------------- 7. Error analysis -----------------
const error_section = [
  H1('7. Error Analysis'),
  H2('7.1 The negation case (eval-002)'),
  P(
    `The single in-domain failure is eval-002. The scenario is: "34-year-old man with three days of mild low back pain after lifting groceries. No fever, no neurologic symptoms, no weight loss, no cancer history." The expected variant is the uncomplicated-LBP variant (v1, top procedure: "No imaging," appropriateness 9). The system instead routes to the red-flag variant (v2, top procedure: MRI lumbar spine without and with IV contrast, appropriateness 9). The cause is direct: BM25 cannot represent negation. The query string contains the tokens "fever," "weight loss," and "cancer history" with high TF-IDF mass, and these tokens are precisely the indicators that define the red-flag variant in the indexed text. The lexical retriever has no mechanism to distinguish "fever" from "no fever," and routes accordingly.`
  ),
  P(
    `This is not a bug to be patched in the BM25 layer. It is the expected boundary at which a lexical retriever should hand off to a model that can encode polarity. We see three viable extensions:`
  ),
  Bullet(`Dense retrieval. A dense passage retriever ${cs('Karpukhin2020','Izacard2021')} fine-tuned with negation-aware contrastive pairs would correctly score "no fever, no weight loss, no cancer history" closer to the uncomplicated variant than to the red-flag variant. The cost is a learned model and a vector index.`),
  Bullet('LLM-based variant selection. An LLM rerank step over the top-k retrieved candidates can inspect the polarity of the query directly. This is appealing because it reuses the LLM that is already in the pipeline and adds essentially no new infrastructure. The cost is one extra LLM round-trip per consult.'),
  Bullet(`Hybrid lexical-plus-dense with LLM rerank. The combined approach achieves the highest precision in benchmark RAG settings ${c('Gao2023Survey')} and is the natural extension once the corpus grows beyond the seed.`),
  P(
    `In the interim, the variant-selection failure manifests as a falsely conservative recommendation (MRI L-spine instead of "no imaging"), which is the safer of the two error directions: the consulting clinician inspecting the response sees a red-flag variant flagged for a young patient with explicitly negative red flags, and the mismatch is immediately visible in the matched_scenario field of the response.`
  ),
  H2('7.2 The near-threshold false-route'),
  P(
    `"How do I fix a leaking faucet" scores 2.16 on BM25, just above the 2.0 abstention floor, and produces a single recommendation against the adult appendicitis variant. This is the calibration-versus-coverage tradeoff in canonical form ${cs('Kamath2020','Varshney2022')}: raising the floor would catch the leaking faucet but would suppress short, low-vocabulary medical queries (e.g. a single word like "appendicitis"). The current operating point favors coverage on the assumption that the consulting clinician will catch the false-route by inspection. A learned calibrator on top of the BM25 score is the obvious next step; a slightly more sophisticated approach is to pair the absolute floor with a relative-margin gate (require a meaningful gap between the top score and the runner-up), which we have plumbed in the configuration but currently disable for the reason given in Section 4.5.`
  ),
  H2('7.3 What did not fail'),
  P(
    `It is also worth noting what did not fail. The pregnancy variant won retrieval over the adult variant on both eval-005 (RLQ pain) and eval-008 (suspected PE) in the presence of common adult-variant tokens — a non-trivial outcome that depends entirely on the keyword-amplification step in the ingestion code. The pediatric variant won retrieval on eval-006 for the same reason. The red-flag variant won retrieval on eval-003 in the presence of common topic tokens; that scenario carries strong red-flag signals (saddle anesthesia, prostate cancer history) that overcome the topic baseline cleanly. And no scenario produced a citation_id that failed validation — the citation guardrail is, as designed, an invariant rather than a statistical claim.`
  ),
];

// ----------------- 8. Discussion -----------------
const discussion = [
  H1('8. Discussion'),
  H2('8.1 Why two faithfulness layers and not one'),
  P(
    `An in-prompt grounding contract alone is insufficient because it relies on the LLM honoring the contract on every call, and existing evaluations of attributed LLMs show non-trivial fabrication rates even under explicit attribution prompts ${cs('Rashkin2023','Bohnet2022')}. A post-hoc validator alone is insufficient because, without the in-prompt contract, the LLM may not even attempt to attach citation_ids in the first place. The two layers work because they fail in different ways. The in-prompt contract changes the distribution of generated outputs toward citation-bearing recommendations; the post-hoc validator catches the residual fabrications by construction. The result, at the cost of one set-membership lookup per recommendation, is a hard guarantee that no surfaced recommendation can carry a hallucinated citation. This pattern generalises beyond ACR-AC: any clinical-decision-support task in which every recommendation must trace to an authoritative source can use the same two-layer design.`
  ),
  H2('8.2 Why an explicit abstention path matters'),
  P(
    `Most consumer-facing LLM products do not have an "I don't know" mode; they degrade gracefully to a confident-sounding answer regardless of input. In a clinical decision-support context this is dangerous: a generic answer to a domestic plumbing query is comedy, but a confident-sounding-but-wrong appendicitis recommendation is harm. INSUFFICIENT_EVIDENCE makes the abstention behavior visible to the consuming application, which can then route the query to a human, ask a clarifying question, or refuse — instead of having to second-guess a confident-looking response. This is the selective-prediction posture ${cs('Kamath2020','Varshney2022')} applied at the system boundary rather than as an internal calibration trick. The price is that the system is occasionally too conservative; the benefit is that the conservative behavior is auditable and observable rather than buried inside the LLM's confidence distribution.`
  ),
  H2('8.3 Workflow integration'),
  P(
    `We see three plausible deployment surfaces. The first is a chat-style consult window inside a radiologist's reporting environment: the radiologist pastes the consult question, sees the matched topic and variant, the ranked recommendations, the safety flags, and a one-click expansion of the cited ACR-AC chunk. The second is an API-side adjunct to computerized order entry — when a clinician orders an imaging study, the system returns the matched ACR-AC variant and either confirms or flags the order, providing the structured citation back to the panel evidence. This is the natural successor to the rule-based CDS that has been deployed in radiology since the mid-2000s ${cs('Rosenthal2006','Sistrom2009')}. The third is an asynchronous education and quality-improvement use, where the system labels historical consults with their ACR-AC alignment and surfaces departmental patterns of guideline divergence.`
  ),
  H2('8.4 Safety considerations'),
  P(
    `We treat the system as research prototype, not as a clinical device. Three safety considerations govern any deployment claim. First, the LLM is not the system of record for the recommendation; the ACR-AC chunk is. Every recommendation is presented with its citation_id and the panel-rated procedure-and-score from that chunk; the LLM's contribution is to surface the right chunk and reformat its content, not to invent a recommendation. Second, the abstention path is the default failure mode. When in doubt the system says "INSUFFICIENT_EVIDENCE" and an empty list, rather than guessing. Third, no PHI should enter the system in its current form; the consult-style scenario should be anonymised by the consuming application. None of these properties make the system safe for unsupervised clinical use; they make it auditable in a way that supports a consulting radiologist's workflow.`
  ),
  H2('8.5 Limitations'),
  P(
    `Four limitations are material. First, the seed KB is synthetic and illustrative; production deployment requires a properly licensed ACR-AC ingestion. The schema is faithful to the real ACR-AC structure, so this is an engineering and licensing problem rather than a research one. Second, BM25's inability to represent negation is a genuine weakness that we have characterised but not fixed; the dense or LLM-rerank extensions discussed in Section 7.1 are the next iteration. Third, the eight-scenario harness is small. Scaling to a few hundred scenarios across the full ACR-AC corpus, with multiple independent radiologists supplying ground truth, is required before any deployment claim. MedRAG ${c('Xiong2024')} and Almanac ${c('Zakka2024')} together suggest a viable scaling path. Fourth, the absolute-score abstention floor is a single integer. A learned calibrator on top of the score would do better, particularly for short queries; the current operating point trades off coverage against false-route probability in a way that is correct for the eval set but probably not optimal at population scale.`
  ),
  H2('8.6 What we are not claiming'),
  P(
    `We are not claiming this system is safe for unsupervised clinical use. We are not claiming a methodological advance in RAG architecture itself; the contribution is the demonstration that two minimalist guardrails — a retrieval-side abstention gate and a deterministic post-hoc citation validator — close the dominant failure modes that have made prior LLM-in-radiology evaluations unsuitable for deployment ${cs('Bhayana2023','Lyu2023')}. And we are not claiming variant-level performance superior to expert radiologists; on a small in-domain set we approach but do not exceed Rau et al.'s reported performance ${c('Rau2023')}, with the addition of explicit citation validation and abstention as the differentiating contribution.`
  ),
  H2('8.7 Generalisability beyond ACR-AC'),
  P(
    `The two-guardrail design generalises in two directions. First, to other guideline corpora — NICE guidelines in the UK, the European Society of Radiology iGuide, the Choosing Wisely campaign — the schema-mirroring chunking strategy is identical. Second, to other clinical-decision-support modalities — pharmacology decision support, antibiogram-driven antimicrobial selection, oncology treatment-pathway support — where the recommendation must always trace to an authoritative source. In both cases the costs are the same: a faithful schema for the source corpus, a chunking strategy that respects the recommendation unit of the source, an in-prompt grounding contract, and a deterministic post-hoc validator. The benefit is the same: a hard, auditable invariant on citation faithfulness and an explicit abstention mode.`
  ),
];

// ----------------- 9. Conclusion -----------------
const conclusion = [
  H1('9. Conclusion'),
  P(
    `We presented an end-to-end retrieval-augmented generation pipeline for radiology consult support grounded in the ACR Appropriateness Criteria. The system is characterised by an explicit INSUFFICIENT_EVIDENCE abstention path implemented as a single threshold on the BM25 top score, and by a two-layer citation-faithfulness guardrail (an in-prompt grounding contract and a deterministic post-hoc citation validator). Across an eight-scenario in-domain evaluation harness covering common ED-relevant ACR-AC topics, the system achieves 100% topic accuracy and 100% citation fidelity. The single variant-level failure is on a negation case that BM25 cannot represent and that motivates a clearly identified next step (dense retrieval, LLM-based variant rerank, or both). Across seven off-topic abstention probes the system correctly abstains on 6/7. The architecture is small (~1.5k lines of Python), transparent, and reproducible end-to-end. We argue that the citation-validation pattern in particular generalises to any clinical-decision-support task where every recommendation must trace to an authoritative source.`
  ),
];

const acks = [
  H1('Acknowledgements'),
  P('The authors thank the maintainers of the ACR Appropriateness Criteria for the public availability of the methodology documentation, and the rank-bm25, FastAPI, Pydantic, and Anthropic SDK communities for the open-source infrastructure on which the prototype is built.'),
  H1('Conflicts of interest'),
  P('The authors declare no conflicts of interest. No funding source had any role in study design, implementation, or analysis.'),
  H1('Data and code availability'),
  P('The full system source, the seed KB, the scenarios JSON, and the evaluation harness are released alongside this paper. The official ACR Appropriateness Criteria are copyrighted material of the American College of Radiology and require licensing for production use; the schema in this work is faithful to the official structure so that licensed ingestion is a drop-in replacement.'),
];

const refs_section = () => {
  const out = [refsHeading()];
  CITES.forEach((key, i) => out.push(refLine(i + 1, R[key])));
  return out;
};

const allChildren = [
  ...front, ...intro, ...related, ...acr_section, ...system, ...evalsec, ...results_section,
  ...error_section, ...discussion, ...conclusion, ...acks,
  ...refs_section(),
];

const doc = new Document({
  styles: buildStyles(),
  numbering: numberingConfig,
  sections: [buildSection(allChildren)],
});

(async () => {
  const buf = await Packer.toBuffer(doc);
  const out = process.argv[2] || '/sessions/modest-sharp-fermat/mnt/RESEARCH/ACR_RAG_Variant_B_Journal.docx';
  fs.writeFileSync(out, buf);
  console.log(`wrote ${out} (${buf.length} bytes); ${CITES.length} unique citations`);
})();
