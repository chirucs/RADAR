// Variant F — Reproducibility / artifact paper (~6 pages).
// ACM-style: every claim re-derivable from a single command. Includes a
// datasheet for the seed corpus and a model card for the system.

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
  Title('Reproducibility by Construction: An Artifact Paper for a Citation-Verified RAG Service Grounded in the ACR Appropriateness Criteria'),
  Subtitle('Every claim in the companion papers re-derivable from a single command, with a datasheet for the corpus and a model card for the service'),
  Subtitle('[Author Name], [Affiliation], [Email]'),
  Abstract(
    `Reproducibility in machine learning research has improved measurably over the past five years, driven by the NeurIPS reproducibility program ${cs('Pineau2021')}, FAIR data principles ${cs('Wilkinson2016FAIR')}, and a maturing artifact-evaluation culture across major venues. Clinical machine learning lags this curve: clinical-LLM papers routinely report a single headline number on a private dataset with a closed model and no released code. We present an artifact paper for a retrieval-augmented generation service grounded in the ACR Appropriateness Criteria. The service is small (~1.5k lines of Python), deterministic in stub mode, and shipped with: (i) a content-addressable seed knowledge base (sha256: ccaeec48...); (ii) a content-addressable scenarios test set (sha256: 07995e34...); (iii) the eval harness that produces every number in the companion papers; (iv) a datasheet for the corpus following Gebru et al. ${cs('Gebru2021Datasheets')}; (v) a model card for the service following Mitchell et al. ${cs('Mitchell2019Cards')}; and (vi) a reproduction script that re-derives the headline metrics with one command and no API key. We argue that clinical-LLM artifact papers should be the default research deliverable, not an optional supplement, and that the small upfront cost of organising the artifact this way is recovered many times over in review time, audit cost, and downstream extension.`
  ),
  Keywords(
    ' Reproducibility, artifact evaluation, FAIR data, model cards, datasheets, clinical RAG, ACR Appropriateness Criteria, scientific software.'
  ),
];

// ---------------- 1. The reproducibility gap in clinical LLM work ----------------
const intro = [
  H1('1. The Reproducibility Gap in Clinical-LLM Work'),
  P(
    `The general-ML community has converged on a workable reproducibility floor: the NeurIPS reproducibility checklist ${c('Pineau2021')} is now standard at major venues; FAIR principles ${c('Wilkinson2016FAIR')} are widely cited; the ACM artifact-review framework distinguishes reproducibility from replicability cleanly ${c('Plesser2018')}; and documentation artifacts such as model cards ${c('Mitchell2019Cards')}, datasheets ${c('Gebru2021Datasheets')}, and data statements ${c('Bender2018DataStmts')} have become standard practice for major releases.`,
    { indent: true }
  ),
  P(
    `Clinical-LLM publications, taken as a population, lag this curve. Three patterns are common: (i) headline numbers are reported on private datasets with no path to re-derivation; (ii) the LLM is closed-weights with an opaque inference API, so even the model is not the subject of an artifact; (iii) when code is released, it is incomplete or undocumented enough that a determined reviewer cannot re-run the eval in finite time. The result is a literature in which it is increasingly hard to compare claims, and in which the practical baseline a new system has to beat is itself moving and inconsistently characterised.`,
    { indent: true }
  ),
  P(
    `This paper is a deliberate counter-example. It is the artifact paper for a retrieval-augmented generation service for radiology consult support whose methodology and evaluation are documented in companion papers. Our objective here is narrower: every number in the companion papers must be re-derivable by an independent reviewer with no API key, in under a minute, on a commodity laptop, with one command. Section 2 describes the artifact's contents and content-addressable identifiers. Section 3 describes the single-command reproduction recipe. Section 4 is a datasheet for the seed corpus. Section 5 is a model card for the service. Section 6 is the artifact-evaluation checklist (ACM-style) that the artifact satisfies. Section 7 discusses what we deliberately did not solve and why.`,
    { indent: true }
  ),
];

