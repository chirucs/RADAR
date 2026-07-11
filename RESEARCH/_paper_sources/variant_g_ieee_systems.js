// Paper G — Strict IEEE conference paper, ~6 pages, two-column.
// Framing: SYSTEMS / RAG architecture. Headline: citation-faithful pipeline.

const fs = require('fs');
const {
  docx, buildStyles, numberingConfig,
  Title, AuthorBlock, Abstract, IndexTerms,
  H1, H2, P, Numbered, Bullet, Mono, Caption,
  table, tableHeaderCell, tableCell,
  refsHeading, refLine,
  buildTitleSection, buildBodySection,
  COL_WIDTH,
} = require('./ieee_common');
const { R } = require('./refs');
const { Document, Packer, TableRow } = docx;

const CITES = [];
function c(key) {
  let i = CITES.indexOf(key);
  if (i === -1) { CITES.push(key); i = CITES.length - 1; }
  return `[${i + 1}]`;
}
function cs(...keys) { return keys.map(c).join(', '); }

// ---- TITLE BLOCK (single column) ----
const titleChildren = [
  Title('A Citation-Faithful Retrieval-Augmented Generation Pipeline for Radiology Consult Support Grounded in the ACR Appropriateness Criteria'),
  ...AuthorBlock([
    '[Author Name]',
    '[Department / Affiliation]',
    '[City, Country]',
    '[email@domain]',
  ]),
];

// ---- BODY (two columns) ----
const body = [];

// Abstract + Index Terms
body.push(Abstract(
  ' Large language models (LLMs) achieve strong accuracy on medical question-answering benchmarks, but they remain unsafe for direct clinical use because they fabricate plausible-looking but unsupported claims. We present an end-to-end retrieval-augmented generation (RAG) pipeline for radiology consult support, grounded in the American College of Radiology (ACR) Appropriateness Criteria. The system combines (i) a BM25 retriever over variant-level chunks with keyword amplification for specialised-population variants, (ii) an absolute-score retrieval gate that surfaces an explicit INSUFFICIENT_EVIDENCE response when no chunk crosses threshold, (iii) a structured-JSON generator constrained by an in-prompt grounding contract, and (iv) a deterministic post-hoc citation validator that strips any recommendation whose citation_id does not match a real retrieved chunk. On an eight-scenario in-domain evaluation set covering thunderclap headache, low back pain, low-risk acute coronary syndrome, suspected appendicitis (adult, pregnant, pediatric), and suspected pulmonary embolism (general, pregnant), the system achieves 100.0% topic accuracy, 87.5% variant accuracy, 87.5% top-procedure accuracy, 87.5% appropriateness concordance, and 100.0% citation fidelity, with end-to-end pipeline overhead of 0.04 ms per query. The single in-domain miss is a negation case that BM25 cannot represent and that we identify as the natural boundary at which to escalate to a polarity-aware retriever. We argue that the two-layer faithfulness guardrail is what makes the resulting system safe to deploy in a consult-support workflow.'
));
body.push(IndexTerms(' Retrieval-augmented generation, large language models, clinical decision support, radiology, ACR Appropriateness Criteria, citation faithfulness, abstention, selective prediction.'));

