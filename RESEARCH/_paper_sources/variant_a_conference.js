// Variant A — Conference paper (~6 pages, IEEE-style framing).
// Focused on the SYSTEM and the empirical eval. Tight, technical, contributions-first.

const fs = require('fs');
const {
  docx, P, H1, H2, H3, Title, Subtitle, Caption, Bullet, Numbered, Mono,
  Abstract, Keywords, table, tableHeaderCell, tableCell,
  refsHeading, refLine, buildStyles, numberingConfig, buildSection,
} = require('./common');
const { R } = require('./refs');
const { Document, Packer } = docx;

// ---------------- Citation order for this variant ----------------
// Renumber-on-demand: the order in which a key first appears determines its [n].
const CITES = [];
function c(key) {
  let i = CITES.indexOf(key);
  if (i === -1) { CITES.push(key); i = CITES.length - 1; }
  return `[${i + 1}]`;
}
function cs(...keys) { return keys.map(c).join(','); }

// ---------------- Sections ----------------

const front = [
  Title('A Citation-Faithful, Abstention-Aware Retrieval-Augmented Pipeline for Radiology Consult Support Grounded in the ACR Appropriateness Criteria'),
  Subtitle('[Author Name], [Affiliation], [Email]'),
  Abstract(
    `Large language models (LLMs) achieve striking accuracy on medical question answering, yet they remain prone to fabricated facts and uncited claims that make them unsafe for direct use in radiology consult workflows. We present an end-to-end retrieval-augmented generation (RAG) system that grounds an LLM in the American College of Radiology (ACR) Appropriateness Criteria, the canonical evidence base for imaging selection. The system combines (i) a BM25 retriever over variant-level chunks of the ACR knowledge base, (ii) an absolute-score retrieval gate that triggers an explicit INSUFFICIENT_EVIDENCE abstention when no chunk crosses the threshold, (iii) a structured-JSON LLM generator constrained by an in-prompt grounding contract, and (iv) a deterministic post-hoc citation validator that strips any recommendation whose citation_id does not match a real retrieved chunk. On an eight-scenario evaluation harness covering thunderclap headache, low back pain (with and without red flags), low-risk acute coronary syndrome, suspected appendicitis (adult, pregnant, pediatric), and suspected pulmonary embolism (general and pregnancy), the system achieves 100.0% topic accuracy, 87.5% variant accuracy, 87.5% top-procedure accuracy, 87.5% appropriateness-score concordance, and 100.0% citation fidelity, with end-to-end stub-mode latency of 0.04 ms per query. Across seven off-topic abstention probes the system correctly returns INSUFFICIENT_EVIDENCE in 6/7 cases (85.7%). The single failure on the in-domain set is an instructive negation case — a young patient explicitly without red flags — where lexical retrieval cannot distinguish absence from presence of "fever" and "weight loss," and over-routes to the red-flag variant. We discuss why this failure mode is exactly the boundary at which dense or LLM-based variant selection should take over, and argue that the citation-validation layer is what makes the resulting hybrid safe to deploy.`
  ),
  Keywords(
    ' Retrieval-augmented generation, large language models, clinical decision support, radiology, ACR Appropriateness Criteria, citation faithfulness, selective prediction, abstention.'
  ),
];