// ---------------- 2. Artifact contents ----------------
const contents = [
  H1('2. Artifact Contents and Identifiers'),
  P(
    `The artifact is a single repository (~1.5k lines of Python; one Python virtualenv worth of dependencies). The content-addressable identifiers are sha256 digests over each input that affects evaluation output (Table I).`
  ),
  table([
    new TableRow({ children: [
      tableHeaderCell('Artifact', 3000),
      tableHeaderCell('Path', 2200),
      tableHeaderCell('sha256 (truncated)', 2000),
      tableHeaderCell('Size', 1160),
    ]}),
    ...[
      ['Seed knowledge base','data/raw/sample_acr_kb.json','ccaeec48...01942a9','15,957 B'],
      ['Evaluation scenarios','eval/scenarios.json','07995e34...e398100','3,922 B'],
      ['Pinned requirements','requirements.txt','(see file)','—'],
      ['Eval harness','eval/run_eval.py','(see file)','—'],
      ['Index builder','scripts/build_index.py','(see file)','—'],
      ['Pipeline','src/acr_assistant/pipeline.py','(see file)','—'],
    ].map(row => new TableRow({ children: row.map((c_, i) => tableCell(c_, [3000,2200,2000,1160][i], { mono: i === 1 || i === 2 })) })),
  ], [3000,2200,2000,1160]),
  Caption('Table I. Artifact contents with content-addressable identifiers for the inputs that affect evaluation. Verifying that the digests above match the artifact-on-disk is sufficient to verify "we ran on the same data you have in front of you."'),
  P(
    `The artifact additionally contains the source for the FastAPI consult endpoint (src/acr_assistant/api/), the BM25 retriever (src/acr_assistant/retrieval/), the schema and parser (src/acr_assistant/ingestion/), the generator with stub fallback (src/acr_assistant/generation/), the configuration class (src/acr_assistant/config.py), an HTMX-style UI (web/index.html), a Streamlit explorer (streamlit_app.py), pytest unit tests (tests/), and the metrics module (eval/metrics.py).`
  ),
];

// ---------------- 3. Single-command reproduction ----------------
const repro = [
  H1('3. Single-Command Reproduction'),
  P(
    `The reproduction recipe is three steps, three commands. The first step installs pinned dependencies; the second builds the deterministic BM25 index from the seed KB; the third runs the eval harness in stub mode and prints the headline metrics. No API key is required.`
  ),
  Mono(
    `# (1) Install pinned deps (one virtualenv recommended)\npip install -r requirements.txt\n\n# (2) Build the index from the seed KB\npython scripts/build_index.py\n#   → data/processed/bm25_index.pkl  (deterministic; rebuild idempotent)\n\n# (3) Run the eval harness in stub mode (no API key)\npython eval/run_eval.py --json\n#   → JSON report with topic_accuracy = 1.000, variant_accuracy = 0.875,\n#     top_procedure_accuracy = 0.875, appropriateness_concordance = 0.875,\n#     citation_fidelity = 1.000`
  ),
  P(
    `The harness prints both a human-readable report (per-scenario) and a JSON report (with --json). The numbers are deterministic across machines and Python versions because (a) BM25 is deterministic, (b) the stub generator is deterministic, and (c) no random seed is used in the scoring path. We additionally provide a unit-test suite (pytest tests/) that verifies six independent system-level invariants (topic-and-variant routing for thunderclap headache; pregnancy-variant routing for RLQ pain; descending appropriateness ordering; valid-citation invariant; off-topic abstention; safety-flag surfacing).`
  ),
  H2('3.1 Reproducibility properties this satisfies'),
  P(
    `The artifact satisfies the standard reproducibility-checklist items ${c('Pineau2021')} explicitly:`
  ),
  Bullet('Code is publicly released and complete enough to re-run end-to-end.'),
  Bullet('Data is publicly released (the seed KB) or content-addressed (any future ACR-AC ingestion).'),
  Bullet('Dependencies are pinned in requirements.txt with version constraints.'),
  Bullet('The evaluation procedure is a single deterministic command path with no external API dependency in stub mode.'),
  Bullet('Hyperparameters that affect output (BM25 top-k, abstention floor, max_tokens) are surfaced in a single configuration file.'),
  Bullet('Random seeds are documented where any stochasticity is present (currently none in the eval path).'),
  Bullet('Hardware requirements are minimal: any commodity machine with Python 3.10+, no GPU.'),
];