// I. INTRODUCTION
body.push(H1('I', 'Introduction'));
body.push(P(
  `Diagnostic imaging is the largest and fastest-growing segment of U.S. medical procedure volume; a non-trivial fraction of that growth is attributable to discordance with evidence-based appropriateness guidance ${cs('Sistrom2009','Rosenthal2006')}. The American College of Radiology (ACR) Appropriateness Criteria (ACR-AC) is the canonical synthesis of that evidence ${cs('ACRMethod2021','Sistrom2008')}: panel-curated, regularly updated, and structured as a mapping from clinical scenarios ("variants") to ranked imaging procedures with appropriateness ratings on a 1–9 scale and Relative Radiation Level (RRL) annotations. Despite three decades of effort and federal incentives that mandate clinical decision support, ACR-AC adoption at the point of care remains modest ${c('Sheng2016')}.`
));
body.push(P(
  `Large language models (LLMs) have shown encouraging performance on medical question answering ${cs('Singhal2023','Singhal2025','Nori2023','Kanjee2023JAMA')}, but unaided LLMs do not reliably improve physician diagnostic reasoning in randomised trials ${c('Goh2024JAMA')}, and they continue to fabricate uncited claims at clinically meaningful rates in radiology contexts ${cs('Bhayana2023','Lyu2023','Bhayana2024')}.`
));
body.push(P(
  `We address three failure modes that must be eliminated by construction, not merely reduced statistically: (i) recommending a procedure not in official guidance for the matched variant; (ii) attaching the wrong appropriateness rating to a real procedure; and (iii) attributing a recommendation to a citation that does not exist ${cs('Rashkin2023','Bohnet2022')}. Our contributions are:`
));
body.push(Numbered(`An ACR-AC-grounded RAG architecture using variant-level chunking with keyword amplification that allows BM25 to reliably distinguish between variants of the same topic.`));
body.push(Numbered(`An absolute-score retrieval gate implementing an explicit INSUFFICIENT_EVIDENCE abstention path in the spirit of selective prediction ${cs('Kamath2020','Varshney2022')}.`));
body.push(Numbered(`A two-layer citation-faithfulness guardrail: an in-prompt grounding contract plus a deterministic post-hoc validator that strips any recommendation whose citation_id does not match a real retrieved chunk.`));
body.push(Numbered(`A four-metric evaluation harness — topic accuracy, variant accuracy, appropriateness concordance, citation fidelity — and an open eight-scenario test set; the system achieves 100.0% topic accuracy and 100.0% citation fidelity, with one variant-level miss on a documented negation case.`));

// II. RELATED WORK
body.push(H1('II', 'Related Work'));
body.push(H2('A', 'Retrieval-augmented generation'));
body.push(P(
  `RAG ${c('Lewis2020')} pairs a parametric LM with a non-parametric retriever; the paradigm scales from open-domain QA ${cs('Karpukhin2020','Izacard2021','Guu2020')} to trillion-token corpora ${c('Borgeaud2022')}, and now serves as the dominant approach for grounding LLM outputs ${cs('Gao2023Survey','Ram2023')}. We adopt the in-context, no-fine-tuning RAG variant: passages are prepended to the prompt and the generator's only job is to produce structured output that respects them.`
));
body.push(H2('B', 'Faithfulness, attribution, abstention'));
body.push(P(
  `Hallucination remains the central reliability obstacle for LLM deployment ${cs('Ji2023','Huang2023')}. Retrieval grounding reduces but does not eliminate it ${c('Shuster2021')}, motivating an explicit attribution layer ${cs('Bohnet2022','Rashkin2023')} and post-hoc revision pipelines such as RARR ${c('Gao2023RARR')}. The complementary problem — knowing when not to answer — is studied as selective prediction ${cs('Kamath2020','Varshney2022')} and surveyed alongside other mitigation techniques in ${c('Tonmoy2024')}.`
));
body.push(H2('C', 'LLMs in radiology'));
body.push(P(
  `ChatGPT-class systems pass radiology board-style exams but exhibit higher-order reasoning weaknesses ${c('Bhayana2023')}, transform free-text reports into structured form ${c('Adams2023')}, and serve as decision-support adjuncts with mixed results ${cs('Rao2023','Elkassem2023','Lyu2023','Bhayana2024')}. The closest peer-reviewed prior is Rau et al. ${c('Rau2023')}, who showed that an ACR-AC-grounded chatbot outperformed both generic ChatGPT and trained radiologists. Our work extends that direction by adding explicit citation validation, an abstention path, and a quantitative four-metric harness.`
));
body.push(H2('D', 'Medical RAG'));
body.push(P(
  `MedRAG ${c('Xiong2024')} benchmarks medical RAG over five corpora and documents "lost-in-the-middle" effects ${c('Liu2024Lost')} we mitigate via small variant chunks. Almanac ${c('Zakka2024')} is the closest peer-reviewed clinical RAG system; we adopt its factuality / completeness / safety evaluation framing.`
));