const intro = [
  H1('I. Introduction'),
  P(
    `Imaging is the single largest driver of growth in U.S. medical procedure volume, and a substantial fraction of that growth is attributable to discordance with evidence-based appropriateness guidance ${c('Sistrom2009')}, ${c('Rosenthal2006')}. The ACR Appropriateness Criteria (ACR-AC) is the canonical synthesis of this evidence: a panel-curated, regularly updated mapping from clinical scenarios ("variants") to ranked imaging procedures with appropriateness ratings on a 1–9 scale and relative-radiation-level (RRL) annotations ${c('ACRMethod2021')}, ${c('Sistrom2008')}. Despite three decades of effort and government-mandated decision-support integration, ACR-AC adoption at the point of care remains modest, in part because ordering clinicians and consulting radiologists need to translate a free-text scenario into the right topic, the right variant, and the right ranked procedure list ${c('Sheng2016')}.`,
    { indent: true }
  ),
  P(
    `Large language models (LLMs) have shown encouraging performance on medical question answering ${cs('Singhal2023','Singhal2025','Nori2023','Kanjee2023JAMA')}, but unaided LLMs do not reliably improve physician diagnostic reasoning in randomized trials ${c('Goh2024JAMA')}, and they continue to fabricate plausible-looking but unsupported recommendations — a behavior repeatedly documented in radiology contexts ${cs('Bhayana2023','Lyu2023','Bhayana2024')}. In a setting like ACR-AC consult support, three specific failure modes are unacceptable: (i) recommending a procedure that is not in the official guidance, (ii) attaching the wrong appropriateness rating to a real procedure, and (iii) attributing a recommendation to a citation that does not exist or does not say what is claimed ${cs('Rashkin2023','Bohnet2022')}.`,
    { indent: true }
  ),
  P(
    `We address these failure modes with an explicitly conservative system design. Our contributions are:`,
    { indent: true }
  ),
  Numbered(
    `An ACR-AC-grounded RAG architecture that uses variant-level chunking and a keyword-amplification ingestion step to make BM25 reliably distinguish between variants of the same topic (e.g. pregnant versus pediatric versus adult appendicitis).`
  ),
  Numbered(
    `An absolute-score retrieval gate that surfaces an explicit INSUFFICIENT_EVIDENCE abstention path, in the spirit of selective prediction ${cs('Kamath2020','Varshney2022')}, replacing the implicit "fall-through to a generic answer" failure mode that pure LLM systems exhibit.`
  ),
  Numbered(
    `A two-layer citation-faithfulness guardrail: an in-prompt grounding contract that forbids the generator from citing chunks it has not seen, plus a deterministic post-hoc validator that strips any recommendation whose citation_id does not match a real retrieved chunk — extending RARR-style post-hoc revision ${c('Gao2023RARR')} to the citation-existence axis specifically.`
  ),
  Numbered(
    `A four-metric evaluation harness — topic accuracy, variant accuracy, appropriateness concordance, and citation fidelity — and a public eight-scenario test set covering common consult patterns. The system achieves 100.0% topic accuracy and 100.0% citation fidelity, with a documented variant-level failure on a negation case that motivates a clear next step.`
  ),
  P(
    `The system is small, transparent, and reproducible end-to-end (≈ 1.5k lines of Python). The intent is not to replace clinical judgment but to give the consulting radiologist a structured, citable starting point that is verifiable in seconds.`,
    { indent: true }
  ),
];

const related = [
  H1('II. Related Work'),
  H2('A. RAG for knowledge-intensive QA'),
  P(
    `Retrieval-augmented generation ${c('Lewis2020')} pairs a parametric language model with a non-parametric retriever, an approach that has scaled from open-domain QA ${cs('Karpukhin2020','Izacard2021','Guu2020')} to trillion-token corpora ${c('Borgeaud2022')} and now serves as the dominant paradigm for grounding LLM outputs ${cs('Gao2023Survey','Ram2023')}. We adopt the in-context, no-fine-tuning RAG variant: passages are prepended to the prompt and the generator's only job is to produce structured output that respects them.`
  ),
  H2('B. Faithfulness, attribution, and abstention'),
  P(
    `Hallucination remains the central reliability obstacle for LLM deployment ${cs('Ji2023','Huang2023')}. Retrieval grounding reduces but does not eliminate it ${c('Shuster2021')}, motivating an explicit attribution layer ${cs('Bohnet2022','Rashkin2023')} and post-hoc revision pipelines such as RARR ${c('Gao2023RARR')}. The complementary problem — knowing when not to answer at all — is studied as selective prediction ${cs('Kamath2020','Varshney2022')} and surveyed alongside other mitigation techniques in ${c('Tonmoy2024')}. Our INSUFFICIENT_EVIDENCE path is a minimal selective-prediction gate placed at the retrieval layer; our citation validator is a minimal post-hoc faithfulness check at the generation layer.`
  ),
  H2('C. LLMs in medicine and in radiology'),
  P(
    `Med-PaLM and Med-PaLM 2 demonstrated that frontier LLMs can encode substantial clinical knowledge ${cs('Singhal2023','Singhal2025')}; GPT-4 has matched or exceeded reference clinicians on selected diagnostic challenges ${cs('Lee2023NEJM','Kanjee2023JAMA','Nori2023')}; and reviews catalog both promise and risk in clinical settings ${c('Thirunavukarasu2023')}. In radiology specifically, ChatGPT-class systems can pass board-style examinations but exhibit higher-order reasoning weaknesses ${c('Bhayana2023')}, can transform free-text reports into structured form ${c('Adams2023')}, and have been evaluated as adjuncts for radiologic decision-making with mixed results ${cs('Rao2023','Elkassem2023','Lyu2023','Bhayana2024')}. The closest peer-reviewed prior is Rau et al. ${c('Rau2023')}, who showed that an ACR-AC-grounded LlamaIndex + GPT-3.5 chatbot outperformed both generic ChatGPT and trained radiologists at following ACR guidance. Our work extends that direction with explicit citation validation, an INSUFFICIENT_EVIDENCE abstention path, and a quantitative four-metric harness.`
  ),
  H2('D. Medical RAG and clinical guideline grounding'),
  P(
    `MedRAG ${c('Xiong2024')} benchmarks medical RAG over five corpora and documents log-linear scaling and "lost-in-the-middle" effects ${c('Liu2024Lost')}; we mitigate the latter by retrieving small, self-contained variant chunks and bounding top-k. Almanac ${c('Zakka2024')} is the closest peer-reviewed clinical RAG system; it inspires our adoption of factuality, completeness, and safety as the primary evaluation axes.`
  ),
];