// ---------------- 4. Datasheet for the corpus ----------------
const datasheet = [
  H1('4. Datasheet for the Seed Corpus'),
  P(
    `Following Gebru et al.'s datasheet template ${c('Gebru2021Datasheets')}, we describe the seed knowledge base.`
  ),
  H2('4.1 Motivation'),
  P(
    `Why was the dataset created? The seed corpus exists to enable end-to-end evaluation of the consult-support pipeline without requiring access to the copyrighted ACR Appropriateness Criteria. Who funded its creation? The corpus was created as part of this research; no external funding source had any role in its design.`
  ),
  H2('4.2 Composition'),
  P(
    `What do the instances represent? Each instance is an ACR-AC topic; topics contain variants; variants contain ranked procedures. There are 5 topics (Headache, Low Back Pain, Acute Chest Pain–ACS, Right Lower Quadrant Pain, Suspected Pulmonary Embolism), expanding to 12 variant chunks. Each procedure carries an appropriateness rating (1–9), a Usually Appropriate / May Be Appropriate / Usually Not Appropriate category, a Relative Radiation Level (O / low / medium / high / very_high), an IV-contrast flag, and a one-sentence rationale.`
  ),
  P(
    `Are there labels or targets associated with each instance? Yes — the appropriateness ratings and the RRL labels are the targets the system retrieves. Are there subgroups (e.g., gender, race) represented? The corpus does not include patient-level data; it represents clinical scenarios at the variant level (e.g., adult / pregnant / pediatric). Is the data confidential? No.`
  ),
  H2('4.3 Collection process'),
  P(
    `How was the data collected? The seed KB is a synthetic illustrative encoding authored to mirror the structure of the official ACR Appropriateness Criteria. The schema is faithful to the real ACR-AC structure ${cs('ACRMethod2021','Sistrom2008')}; the content is illustrative and is NOT licensed ACR content. The intent is that licensed ACR-AC ingestion is a drop-in replacement at deployment time.`
  ),
  H2('4.4 Preprocessing / cleaning / labeling'),
  P(
    `The KB is shipped as a single JSON document. The ingestion code (src/acr_assistant/ingestion/parser.py) flattens each variant into a single text passage containing the topic name, scenario string, topic-level keywords, variant-level keywords (repeated 3×), and a compact rendering of each procedure with its rating. The 3× keyword repetition gives variant-specific tokens enough lexical mass to outweigh the shared topic baseline so that BM25 can distinguish specialised variants from the generic adult variant of the same topic.`
  ),
  H2('4.5 Uses, distribution, maintenance'),
  P(
    `Has the dataset been used for any tasks already? Yes — for the eight-scenario evaluation of the companion-paper system. What tasks could it be used for? End-to-end RAG evaluation, retriever ablations, prompt-engineering experiments, and as a fixture for unit tests. Will the dataset be distributed? Yes, alongside this paper. Will it be maintained? Yes — schema updates and content additions are versioned in the version field of each topic. License: research use only; the synthetic content is released under a permissive license, but the structure mirrors copyrighted ACR-AC material and any production deployment must license the official ACR-AC corpus from the American College of Radiology.`
  ),
];