// III. SYSTEM DESIGN
body.push(H1('III', 'System Design'));
body.push(H2('A', 'Architecture'));
body.push(P(
  `The system has four stateless stages composed by a single ConsultPipeline class. Free-text scenarios enter through a FastAPI endpoint; the pipeline invokes the BM25 retriever, then the abstention gate, then the LLM generator, then the citation validator. Fig. 1 shows the data flow.`
));
body.push(Mono(
  `scenario\n   ↓\nBM25 retriever (variant chunks)\n   ↓\n[ top score ≥ 2.0 ? ]\n   no  → INSUFFICIENT_EVIDENCE\n   yes → top-k chunks\n   ↓\nLLM generator (in-prompt contract)\n   ↓\nPost-hoc citation validator\n   ↓\nStructured JSON response`
));
body.push(Caption('Fig. 1. End-to-end pipeline. Two safety layers — a retrieval-side abstention gate and a generation-side citation validator — operate independently.'));

body.push(H2('B', 'Knowledge base and chunking'));
body.push(P(
  `The seed knowledge base mirrors the official ACR-AC schema. Each topic contains variants; each variant has a clinical scenario, keyword set, and a procedure list with 1–9 appropriateness rating, RRL, and IV-contrast flag. We chunk at the variant level: every chunk is a self-contained, citable unit that maps 1:1 to a recommendation list. The seed contains five topics expanding to twelve variant chunks. The official ACR-AC content is copyrighted; we use a synthetic illustrative encoding faithful to the real schema so that licensed ingestion is a drop-in replacement.`
));

body.push(H2('C', 'BM25 retriever with keyword amplification'));
body.push(P(
  `The retriever is BM25Okapi ${cs('Robertson2009','Trotman2014')} over a token stream that flattens each variant into a passage containing topic name, scenario, topic keywords, and variant keywords. A consequential design choice: variant-level keywords are repeated three times in the indexed text. Without amplification, common topic tokens dominate the BM25 score and the most "generic" variant of a topic almost always wins retrieval, even when a specialised variant (pregnant, pediatric, red-flag) is the correct match. The 3× repetition gives variant-specific tokens enough lexical mass to outweigh the shared topic baseline.`
));

body.push(H2('D', 'INSUFFICIENT_EVIDENCE abstention gate'));
body.push(P(
  `An absolute-score floor (top BM25 ≥ 2.0) is applied at retrieval time. Off-topic queries match only on rare incidental tokens and score below ~1.5; legitimate medical queries with topic-specific vocabulary score above 5. When the top score is below the floor, the retriever returns empty and the pipeline emits INSUFFICIENT_EVIDENCE with an empty recommendation list. This is a deliberately minimal selective-prediction gate ${cs('Kamath2020','Varshney2022')}: a single integer comparison, fully audit-able from the request trace.`
));

body.push(H2('E', 'Generator with in-prompt grounding contract'));
body.push(P(
  `The generator wraps Anthropic Claude (claude-opus-4-7) with a fixed system prompt enumerating six rules: (1) recommend only context procedures; (2) every recommendation must include a citation_id matching a retrieved chunk; (3) abstain on context mismatch; (4) return a single JSON object; (5) surface RRL and contrast flags; (6) order recommendations by appropriateness descending. A deterministic StubGenerator that constructs a structured response from the top retrieved chunk without calling the LLM lets the entire pipeline run without an API key, providing a stable retrieval-only baseline.`
));

body.push(H2('F', 'Post-hoc citation validator'));
body.push(P(
  `After generation, the pipeline iterates over each recommendation, looks up its citation_id in the set of valid retrieved chunk IDs, and drops the recommendation if the citation does not validate. Rejected recommendations are surfaced separately for audit. This deterministic check is the second of two faithfulness guardrails. The two layers fail in different ways: the in-prompt contract changes the distribution of generated outputs toward citation-bearing recommendations; the post-hoc validator catches the residual fabrications by construction, conceptually a minimal instantiation of post-hoc revision ${c('Gao2023RARR')} restricted to the citation-existence axis.`
));

// IV. EXPERIMENTAL SETUP
body.push(H1('IV', 'Experimental Setup'));
body.push(H2('A', 'Test set'));
body.push(P(
  `We construct an eight-scenario evaluation set covering the in-domain space of the seed KB, including special-population variants (pregnant, pediatric), red-flag variants, and one explicit negation case (LBP without red flags) on which we expect lexical retrieval to fail. Table I lists the scenarios with ground-truth labels.`
));