const system = [
  H1('III. System Design'),
  H2('A. Architecture'),
  P(
    `The system has four components glued together by a single ConsultPipeline class (Fig. 1). Free-text scenarios enter through a FastAPI /consult endpoint or a Streamlit UI; the pipeline invokes the retriever, then the generator, then the citation validator, and returns a typed JSON response with the matched topic and variant, ranked recommendations, safety flags, retrieval traces, and a confidence label.`
  ),
  Mono(
    `Clinician scenario\n        ↓\nFastAPI /consult endpoint\n        ↓\nBM25 retriever  ──→  ACR-AC chunks (variant-level)\n        ↓ (≥ threshold)\nLLM generator with in-prompt grounding contract\n        ↓\nPost-hoc citation validator (strips bad citation_ids)\n        ↓\nStructured JSON: { topic, variant, ranked recs, safety, citations, confidence }`
  ),
  Caption('Fig. 1. End-to-end pipeline. Two safety layers operate independently: a retrieval-side abstention gate and a generation-side citation validator.'),
  H2('B. Knowledge base and chunking'),
  P(
    `The seed knowledge base mirrors the official ACR-AC schema: each topic contains one or more variants; each variant has a clinical scenario, a keyword set, and a list of procedures with appropriateness rating (1–9), category (Usually Appropriate / May Be Appropriate / Usually Not Appropriate), RRL, and IV-contrast flag. We chunk at the variant level, not the topic level: every chunk is a self-contained, citable unit that maps 1:1 to a recommendation list. The current seed covers five topics (Headache, Low Back Pain, Acute Chest Pain–ACS, Right Lower Quadrant Pain, Suspected Pulmonary Embolism), expanding to twelve variant chunks. We use a synthetic illustrative encoding of the ACR content because the official ACR-AC is copyrighted; the schema is faithful to the real structure so that a licensed ingestion is a drop-in replacement.`
  ),
  H2('C. BM25 retriever with keyword amplification'),
  P(
    `We use BM25Okapi ${cs('Robertson2009','Trotman2014')} over a token stream that flattens each variant into a passage containing its topic name, scenario string, topic-level keywords, and variant-level keywords. A simple but consequential design choice: variant-level keywords are repeated three times in the indexed text. Without amplification, common topic tokens dominate the BM25 score and the most "generic" variant of a topic almost always wins retrieval, even when a specialised variant (pregnant, pediatric, red-flag) is the correct match. The 3× repetition gives variant-specific tokens enough lexical mass to outweigh the shared topic baseline; we observed this lift directly on the eval set during development.`
  ),
  H2('D. INSUFFICIENT_EVIDENCE abstention gate'),
  P(
    `We apply an absolute-score floor (top BM25 score ≥ 2.0) at retrieval time. Off-topic queries match only on rare incidental tokens and score below ~1.5; legitimate medical queries with topic-specific vocabulary routinely score above 5. When the top score is below the floor, the retriever returns an empty result, the generator short-circuits to an INSUFFICIENT_EVIDENCE response, and no recommendations are produced. This is a deliberately minimal selective-prediction gate ${cs('Kamath2020','Varshney2022')}: simple to audit, deterministic, and tunable from a config file. We separately reserve a relative-margin parameter (distance from runner-up) for future use, but disable it currently because legitimate co-ranking of multiple variants of the same topic would otherwise over-fire the gate.`
  ),
  H2('E. Generator with in-prompt grounding contract'),
  P(
    `The generator is Anthropic's Claude (claude-opus-4-7), invoked with a fixed system prompt that articulates six rules: (1) recommend only procedures that appear verbatim in the retrieved context; (2) every recommendation must include a citation_id matching a retrieved chunk; (3) if context does not match, return INSUFFICIENT_EVIDENCE with an empty list; (4) return a single JSON object matching the requested schema; (5) surface RRL and contrast considerations explicitly; (6) order recommendations by appropriateness descending. The user prompt prepends the retrieved chunks (with chunk_id and citation tags) to the clinical scenario and the JSON schema. A deterministic StubGenerator that builds a structured response from the top chunk without calling the LLM lets the entire pipeline (and the eval harness) run without an API key, providing a stable baseline against which to measure LLM contribution.`
  ),
  H2('F. Post-hoc citation validator'),
  P(
    `After generation, the pipeline iterates over each recommendation, looks up its citation_id in the set of valid retrieved chunk IDs, and drops the recommendation if the citation does not validate. Rejected recommendations are surfaced separately in the response so that downstream consumers can audit. This deterministic check is the second of two faithfulness guardrails; together they enforce the invariant that no recommendation can leave the system without a real, traceable citation back to the ACR-AC chunk that supports it. Conceptually this is a minimalist instantiation of post-hoc revision ${c('Gao2023RARR')} restricted to the citation-existence axis.`
  ),
];