// ---------------- 5. Model card ----------------
const card = [
  H1('5. Model Card for the Service'),
  P(
    `Following Mitchell et al.'s model-card template ${c('Mitchell2019Cards')}, augmented for an LLM-backed service following the data-statements approach of Bender and Friedman ${c('Bender2018DataStmts')}.`
  ),
  H2('5.1 Model details'),
  P(
    `Service name: ACR Appropriateness Criteria Consult Assistant. Service architecture: four-stage RAG pipeline (BM25 retriever ${cs('Robertson2009','Trotman2014')}, absolute-score abstention gate, LLM generator with in-prompt grounding contract, deterministic post-hoc citation validator). Default LLM: Anthropic Claude (claude-opus-4-7) when an API key is configured; deterministic StubGenerator otherwise. Service version: 0.1.0. Source: ~1.5k lines of Python; rank-bm25 0.2.2, anthropic SDK, FastAPI, Pydantic, Streamlit. License: research prototype; not for clinical use.`
  ),
  H2('5.2 Intended use'),
  P(
    `Primary intended use: research and development of guideline-grounded clinical RAG; consult-style decision support for radiologists with the ACR-AC as ground truth. Primary intended users: clinical-NLP researchers, radiology-IT teams evaluating LLM-RAG architectures, and clinical-decision-support engineers. Out-of-scope use: unsupervised clinical use; ingestion of PHI; any deployment without a licensed ACR-AC corpus.`
  ),
  H2('5.3 Factors and metrics'),
  P(
    `Relevant factors: clinical scenario type (in-domain vs. off-topic); special populations (pregnant, pediatric, red-flag); query polarity (positive vs. negation). Metrics: topic accuracy, variant accuracy, top-procedure accuracy, appropriateness-score concordance, citation fidelity, off-topic abstention rate, end-to-end latency. Headline values on the eight-scenario harness: 100.0%, 87.5%, 87.5%, 87.5%, 100.0%, 85.7%, 0.04 ms.`
  ),
  H2('5.4 Evaluation data'),
  P(
    `Datasets: eval/scenarios.json (eight scenarios with ground-truth labels) for in-domain evaluation; seven hand-authored off-topic probes for abstention evaluation; pytest tests/test_pipeline.py for unit-level invariants. Motivation: cover the in-domain space of the seed KB, including special populations and an explicit negation case.`
  ),
  H2('5.5 Training data'),
  P(
    `The service does not train any model. The retriever is fitted on the seed KB at index-build time (deterministic); the generator is the closed-weights Claude API. Per Bender and Friedman ${c('Bender2018DataStmts')}, no training-data statement applies to the retriever beyond the seed-KB datasheet (Section 4); the LLM's training-data statement is the Anthropic-published one and not in scope for this artifact.`
  ),
  H2('5.6 Quantitative analyses'),
  P(
    `Per-scenario outcomes: 7/8 scenarios pass on every metric; one in-domain miss (eval-002 negation case) routes to the red-flag LBP variant instead of the uncomplicated variant. The miss is conservative (over-recommends imaging) and is immediately visible to the clinician through the matched_scenario field.`
  ),
  H2('5.7 Ethical considerations'),
  P(
    `Risks: (a) the service may be misused as a clinical decision-maker rather than a consult adjunct; (b) the LLM may surface recommendations that look authoritative but were stripped — the rejected_recommendations field is observable but not in the user-facing rendering by default; (c) the seed KB is synthetic and any production deployment requires a licensed ACR-AC. Mitigations: (a) the documentation, this paper, and the system prompt all state explicitly that the service is not for clinical use; (b) the API surface always exposes _rejected_recommendations; (c) the schema is faithful to the official ACR-AC so that licensed ingestion is a drop-in replacement.`
  ),
  H2('5.8 Caveats and recommendations'),
  P(
    `BM25 cannot represent negation; the negation-failure mode in the eval harness is not a bug but a documented retrieval-layer boundary. We recommend BM25 as the default until production traffic exposes negation-driven failures, then targeted upgrade to an LLM-rerank step ${cs('Asai2024','Yao2023ReAct')} or a dense retriever ${cs('Karpukhin2020','Izacard2021','Gao2023HyDE')}. We recommend that future releases of the service ship a service-card update ${c('Mitchell2019Cards')} with each material change.`
  ),
];