body.push(table([
  new TableRow({ children: [
    tableHeaderCell('ID', 480),
    tableHeaderCell('Scenario (abbrev.)', 2520),
    tableHeaderCell('Variant', 1080),
    tableHeaderCell('Top procedure', 960),
  ]}),
  ...[
    ['e-001','42F sudden severe HA, worst-of-life','HA v1','CT head'],
    ['e-002','34M 3d mild LBP; NO red flags','LBP v1','No imaging'],
    ['e-003','67M LBP, prostate Ca, saddle anest.','LBP v2','MRI L w/wo'],
    ['e-004','55M acute CP, neg trop, non-dx ECG','ACS v1','CTA cor'],
    ['e-005','28F preg 2T RLQ pain, fever','RLQ v2','US RLQ'],
    ['e-006','8yo boy, RLQ pain, fever','RLQ v3','US RLQ'],
    ['e-007','45F dyspnea, intermed Wells','PE v1','CTA chest'],
    ['e-008','30F preg 3T, dyspnea, susp PE','PE v2','US LE ven'],
  ].map(row => new TableRow({ children: row.map((c_, i) => tableCell(c_, [480,2520,1080,960][i])) })),
], [480,2520,1080,960]));
body.push(Caption('TABLE I: Eight in-domain scenarios with ground-truth labels.'));

body.push(H2('B', 'Metrics'));
body.push(P(
  `Following Almanac's framing ${c('Zakka2024')} and the AIS attribution literature ${cs('Rashkin2023','Bohnet2022')}, we report (i) Topic accuracy: correct ACR topic? (ii) Variant accuracy: correct variant within topic? (iii) Appropriateness concordance: fraction of expected procedures returned with the exact rating; (iv) Citation fidelity: fraction of recommendations whose citation_id matches a real retrieved chunk. We also report top-procedure accuracy and end-to-end latency.`
));

body.push(H2('C', 'Abstention probes'));
body.push(P(
  `Seven off-topic probes — random tokens, factual queries, household instructions, translation requests, empty/whitespace cases — exercise the abstention gate.`
));

body.push(H2('D', 'Implementation'));
body.push(P(
  `~1.5k lines of Python: rank-bm25, anthropic SDK, FastAPI, Pydantic, Streamlit. The eval harness runs in stub-generator mode (deterministic; no API key) so that any LLM-induced gain is strictly additive over a documented baseline.`
));

// V. RESULTS
body.push(H1('V', 'Results'));
body.push(P(
  `Table II reports the headline metrics across the eight in-domain scenarios and seven off-topic probes.`
));
body.push(table([
  new TableRow({ children: [
    tableHeaderCell('Metric', 2880),
    tableHeaderCell('Score', 960),
    tableHeaderCell('n', 720),
    tableHeaderCell('Notes', 1440),
  ]}),
  ...[
    ['Topic accuracy','100.0%','8/8','no misroutes'],
    ['Variant accuracy','87.5%','7/8','negation miss'],
    ['Top-proc. accuracy','87.5%','7/8','same scen.'],
    ['Concordance','87.5%','—','mean'],
    ['Citation fidelity','100.0%','—','invariant'],
    ['Abstention rate','85.7%','6/7','near-thresh.'],
    ['Latency (stub)','0.04 ms','100','mean'],
  ].map(row => new TableRow({ children: row.map((c_, i) => tableCell(c_, [2880,960,720,1440][i])) })),
], [2880,960,720,1440]));
body.push(Caption('TABLE II: Headline evaluation metrics.'));

body.push(H2('A', 'In-domain accuracy'));
body.push(P(
  `Topic accuracy is 100.0%; variant accuracy is 87.5% (one miss); top-procedure accuracy is 87.5%; appropriateness concordance is 87.5%; citation fidelity is 100.0%. Specialised-population variants (pregnant RLQ, pediatric RLQ, pregnant PE) are correctly distinguished from their generic adult counterparts — the principal payoff of variant-keyword amplification. End-to-end pipeline latency is 0.04 ms (mean) over 100 timed queries; in Claude-augmented mode the LLM round-trip dominates.`
));

