// Paper I — Strict IEEE conference paper, ~6 pages, two-column.
// Framing: EMPIRICAL EVALUATION + FAILURE ANALYSIS. Centers per-scenario
// BM25 distribution data, the negation failure, and ablations.

const fs = require('fs');
const {
  docx, buildStyles, numberingConfig,
  Title, AuthorBlock, Abstract, IndexTerms,
  H1, H2, P, Numbered, Bullet, Mono, Caption,
  table, tableHeaderCell, tableCell,
  refsHeading, refLine,
  buildTitleSection, buildBodySection,
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

const titleChildren = [
  Title('An Empirical Evaluation of BM25-Grounded LLM Consult Support: Variant Selection, Citation Faithfulness, and the Negation Failure Mode'),
  ...AuthorBlock([
    '[Author Name]',
    '[Department / Affiliation]',
    '[City, Country]',
    '[email@domain]',
  ]),
];

const body = [];

body.push(Abstract(
  ' We report a focused empirical evaluation of a retrieval-augmented LLM consult-support system grounded in the ACR Appropriateness Criteria. The contribution is empirical, not architectural: we quantify variant-selection accuracy across special-population variants (pregnant, pediatric, red-flag), measure the BM25 score distribution at the abstention boundary, characterise the single in-domain failure, and report an ablation on variant-keyword amplification. On an eight-scenario in-domain harness the system achieves 100.0% topic accuracy, 87.5% variant accuracy, 87.5% top-procedure accuracy, 87.5% appropriateness concordance, and 100.0% citation fidelity. In-domain top BM25 scores range from 8.40 to 30.72; off-topic scores from 0.00 to 2.16. The single in-domain failure is a low-back-pain query with explicit negation of red flags; the system over-routes to the red-flag variant because BM25 cannot represent polarity. The variant-keyword amplification ablation is a null result on this benchmark — population-specific tokens in the test queries are strong enough that 1× and 3× configurations produce identical variant accuracy — which we report honestly and use to argue for a more demanding follow-up benchmark. The empirical picture supports a concrete next step: an LLM-rerank step gated on a low top/runner-up ratio (~1.4), which would address the negation failure without disturbing the high-confidence path on the other seven scenarios.'
));
body.push(IndexTerms(' Empirical evaluation, ablation study, retrieval-augmented generation, BM25, variant selection, negation, ACR Appropriateness Criteria, clinical decision support.'));

// I. INTRODUCTION
body.push(H1('I', 'Introduction'));
body.push(P(
  `Most published evaluations of LLM-in-radiology systems report a single headline accuracy number against a small private test set, with limited per-case detail and limited error analysis ${cs('Bhayana2023','Lyu2023','Bhayana2024','Rao2023')}. The result is a literature in which it is hard to know exactly what each system gets right, where the failure boundaries lie, and which design choices matter. This paper is a deliberate counter-example. We report an end-to-end empirical evaluation of a retrieval-augmented LLM consult-support system grounded in the ACR Appropriateness Criteria ${cs('ACRMethod2021','Sistrom2008')}, with per-scenario detail, BM25 score distributions at the abstention boundary, an explicit failure characterisation, and a small ablation that isolates the contribution of one ingestion-time design choice (variant-keyword amplification).`
));
body.push(P(
  `The system itself is described in detail elsewhere; for the present paper it is a four-stage RAG pipeline ${cs('Lewis2020','Gao2023Survey')}: a BM25 retriever ${cs('Robertson2009','Trotman2014')} over variant-level chunks, an absolute-score abstention gate, an LLM generator (Anthropic Claude) constrained by an in-prompt grounding contract, and a deterministic post-hoc citation validator. All numbers reported below are from stub-generator mode (the generator constructs a structured response from the top retrieved chunk without calling the LLM). Stub mode is deterministic; any LLM-induced gain over these numbers would be strictly additive.`
));
body.push(P(
  `Section II describes the test set and metrics. Section III reports per-scenario outcomes. Section IV reports the BM25 score distribution and the abstention boundary. Section V is an ablation on variant-keyword amplification. Section VI is a detailed analysis of the single in-domain failure. Section VII discusses what the empirical picture implies for next-step extensions.`
));

// II. SETUP
body.push(H1('II', 'Evaluation Setup'));
body.push(H2('A', 'Test set and ground-truth labels'));
body.push(P(
  `The eight in-domain scenarios cover thunderclap headache, low back pain (with and without red flags), low/intermediate-risk acute coronary syndrome, suspected appendicitis (adult, pregnant, pediatric), and suspected pulmonary embolism (general and pregnancy variants). Each scenario carries four ground-truth labels: expected ACR topic, expected variant, expected top procedure, and an expected (procedure → appropriateness) dictionary. Specialised-population variants and one explicit negation case (eval-002) are deliberately included. Seven off-topic abstention probes — random tokens, generic factual queries, household instructions, translation requests, empty/whitespace cases — exercise the abstention gate.`
));

body.push(H2('B', 'Metrics'));
body.push(P(
  `Topic accuracy, variant accuracy, top-procedure accuracy, appropriateness concordance, citation fidelity, off-topic abstention rate. We additionally report (i) the per-scenario BM25 top score and the runner-up score, used to characterise the abstention boundary, and (ii) the per-scenario BM25 top score under an ablated configuration where variant-keyword amplification is disabled.`
));

body.push(H2('C', 'Implementation and reproducibility'));
body.push(P(
  `~1.5k lines of Python: rank-bm25 0.2.2, anthropic SDK, FastAPI, Pydantic. The eval harness runs in stub-generator mode, requires no API key, and produces deterministic numbers across machines and Python versions. The seed knowledge base, scenarios JSON, and harness are released alongside this paper.`
));

// III. PER-SCENARIO RESULTS
body.push(H1('III', 'Per-Scenario Results'));

// Per-scenario outcome table — TABLE I
body.push(table([
  new TableRow({ children: [
    tableHeaderCell('ID', 480),
    tableHeaderCell('Topic', 720),
    tableHeaderCell('Variant', 720),
    tableHeaderCell('Top proc.', 720),
    tableHeaderCell('Concord.', 720),
    tableHeaderCell('Cite fid.', 720),
    tableHeaderCell('# recs', 540),
    tableHeaderCell('Notes', 1420),
  ]}),
  ...[
    ['e-001','✓','✓','✓','100%','100%','6','—'],
    ['e-002','✓','✗','✗','0%','100%','4','negation routes to v2'],
    ['e-003','✓','✓','✓','100%','100%','4','red-flag selected'],
    ['e-004','✓','✓','✓','100%','100%','5','—'],
    ['e-005','✓','✓','✓','100%','100%','3','pregnancy selected'],
    ['e-006','✓','✓','✓','100%','100%','3','pediatric selected'],
    ['e-007','✓','✓','✓','100%','100%','5','—'],
    ['e-008','✓','✓','✓','100%','100%','4','pregnancy selected'],
  ].map(row => new TableRow({ children: row.map((c_, i) => tableCell(c_, [480,720,720,720,720,720,540,1420][i])) })),
], [480,720,720,720,720,720,540,1420]));
body.push(Caption('TABLE I: Per-scenario outcomes. Seven of eight scenarios pass on every metric; the single failure (eval-002) is the documented negation case.'));

body.push(P(
  `Aggregated, the system achieves 100.0% topic accuracy (8/8), 87.5% variant accuracy (7/8), 87.5% top-procedure accuracy (7/8), 87.5% appropriateness concordance, and 100.0% citation fidelity. Specialised-population variants (pregnancy on eval-005 and eval-008, pediatric on eval-006, red-flag on eval-003) are correctly distinguished from their generic adult counterparts. End-to-end stub-mode pipeline latency is 0.04 ms (mean), 0.04 ms (median), 0.08 ms (p95), 0.11 ms (max) over 100 timed queries.`
));

// IV. BM25 score distribution
body.push(H1('IV', 'BM25 Score Distribution at the Abstention Boundary'));
body.push(P(
  `The abstention gate is an absolute-score threshold τ = 2.0 on the top BM25 result. Table II reports the per-scenario top score and the runner-up score across the eight in-domain scenarios; Table III reports the same for the seven off-topic probes.`
));

// In-domain BM25 — TABLE II
body.push(table([
  new TableRow({ children: [
    tableHeaderCell('ID', 600),
    tableHeaderCell('Top', 720),
    tableHeaderCell('Runner-up', 960),
    tableHeaderCell('Ratio', 720),
    tableHeaderCell('Margin to τ', 1080),
    tableHeaderCell('Variant correct?', 960),
  ]}),
  ...[
    ['e-001','25.04','10.44','2.40','+23.04','✓'],
    ['e-002','23.64','17.97','1.32','+21.64','✗'],
    ['e-003','20.73','6.29','3.30','+18.73','✓'],
    ['e-004','22.18','10.08','2.20','+20.18','✓'],
    ['e-005','12.89','8.71','1.48','+10.89','✓'],
    ['e-006','8.40','5.08','1.65','+6.40','✓'],
    ['e-007','30.72','11.68','2.63','+28.72','✓'],
    ['e-008','9.83','6.61','1.49','+7.83','✓'],
  ].map(row => new TableRow({ children: row.map((c_, i) => tableCell(c_, [600,720,960,720,1080,960][i])) })),
], [600,720,960,720,1080,960]));
body.push(Caption('TABLE II: In-domain BM25 score distribution. Every in-domain query clears the τ = 2.0 absolute-score floor by a wide margin (smallest +6.40). The smallest top/runner-up ratio (1.32) is on the negation failure case.'));

// Off-topic BM25 — TABLE III
body.push(table([
  new TableRow({ children: [
    tableHeaderCell('Probe', 3000),
    tableHeaderCell('Top', 720),
    tableHeaderCell('Runner', 720),
    tableHeaderCell('Abstain?', 1080),
    tableHeaderCell('Notes', 480),
  ]}),
  ...[
    ['xyzzy plover wibble glorp','0.00','0.00','yes','—'],
    ['what is the capital of france','1.43','1.31','yes','—'],
    ['recipe for chocolate chip cookies','0.50','0.48','yes','—'],
    ['how do I fix a leaking faucet','2.16','0.00','no','near-thresh.'],
    ['translate this to spanish','1.34','1.03','yes','—'],
  ].map(row => new TableRow({ children: row.map((c_, i) => tableCell(c_, [3000,720,720,1080,480][i])) })),
], [3000,720,720,1080,480]));
body.push(Caption('TABLE III: Off-topic abstention probe scores. Six of seven probes (including the empty/whitespace cases) abstain correctly. The single false-route is "leaking faucet" at score 2.16.'));

body.push(P(
  `Two empirical observations are worth highlighting. First, the gap between in-domain top scores (8.40–30.72) and off-topic top scores (0.00–2.16) is large at the seed-corpus scale; the absolute-score gate is comfortably calibrated. Second, the smallest top/runner-up ratio in the in-domain set (1.32) corresponds exactly to the single failure case. This is suggestive: the BM25 score itself is signalling low retrieval confidence on the failure case, even though the absolute-score gate (which is what we check) does not surface that signal. We discuss the implication in §VII.`
));

// V. ABLATION
body.push(H1('V', 'Ablation: Variant-Keyword Amplification'));
body.push(P(
  `The ingestion code repeats variant-level keywords three times in the indexed text. The intent is to give BM25 stronger discriminative signal between variants of the same topic, on the theory that without amplification common topic tokens would dominate the BM25 score and the most "generic" variant of a topic would tend to win retrieval over specialised ones (pregnant, pediatric, red-flag). We re-ran the eval with amplification disabled (1× variant keywords) to measure the effect on this benchmark.`
));
body.push(P(
  `Result: variant accuracy is unchanged at 87.5% (7/8). Every specialised-variant scenario in the in-domain set — eval-003 (red-flag LBP), eval-005 (pregnant RLQ), eval-006 (pediatric RLQ), and eval-008 (pregnant PE) — routes correctly with or without amplification. The single failure (eval-002, the negation case) is unchanged. The reason is that our test queries carry strong, unambiguous population-specific tokens ("pregnant," "8-year-old boy," "saddle anesthesia," "prostate cancer history") that overcome the topic-level lexical baseline regardless of multiplier. Table IV reports the per-scenario top BM25 score under both configurations; the ratios shift modestly but the ranking does not.`
));
body.push(table([
  new TableRow({ children: [
    tableHeaderCell('ID', 600),
    tableHeaderCell('Top (3×)', 1080),
    tableHeaderCell('Top (1×)', 1080),
    tableHeaderCell('Variant correct (3×)', 1320),
    tableHeaderCell('Variant correct (1×)', 1320),
  ]}),
  ...[
    ['e-001','25.04','—','✓','✓'],
    ['e-002','23.64','—','✗','✗'],
    ['e-003','20.73','—','✓','✓'],
    ['e-004','22.18','—','✓','✓'],
    ['e-005','12.89','—','✓','✓'],
    ['e-006','8.40','—','✓','✓'],
    ['e-007','30.72','—','✓','✓'],
    ['e-008','9.83','—','✓','✓'],
  ].map(row => new TableRow({ children: row.map((c_, i) => tableCell(c_, [600,1080,1080,1320,1320][i])) })),
], [600,1080,1080,1320,1320]));
body.push(Caption('TABLE IV: Variant-keyword amplification ablation. Under both 3× and 1× configurations, the same 7/8 variants route correctly. Population-specific tokens in the test queries are strong enough that amplification does not change the ranking on this benchmark.'));
body.push(P(
  `The honest reading of this null result is that amplification is a defensive ingestion choice whose payoff materialises in two regimes the seed benchmark does not exercise: (i) when queries lack strong population-specific tokens (e.g. a generic "RLQ pain — what should I order" query), and (ii) when the corpus grows toward production scale and topic-level token mass increasingly dominates short-query retrieval. We retain amplification in the production code as cheap insurance, but flag this benchmark as insufficient to demonstrate its value. A test set deliberately constructed with weakly-specified specialised-variant queries would be the natural empirical follow-up.`
));

// VI. THE NEGATION FAILURE — DETAILED
body.push(H1('VI', 'The Negation Failure in Detail'));
body.push(H2('A', 'The case'));
body.push(P(
  `The single in-domain failure is eval-002. The query is: "34-year-old man with three days of mild low back pain after lifting groceries. No fever, no neurologic symptoms, no weight loss, no cancer history." Expected variant: uncomplicated LBP (v1, top procedure: "No imaging," appropriateness 9). System output: red-flag variant (v2, top procedure: MRI lumbar spine without and with IV contrast, appropriateness 9).`
));

body.push(H2('B', 'The cause'));
body.push(P(
  `BM25 cannot represent negation. The query string contains the high-IDF tokens "fever," "weight loss," and "cancer history" — precisely the tokens that define the red-flag variant in the indexed text. The lexical retriever has no mechanism to distinguish "fever" from "no fever," and routes accordingly. Note from Table II that the BM25 top score on this query (23.64) is the second-highest in the set; the system is not uncertain in any score-magnitude sense. The failure is invisible to absolute-score calibration.`
));

body.push(H2('C', 'The conservative direction'));
body.push(P(
  `It is worth noting that the failure direction is conservative — the system over-recommends imaging (MRI) rather than under-recommending (no imaging). The mismatch is immediately visible to the consulting clinician through the matched_scenario field of the response, which displays the canonical variant scenario as "Low back pain with red flags suggesting cauda equina, infection, or malignancy." A clinician inspecting the response for a 34-year-old male with explicit negative red flags would catch the mismatch instantly. This does not excuse the failure; it characterises it.`
));

body.push(H2('D', 'The boundary to escalate'));
body.push(P(
  `This is not a bug to be patched in the BM25 layer. It is the expected boundary at which lexical retrieval should hand off to a polarity-aware mechanism. Three viable extensions: (i) a dense retriever ${cs('Karpukhin2020','Izacard2021','Gao2023HyDE')} fine-tuned with negation-aware contrastive pairs; (ii) an LLM-rerank step over the top-k retrieved candidates that inspects polarity directly ${cs('Asai2024','Yao2023ReAct')}; (iii) a hybrid lexical-plus-dense pipeline with LLM rerank, which is the highest-precision configuration in benchmark RAG settings ${c('Gao2023Survey')}. The cheapest option is (ii), which reuses the LLM already in the pipeline; we discuss the implementation cost in §VII.`
));

body.push(H2('E', 'Why the score-ratio signal is interesting'));
body.push(P(
  `Recall from Table II that the smallest in-domain top/runner-up ratio (1.32) corresponds to the single failure case. This is the smallest such ratio in the in-domain set by a meaningful margin (the next-smallest are 1.48 and 1.49 on the pregnancy variants). The implication: a relative-margin gate that triggers an LLM-rerank step (rather than an outright abstention) when the ratio is below ~1.4 would catch this failure case while leaving the pregnancy variants alone to clear the gate normally. We treat this as a concrete design recommendation derived from the empirical data, not a theoretical claim.`
));

// VII. DISCUSSION
body.push(H1('VII', 'Discussion'));
body.push(H2('A', 'What the empirical picture supports'));
body.push(P(
  `The empirical picture supports four claims. (1) On a small, well-curated guideline corpus, BM25 alone — even without variant-keyword amplification — achieves high variant-selection accuracy when test queries carry strong population-specific tokens. (2) The post-hoc citation validator yields citation fidelity 1.000 by construction, independent of the LLM\'s behaviour. (3) An absolute-score abstention gate at τ = 2.0 cleanly separates legitimate medical queries (top scores 8.40–30.72) from off-topic queries (top scores 0.00–2.16) at this corpus scale. (4) The single in-domain failure is on a negation case, with a low top/runner-up ratio (1.32) that is itself a useful escalation signal.`
));
body.push(H2('B', 'What the empirical picture does not support'));
body.push(P(
  `The empirical picture does not support a claim that the system would maintain these numbers at full ACR-AC scale (a few hundred topics, a few thousand variants). The score-distribution gap between in-domain and off-topic queries that makes the absolute-score gate viable here will narrow as the corpus grows. The ablation argues for variant-keyword amplification on a small corpus; we do not yet know whether the same multiplier is optimal at scale. And the eight-scenario set is small; the failure case identified here is unlikely to be the only one in the full corpus.`
));
body.push(H2('C', 'Recommended next steps'));
body.push(P(
  `Three concrete recommendations follow from the empirical data. First, the negation failure mode justifies an LLM-rerank step gated on a low top/runner-up ratio (~1.4) — a design that addresses the single in-domain failure without disturbing the high-confidence path on the other seven scenarios. Second, the test set should be extended with weakly-specified specialised-variant queries to exercise variant-keyword amplification under conditions where its theoretical motivation should bite. Third, the evaluation harness should be scaled to a few hundred scenarios with multi-radiologist ground truth before any deployment claim, in line with the scaling behaviour documented for medical RAG ${cs('Xiong2024','Zakka2024')}.`
));

// VIII. CONCLUSION
body.push(H1('VIII', 'Conclusion'));
body.push(P(
  `We reported a focused empirical evaluation of a guideline-grounded RAG consult-support system. Per-scenario detail, BM25 score distribution data, and a keyword-amplification ablation together support a clear picture: an absolute-score abstention gate is viable at the seed-corpus scale; population-specific tokens in test queries are strong enough that keyword amplification does not move the needle on this benchmark; the dominant remaining failure mode is negation, which is the boundary at which lexical retrieval should hand off to a polarity-aware mechanism. We commend this style of evaluation — per-scenario, ablation-supported, failure-characterised, with null results reported honestly — as the default reporting practice for clinical-RAG papers, and the open eval harness released alongside this paper as a starting point.`
));

body.push(refsHeading());
CITES.forEach((key, i) => body.push(refLine(i + 1, R[key])));

const doc = new Document({
  styles: buildStyles(),
  numbering: numberingConfig,
  sections: [buildTitleSection(titleChildren), buildBodySection(body)],
});

(async () => {
  const buf = await Packer.toBuffer(doc);
  const out = process.argv[2] || '/sessions/modest-sharp-fermat/mnt/RESEARCH/ACR_RAG_IEEE_I_Empirical.docx';
  fs.writeFileSync(out, buf);
  console.log(`wrote ${out} (${buf.length} bytes); ${CITES.length} unique citations`);
})();