// ---------------- 6. Artifact-evaluation checklist ----------------
const checklist = [
  H1('6. Artifact-Evaluation Checklist'),
  P(
    `We map the artifact to the ACM artifact-review-and-badging criteria, distinguishing reproducibility from replicability per Plesser ${c('Plesser2018')}.`
  ),
  table([
    new TableRow({ children: [
      tableHeaderCell('Criterion', 3600),
      tableHeaderCell('Status', 1080),
      tableHeaderCell('Evidence', 4680),
    ]}),
    ...[
      ['Artifact is publicly archived','✓','Released alongside this paper'],
      ['Artifact is well-documented','✓','README, this paper, the model card, the datasheet'],
      ['Artifact is exercisable','✓','Single-command reproduction recipe (Section 3)'],
      ['Headline results re-derivable','✓','Stub-mode eval requires no API key, deterministic'],
      ['Data is FAIR','✓','Seed KB and scenarios are findable, accessible, interoperable, reusable'],
      ['Dependencies pinned','✓','requirements.txt'],
      ['Random seeds documented','N/A','No stochasticity in the eval path'],
      ['Documentation of failure modes','✓','Negation case + near-threshold abstention'],
      ['Documentation of out-of-scope uses','✓','Model card §5.2'],
      ['Versioning','✓','Service version 0.1.0; KB version field per topic'],
    ].map(row => new TableRow({ children: row.map((c_, i) => tableCell(c_, [3600,1080,4680][i])) })),
  ], [3600,1080,4680]),
  Caption('Table II. Artifact-evaluation checklist mapped to standard ACM criteria. Stub-mode determinism is what makes the headline-result re-derivation a one-command operation rather than an environmental archaeology project.'),
];

// ---------------- 7. What we did not solve ----------------
const limits = [
  H1('7. What We Deliberately Did Not Solve'),
  P(
    `Three things this artifact does not solve, on purpose. First, the LLM-augmented numbers are not stub-mode-reproducible; they require an Anthropic API key and a payment relationship. We have ensured that every claim in the companion papers can be re-derived in stub mode, and that the LLM-augmented mode is strictly additive over the stub baseline. Second, the seed corpus is synthetic; we have ensured that the schema is faithful to the licensed ACR-AC corpus so that licensed ingestion is a drop-in replacement, but the full corpus is not in scope. Third, we have not attempted "replicability" in Plesser's sense ${c('Plesser2018')} — independent re-implementation of the system on a different stack — because the engineering economics for a research prototype do not justify it.`
  ),
];

// ---------------- 8. Conclusion ----------------
const conclusion = [
  H1('8. Conclusion'),
  P(
    `Reproducibility for a clinical-RAG service is not free, but it is much cheaper than the prevailing clinical-LLM literature implies. The cost is one stub-generator implementation (~40 lines), one content-addressable scenarios file, one datasheet, one model card, and a single-command reproduction recipe. The payoff is that every number in the companion papers can be checked in seconds by any reviewer with Python on their laptop, and that the service can be safely extended by an independent group without an off-list conversation about how to get it running. We commend this pattern as the default deliverable for clinical-LLM research, and the artifact released alongside this paper as a minimal worked example.`
  ),
];

const refs_section = () => {
  const out = [refsHeading()];
  CITES.forEach((key, i) => out.push(refLine(i + 1, R[key])));
  return out;
};

const allChildren = [
  ...front, ...intro, ...contents, ...repro, ...datasheet, ...card, ...checklist,
  ...limits, ...conclusion,
  ...refs_section(),
];

const doc = new Document({
  styles: buildStyles(),
  numbering: numberingConfig,
  sections: [buildSection(allChildren)],
});

(async () => {
  const buf = await Packer.toBuffer(doc);
  const out = process.argv[2] || '/sessions/modest-sharp-fermat/mnt/RESEARCH/ACR_RAG_Variant_F_Artifact.docx';
  fs.writeFileSync(out, buf);
  console.log(`wrote ${out} (${buf.length} bytes); ${CITES.length} unique citations`);
})();