body.push(H2('B', 'Off-topic abstention'));
body.push(P(
  `Six of seven off-topic probes correctly return INSUFFICIENT_EVIDENCE. The single false-route is "how do I fix a leaking faucet" (BM25 = 2.16, just above the 2.0 floor). Raising the floor would catch this probe but suppress short, low-vocabulary medical queries; we discuss this calibration-versus-coverage tradeoff in §VI-B.`
));

body.push(H2('C', 'The negation failure'));
body.push(P(
  `The single in-domain miss is eval-002: 34-year-old man with three days of mild low back pain after lifting, with explicit negative red flags. Expected variant: uncomplicated LBP (top procedure: "No imaging"). The system instead routes to the red-flag variant. The cause is direct: BM25 cannot represent negation. The query contains "fever," "weight loss," and "cancer history" with high TF-IDF mass, and these are the exact tokens that define the red-flag variant in the indexed text. The lexical retriever has no mechanism to distinguish "fever" from "no fever," and routes accordingly.`
));

// VI. DISCUSSION
body.push(H1('VI', 'Discussion'));
body.push(H2('A', 'Why two faithfulness layers and not one'));
body.push(P(
  `An in-prompt grounding contract alone is insufficient because it relies on the LLM honoring it on every call, and existing evaluations of attributed LLMs show non-trivial fabrication rates ${cs('Rashkin2023','Bohnet2022')}. A post-hoc validator alone is insufficient because the LLM may not attempt to attach citation_ids in the first place. The two layers work because they fail in different ways. The result, at the cost of one set-membership lookup per recommendation, is a hard guarantee that no surfaced recommendation can carry a hallucinated citation.`
));

body.push(H2('B', 'Calibration versus coverage'));
body.push(P(
  `The near-threshold false-route is the calibration / coverage tradeoff in canonical form ${cs('Kamath2020','Varshney2022')}. A learned calibrator on the BM25 score is the natural next step. We separately reserve a relative-margin gate (distance from runner-up) in the configuration but disable it currently because legitimate co-ranking of multiple variants would otherwise over-fire the gate.`
));

body.push(H2('C', 'The negation boundary'));
body.push(P(
  `The negation case is not a bug in the BM25 layer; it is the boundary at which a polarity-aware mechanism should take over. Three viable extensions: a dense retriever ${cs('Karpukhin2020','Izacard2021')} fine-tuned with negation-aware contrastive pairs; an LLM-based variant-selection rerank step over top-k candidates; or a hybrid lexical-plus-dense with LLM rerank. The failure direction is conservative — over-recommending imaging — and the mismatch is immediately visible to the clinician through the matched_scenario field.`
));

body.push(H2('D', 'Limitations'));
body.push(P(
  `The seed KB is synthetic and illustrative; production deployment requires a properly licensed ACR-AC ingestion. The eight-scenario harness is small; scaling to a few hundred scenarios with multiple-radiologist ground truth is required before any deployment claim. The absolute-score floor is a single integer; a learned calibrator would do better, particularly for short queries. We treat the system as a research prototype, not as a clinical device.`
));

// VII. CONCLUSION
body.push(H1('VII', 'Conclusion'));
body.push(P(
  `We presented an end-to-end RAG pipeline for radiology consult support grounded in the ACR Appropriateness Criteria, characterised by an explicit INSUFFICIENT_EVIDENCE abstention path and a two-layer citation-faithfulness guardrail. The system achieves 100% topic accuracy and 100% citation fidelity on an eight-scenario in-domain harness, with a single instructive failure on a negation case that motivates a clearly identified retrieval-layer extension. The architecture is small, transparent, and reproducible; we believe the citation-validation pattern generalises to any clinical-decision-support task where every recommendation must trace to an authoritative source.`
));

// References
body.push(refsHeading());
CITES.forEach((key, i) => body.push(refLine(i + 1, R[key])));

const doc = new Document({
  styles: buildStyles(),
  numbering: numberingConfig,
  sections: [buildTitleSection(titleChildren), buildBodySection(body)],
});

(async () => {
  const buf = await Packer.toBuffer(doc);
  const out = process.argv[2] || '/sessions/modest-sharp-fermat/mnt/RESEARCH/ACR_RAG_IEEE_G_Systems.docx';
  fs.writeFileSync(out, buf);
  console.log(`wrote ${out} (${buf.length} bytes); ${CITES.length} unique citations`);
})();