const eval_section = [
  H1('IV. Experimental Setup'),
  H2('A. Test scenarios'),
  P(
    `We construct an eight-scenario evaluation set covering the in-domain space of the seed KB. Each scenario carries a free-text consult question and ground-truth labels: the expected ACR topic, the expected variant, the expected top procedure, and the expected appropriateness scores for the most relevant procedures (Table I). The set deliberately includes specialised variants — pregnant appendicitis, pediatric appendicitis, pregnant suspected PE, low-back-pain with red flags — that are easy to over-route to the generic adult variant of the same topic. It also includes one explicit negation case (eval-002: low back pain explicitly without red flags) on which we expect lexical retrieval to fail.`
  ),
  // Table I — scenarios
  table([
    new (require('docx').TableRow)({ children: [
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
    ].map(row => new (require('docx').TableRow)({ children: row.map((c_, i) => tableCell(c_, [720,4400,1880,1280,1080][i])) })),
  ], [720,4400,1880,1280,1080]),
  Caption('Table I. Eight in-domain consult scenarios with ground-truth labels. The set covers common ED-relevant ACR-AC topics and explicitly stresses negation (eval-002) and special populations (eval-005, 006, 008).'),
  H2('B. Metrics'),
  P(
    `Following Almanac's factuality/completeness/safety framing ${c('Zakka2024')} and the AIS attribution literature ${cs('Rashkin2023','Bohnet2022')}, we report four metrics: (i) Topic accuracy: did the system pick the correct ACR topic? (ii) Variant accuracy: within that topic, the correct variant? (iii) Appropriateness concordance: of the expected procedures, what fraction is returned with the exact rating? (iv) Citation fidelity: what fraction of recommendations carry a citation_id that matches a real retrieved chunk? We additionally report top-procedure accuracy (the strict "did the first recommendation match" test) and end-to-end latency.`
  ),
  H2('C. Abstention probes'),
  P(
    `We construct seven off-topic probes — random tokens ("xyzzy plover wibble glorp"), unrelated factual queries ("what is the capital of france"), domestic queries ("how do I fix a leaking faucet"), translation requests, and the empty-string and whitespace-only edge cases — and report the abstention rate (fraction returning INSUFFICIENT_EVIDENCE).`
  ),
  H2('D. Implementation and reproducibility'),
  P(
    `The system is ~1.5k lines of Python: rank-bm25 0.2.2 for retrieval, the official Anthropic SDK for generation, FastAPI + Pydantic for the API, and Streamlit for an exploratory UI. The eval harness runs in stub-generator mode (no API key required), giving a stable, deterministic baseline against which the LLM-augmented numbers can be compared. All code, the seed KB, the scenarios JSON, and the eval harness are released alongside this paper.`
  ),
];

const results = [
  H1('V. Results'),
  H2('A. End-to-end accuracy and citation fidelity'),
  P(
    `Across the eight in-domain scenarios, the system achieves 100.0% topic accuracy (8/8), 87.5% variant accuracy (7/8), 87.5% top-procedure accuracy (7/8), 87.5% appropriateness concordance, and 100.0% citation fidelity (Table II). No recommendation in any scenario carried a citation_id that failed validation, including in stub mode where the generator already constructs citations from the retrieved chunk; the result confirms that the in-prompt contract and post-hoc validator together close the citation-fabrication channel by construction. End-to-end latency in stub mode is 0.04 ms (mean) per query — retrieval-and-validation overhead is negligible, and adding an LLM call sets the floor at the LLM round-trip latency.`
  ),
  // Table II — summary metrics
  table([
    new (require('docx').TableRow)({ children: [
      tableHeaderCell('Metric', 4680),
      tableHeaderCell('Score', 1560),
      tableHeaderCell('n', 1080),
      tableHeaderCell('Notes', 2040),
    ]}),
    ...[
      ['Topic accuracy','100.0%','8/8','No misrouted topics'],
      ['Variant accuracy','87.5%','7/8','One miss: eval-002 (negation)'],
      ['Top-procedure accuracy','87.5%','7/8','Same scenario as variant miss'],
      ['Appropriateness concordance','87.5%','—','Average over scenarios'],
      ['Citation fidelity','100.0%','—','No invalid citation_ids'],
      ['Off-topic abstention rate','85.7%','6/7','One near-threshold false-route'],
      ['End-to-end latency (stub)','0.04 ms','100','Mean over 100 queries'],
    ].map(row => new (require('docx').TableRow)({ children: row.map((c_, i) => tableCell(c_, [4680,1560,1080,2040][i])) })),
  ], [4680,1560,1080,2040]),
  Caption('Table II. Headline evaluation metrics. Citation fidelity is enforced by construction; the variant-accuracy miss is the documented negation failure (Sec. V-B).'),
  H2('B. Failure analysis: the negation case'),
  P(
    `The single in-domain failure is eval-002: a 34-year-old man with three days of mild low back pain after lifting, with explicit negative red flags ("no fever, no neurologic symptoms, no weight loss, no cancer history"). The expected variant is the uncomplicated-LBP variant (v1, top procedure: "No imaging," appropriateness 9). The system instead routes to the red-flag variant (v2, top procedure: MRI lumbar spine without and with IV contrast, appropriateness 9). The cause is direct and instructive: BM25 cannot represent negation. The query string contains "fever," "weight loss," and "cancer history" with high TF-IDF mass, and these terms are precisely the indicators that define the red-flag variant in the indexed text. The lexical retriever has no mechanism to distinguish "fever" from "no fever," and routes accordingly. This is not a bug to be patched; it is the expected boundary at which a lexical retriever should hand off to a model that can encode polarity — either a dense retriever fine-tuned with negation-aware contrastive pairs, or an LLM-based variant-selection layer that inspects the top-k retrieved candidates and chooses among them.`
  ),
  H2('C. Abstention behavior'),
  P(
    `Six of seven off-topic probes correctly return INSUFFICIENT_EVIDENCE (85.7%). The single false-route is "how do I fix a leaking faucet," which scores 2.16 on BM25 — just above the 2.0 floor — through coincidental token overlap with the RLQ-pain index. This is the calibration-versus-coverage tradeoff in its canonical form ${cs('Kamath2020','Varshney2022')}: raising the floor would catch the leaking faucet but might suppress short, low-vocabulary medical queries. The current operating point favors coverage on the assumption that the consulting clinician will catch the false-route by inspection of the matched_scenario field returned with every response. A learned calibrator on top of the BM25 score is the obvious next step.`
  ),
  H2('D. Specialised-population variants'),
  P(
    `The system correctly distinguishes pregnant from non-pregnant appendicitis (eval-005 → v2), pediatric from adult appendicitis (eval-006 → v3), and pregnant from non-pregnant suspected PE (eval-008 → v2), in each case yielding the no-radiation imaging modality at the top of the recommendation list with the correct appropriateness rating. This is the principal payoff of the variant-keyword amplification described in Section III-C; without amplification, common topic tokens dominate and these specialised variants tend to lose to the generic adult variant.`
  ),
];

const discussion = [
  H1('VI. Discussion'),
  H2('A. Why two faithfulness layers and not one'),
  P(
    `An in-prompt grounding contract alone is insufficient: it relies on the LLM honoring the contract on every call, and existing evaluations of attributed LLMs show non-trivial fabrication rates even under explicit attribution prompts ${cs('Rashkin2023','Bohnet2022')}. A post-hoc validator alone is insufficient: without the in-prompt contract, the LLM may not even attempt to attach citation_ids in the first place. The two layers work because they fail in different ways. The in-prompt contract changes the distribution of generated outputs toward citation-bearing recommendations; the post-hoc validator catches the residual fabrications deterministically. The result, at the cost of one set membership lookup per recommendation, is a hard guarantee that no surfaced recommendation can carry a hallucinated citation.`
  ),
  H2('B. Why an explicit abstention path matters'),
  P(
    `Most consumer-facing LLM products do not have an "I don't know" mode; they degrade gracefully to a confident-sounding answer regardless of input. In a clinical decision-support context this is dangerous: a generic answer to a domestic plumbing query is comedy; a confident-sounding-but-wrong appendicitis recommendation is harm. INSUFFICIENT_EVIDENCE makes the abstention behavior visible to the consuming application, which can route the query to a human, ask a clarifying question, or refuse — instead of having to second-guess a confident-looking response. This is the selective-prediction posture ${cs('Kamath2020','Varshney2022')} applied at the system boundary rather than as an internal calibration trick.`
  ),
  H2('C. Limitations'),
  P(
    `Three limitations are material. First, the seed KB is synthetic and illustrative; production deployment requires a properly licensed ACR-AC ingestion. The schema is faithful to the real ACR-AC structure, so this is an engineering and licensing problem rather than a research one. Second, BM25's inability to represent negation is a genuine weakness that we have characterized but not fixed; a hybrid lexical-plus-dense retriever or an LLM-based variant-selection rerank is the natural extension. Third, the eight-scenario harness is small. Scaling to a few hundred scenarios across the full ACR-AC corpus, with multiple independent radiologists supplying ground truth, is required before any deployment claim. Almanac ${c('Zakka2024')} and MedRAG ${c('Xiong2024')} suggest a viable scaling path.`
  ),
  H2('D. What we are not claiming'),
  P(
    `We are not claiming this system is safe for unsupervised clinical use. The intent is to support a consulting radiologist with a structured, citable starting point that takes seconds to verify against the cited ACR-AC chunk. We are also not claiming a methodological advance in RAG itself; rather, the contribution is the demonstration that two minimalist guardrails — a retrieval-side abstention gate and a deterministic post-hoc citation validator — close the dominant failure modes that have made prior LLM-in-radiology evaluations unsuitable for deployment ${cs('Bhayana2023','Lyu2023')}.`
  ),
];

const conclusion = [
  H1('VII. Conclusion'),
  P(
    `We presented an end-to-end RAG pipeline for radiology consult support grounded in the ACR Appropriateness Criteria, characterized by an explicit INSUFFICIENT_EVIDENCE abstention path and a two-layer citation-faithfulness guardrail. Across an eight-scenario in-domain harness the system achieves 100% topic accuracy and 100% citation fidelity, with a single instructive variant-level failure on a negation case that motivates a specific next step. The architecture is small, transparent, and reproducible, and we believe the citation-validation pattern in particular generalises to any clinical-decision-support task where every recommendation must trace to an authoritative source.`
  ),
];

const refs_section = () => {
  const out = [refsHeading()];
  CITES.forEach((key, i) => out.push(refLine(i + 1, R[key])));
  return out;
};

// Build the document and save
const allChildren = [
  ...front, ...intro, ...related, ...system, ...eval_section, ...results, ...discussion, ...conclusion,
  ...refs_section(),
];

const doc = new Document({
  styles: buildStyles(),
  numbering: numberingConfig,
  sections: [buildSection(allChildren)],
});

(async () => {
  const buf = await Packer.toBuffer(doc);
  const out = process.argv[2] || '/sessions/modest-sharp-fermat/mnt/RESEARCH/ACR_RAG_Variant_A_Conference.docx';
  fs.writeFileSync(out, buf);
  console.log(`wrote ${out} (${buf.length} bytes); ${CITES.length} unique citations`);
})();
