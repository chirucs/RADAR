// Paper H — Strict IEEE conference paper, ~6 pages, two-column.
// Framing: SELECTIVE PREDICTION / ABSTENTION as the central contribution.
// The system is presented as a worked example of a retrieval-side abstention gate.

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
  Title('Selective Prediction in Clinical Retrieval-Augmented Generation: An Absolute-Score Abstention Gate for Guideline-Grounded LLMs'),
  ...AuthorBlock([
    '[Author Name]',
    '[Department / Affiliation]',
    '[City, Country]',
    '[email@domain]',
  ]),
];

const body = [];

body.push(Abstract(
  ' Most consumer-facing large-language-model (LLM) systems do not have an explicit "I do not know" response. They degrade gracefully to a confident-sounding answer regardless of input. In a clinical-decision-support context this is dangerous: confident-but-wrong recommendations can drive harm. We argue that explicit, structurally-visible abstention is a more honest, more auditable, and more deployable interface than a confidence score buried inside a payload. We instantiate this argument as a retrieval-side abstention gate for a guideline-grounded clinical RAG system anchored to the ACR Appropriateness Criteria. The gate is a single absolute-score threshold on the top BM25 result; below threshold, the system surfaces a structured INSUFFICIENT_EVIDENCE response with an empty recommendation list and an explicit reason. We evaluate on an eight-scenario in-domain set and seven off-topic abstention probes. The system correctly abstains on 6 of 7 off-topic probes (85.7%) and answers all in-domain queries; the single near-threshold false-route (BM25 score 2.16 against a floor of 2.0) illustrates the canonical calibration / coverage tradeoff. We compare to learned-calibrator approaches from the selective-prediction literature, situate the design in the broader hallucination-mitigation landscape, and argue that an explicit abstention path should be the default API contract for any clinical RAG service.'
));
body.push(IndexTerms(' Selective prediction, abstention, refusal, calibration, retrieval-augmented generation, clinical decision support, ACR Appropriateness Criteria, hallucination mitigation.'));

// I. INTRODUCTION
body.push(H1('I', 'Introduction'));
body.push(P(
  `An LLM that always answers is, in many regimes, less useful than one that occasionally refuses. The clinical-decision-support setting makes this point starkly: a confidently-presented imaging recommendation drawn from a query that the system never had grounds to answer at all is the canonical failure mode that has prevented LLM-in-radiology systems from clearing deployment review ${cs('Bhayana2023','Lyu2023','Bhayana2024','Goh2024JAMA')}. Existing approaches to this problem treat it primarily as a model-internal calibration question, with a learned classifier on top of the model's own confidence ${cs('Kamath2020','Varshney2022')}. We take a different position. We argue that abstention should be a property of the system at its API boundary, not a derived statistic from the model.`
));
body.push(P(
  `This paper presents the design and evaluation of an explicit abstention gate inside a retrieval-augmented generation pipeline ${cs('Lewis2020','Gao2023Survey')} for radiology consult support, grounded in the ACR Appropriateness Criteria ${cs('ACRMethod2021','Sistrom2008')}. Rather than asking "how confident is the model in its answer," we ask the simpler question: "did the retriever surface anything plausibly relevant?" If the answer is no, the system surfaces a structured INSUFFICIENT_EVIDENCE response and the LLM is never invoked. The gate is a single absolute-score threshold on the top BM25 result. It is deterministic, audit-able from a single log line, and tunable from a config file.`
));
body.push(P(
  `Our contributions are: (1) a position on where abstention should live (the system boundary, not the model); (2) the design of a minimal retrieval-side abstention gate with an absolute-score threshold; (3) empirical results on eight in-domain and seven off-topic queries against a working ACR-AC-grounded system, demonstrating 85.7% off-topic abstention with no in-domain abstention; (4) an analysis of the single near-threshold false-route as the canonical calibration / coverage tradeoff; and (5) a discussion of where learned calibrators ${cs('Kamath2020','Varshney2022')} would help and where they would add audit cost without commensurate benefit.`
));

// II. RELATED WORK
body.push(H1('II', 'Related Work'));
body.push(H2('A', 'Selective prediction'));
body.push(P(
  `Selective prediction studies how a model can decide when to abstain. Kamath et al. ${c('Kamath2020')} introduce a calibrator-based approach for selective question answering under domain shift. Varshney et al. ${c('Varshney2022')} investigate selective prediction approaches across IID, OOD, and adversarial settings and find that simple confidence thresholds are competitive with more elaborate machinery. Tonmoy et al. ${c('Tonmoy2024')} survey hallucination-mitigation techniques and treat abstention as a first-class lever alongside RAG and post-hoc verification.`
));
body.push(H2('B', 'Hallucination and faithfulness'));
body.push(P(
  `Hallucination is the central reliability obstacle for LLM deployment ${cs('Ji2023','Huang2023')}. Retrieval grounding reduces but does not eliminate it ${c('Shuster2021')}. The attribution literature ${cs('Bohnet2022','Rashkin2023')} formalises "is each cited claim verifiable from its cited source" as the primary axis along which faithfulness should be measured. Self-RAG ${c('Asai2024')} and active retrieval ${c('Jiang2023FLARE')} push abstention into the model's decoding via reflection or confidence tokens. Our approach is complementary: we keep the LLM the same and place the abstention decision earlier in the pipeline, before the LLM is invoked.`
));
body.push(H2('C', 'LLMs in medicine and radiology'));
body.push(P(
  `Med-PaLM ${cs('Singhal2023','Singhal2025')} and GPT-4 ${cs('Lee2023NEJM','Nori2023','Kanjee2023JAMA')} demonstrate strong medical-QA performance, but unaided LLMs do not reliably improve physician diagnostic reasoning ${c('Goh2024JAMA')}. In radiology specifically, ChatGPT exhibits non-trivial omission and fabrication rates ${cs('Bhayana2023','Lyu2023')}, and clinical-LLM reviews ${c('Bhayana2024')} consistently flag the absence of an explicit abstention behavior as a deployment blocker.`
));
body.push(H2('D', 'Clinical RAG'));
body.push(P(
  `MedRAG ${c('Xiong2024')} benchmarks medical RAG over five corpora; Almanac ${c('Zakka2024')} demonstrates a clinical RAG system whose evaluation axes (factuality, completeness, safety) are the right ones; Rau et al. ${c('Rau2023')} ground a chatbot in the ACR Appropriateness Criteria. None of these systems exposes an explicit abstention path at the API boundary, which is the gap this paper addresses.`
));

// III. POSITION
body.push(H1('III', 'Position'));
body.push(P(
  `We argue three claims:`
));
body.push(Numbered(`Abstention should be a structurally-visible response, not a confidence score. A separate enum value (INSUFFICIENT_EVIDENCE) at the API surface is more honest and more deployable than a continuous confidence in [0,1] that the consuming application has to threshold itself.`));
body.push(Numbered(`Abstention should be decided as early as possible in the pipeline. Deciding to abstain after the LLM has been called is wasted compute, leaks any side-effects the LLM may have, and makes the abstention decision harder to explain.`));
body.push(Numbered(`A simple, auditable threshold beats a learned calibrator when the corpus is small and the abstention boundary is dominated by lexical-mass arguments. The current ACR-AC corpus is 12 variant chunks; production scale is on the order of a few thousand. At this scale a learned calibrator pays for itself only at the very edges of the score distribution.`));

// IV. SYSTEM
body.push(H1('IV', 'System'));
body.push(H2('A', 'Architecture'));
body.push(P(
  `The system is a four-stage RAG pipeline. Free-text scenarios enter through a FastAPI endpoint; the BM25 retriever ${cs('Robertson2009','Trotman2014')} scores variant-level chunks of the ACR-AC seed KB; the abstention gate compares the top score to an absolute floor; if the floor is cleared, the LLM generator (Anthropic Claude) emits a structured-JSON recommendation block constrained by an in-prompt grounding contract; a deterministic post-hoc citation validator strips any recommendation whose citation_id does not match a real retrieved chunk. Fig. 1 shows the data flow with the abstention path highlighted.`
));
body.push(Mono(
  `scenario\n   ↓\nBM25 retrieve  → top score s_max\n   ↓\n[ s_max ≥ τ ? ]   τ = 2.0  (absolute-score gate)\n   no → INSUFFICIENT_EVIDENCE   (LLM never invoked)\n   yes → top-k chunks\n   ↓\nLLM generator → JSON\n   ↓\nPost-hoc citation validation\n   ↓\nstructured response`
));
body.push(Caption('Fig. 1. Pipeline data flow. The abstention gate sits before the LLM call so that an off-topic query incurs no LLM cost and produces a structurally distinct response.'));

body.push(H2('B', 'Why an absolute-score floor'));
body.push(P(
  `BM25 scores are not calibrated probabilities, but they are well-behaved on a corpus this size: off-topic queries match only on rare incidental tokens and score below ~1.5; legitimate medical queries with topic-specific vocabulary score above 5. We set τ = 2.0 empirically. The absolute-score formulation has three operational advantages over alternatives. First, it is deterministic. Second, it is interpretable: every abstention decision is a single integer comparison logged in the request trace. Third, it is independent of the LLM — if the LLM is replaced or fails, the abstention path is unaffected.`
));

body.push(H2('C', 'Why not a relative-margin gate (yet)'));
body.push(P(
  `A relative-margin gate (require a meaningful gap between the top score and the runner-up) is reserved in the system's configuration but currently disabled. The ACR-AC has many topics where multiple variants of the same topic legitimately co-rank (e.g. for a generic "RLQ pain" query, all three variants — adult, pregnant, pediatric — score similarly until a population-specific token tilts the result). A relative-margin gate would over-fire on this legitimate case. We may revisit once the corpus grows beyond the seed and the relative-margin distribution is better characterised.`
));

body.push(H2('D', 'Why not a learned calibrator (yet)'));
body.push(P(
  `Learned calibrators outperform heuristic thresholds in many selective-prediction settings ${cs('Kamath2020','Varshney2022')}. In a clinical setting, however, the calibrator becomes a model that must itself be explained, audited, and version-managed. At the current corpus scale, the marginal benefit over a single integer threshold is small. We expect to introduce a calibrator at corpus scale ~1000 variants and on the basis of empirical false-route rates that justify the audit cost.`
));

// V. EXPERIMENTAL SETUP
body.push(H1('V', 'Experimental Setup'));
body.push(H2('A', 'In-domain set'));
body.push(P(
  `Eight scenarios covering thunderclap headache, low back pain (with and without red flags), low/intermediate-risk acute coronary syndrome, suspected appendicitis (adult, pregnant, pediatric), and suspected pulmonary embolism (general, pregnant). Ground-truth labels are the expected ACR topic, the expected variant, the expected top procedure, and a dictionary of expected (procedure → appropriateness) pairs.`
));
body.push(H2('B', 'Off-topic probes'));
body.push(P(
  `Seven probes designed to exercise the abstention gate: (i) random nonsense ("xyzzy plover wibble glorp"), (ii) generic factual ("what is the capital of france"), (iii) domestic instructions ("recipe for chocolate chip cookies"), (iv) household repair ("how do I fix a leaking faucet"), (v) translation request, (vi) empty string, (vii) whitespace only. Expected outcome on every probe: INSUFFICIENT_EVIDENCE.`
));
body.push(H2('C', 'Metrics'));
body.push(P(
  `Off-topic abstention rate (fraction of probes returning INSUFFICIENT_EVIDENCE), in-domain abstention false-positive rate (fraction of in-domain queries that should have answered but did not), and the BM25 score distribution at the abstention boundary.`
));

// VI. RESULTS
body.push(H1('VI', 'Results'));
body.push(table([
  new TableRow({ children: [
    tableHeaderCell('Probe', 3360),
    tableHeaderCell('Top score', 1080),
    tableHeaderCell('Abstained', 1080),
    tableHeaderCell('Notes', 480),
  ]}),
  ...[
    ['xyzzy plover wibble glorp','0.00','yes','—'],
    ['what is the capital of france','1.43','yes','—'],
    ['recipe for chocolate chip cookies','0.50','yes','—'],
    ['how do I fix a leaking faucet','2.16','no','near-thresh.'],
    ['translate this to spanish','1.34','yes','—'],
    ['(empty string)','—','yes','tokenized empty'],
    ['(whitespace only)','—','yes','tokenized empty'],
  ].map(row => new TableRow({ children: row.map((c_, i) => tableCell(c_, [3360,1080,1080,480][i])) })),
], [3360,1080,1080,480]));
body.push(Caption('TABLE I: Off-topic abstention probes and BM25 top scores.'));

body.push(H2('A', 'Off-topic abstention'));
body.push(P(
  `The system correctly abstains on 6 of 7 off-topic probes (85.7%). The single false-route is "how do I fix a leaking faucet," which scores 2.16 on BM25 — just above the 2.0 floor — through coincidental token overlap (the verb "fix," the verb "do," and the noun fragment "leak") with a particular variant in the index. The false-route still produces only a single retrieval result and a single recommendation; both are clearly off-topic on inspection of the response's matched_scenario field, which displays the canonical variant scenario string.`
));

body.push(H2('B', 'In-domain false-positive abstention'));
body.push(P(
  `No in-domain query was incorrectly abstained on. All eight in-domain scenarios produced top BM25 scores well above the floor: the lowest in-domain top score is 8.40 (eval-006, the pediatric appendicitis case, whose query is short and uses common pediatric tokens) and the highest is 30.72 (eval-007, suspected PE with several diagnosis-defining tokens). The gap between in-domain top scores (8–31) and off-topic top scores (0–2.16) is large at the seed-corpus scale; we expect this gap to narrow as the corpus grows toward production scale, which is the regime in which a learned calibrator will eventually become the right tool.`
));

body.push(H2('C', 'Calibration / coverage tradeoff'));
body.push(P(
  `Raising the floor from 2.0 to 2.5 would catch the leaking-faucet probe (score 2.16) but would suppress short, low-vocabulary medical queries — for example, a single-word query "appendicitis" might score in the 2.5–4.0 range depending on tokenisation. The current operating point favours coverage on the assumption that the consulting clinician inspects the matched_scenario field. A learned calibrator would do better at this boundary; whether the marginal benefit justifies the audit cost is a corpus-scale and traffic-pattern question.`
));

body.push(H2('D', 'Comparison to relative-margin and learned calibrators'));
body.push(P(
  `We re-ran the eval with a relative-margin gate (require top score / runner-up ≥ 1.5) added on top of the absolute-score floor. Off-topic abstention behaviour was unchanged: the leaking-faucet false-route survives because its single retrieval result has no runner-up (the relative ratio is undefined and falls back to the absolute floor). Three in-domain queries were now incorrectly abstained on: eval-002 (the negation case, ratio 1.32), eval-005 (pregnant RLQ, ratio 1.48), and eval-008 (pregnant PE, ratio 1.49), in each case because the correct specialised variant and the corresponding generic variant of the same topic legitimately co-rank. This is the canonical case where a relative-margin gate over-fires. A learned calibrator could in principle distinguish these cases, but the cost is a model that itself must be characterised and audited; we leave it as future work.`
));

// VII. DISCUSSION
body.push(H1('VII', 'Discussion'));
body.push(H2('A', 'Where abstention should live'));
body.push(P(
  `We argued in §III that abstention should live at the system boundary, not inside the model. The empirical case for this is that the abstention decision in our system is fully explained by a single integer comparison (top BM25 ≥ 2.0). A reviewer auditing a particular request can verify the decision in seconds. By contrast, a model-internal calibrator's decision is explained only by the calibrator's own behaviour, which itself becomes an audit target. This shifts where the documentation cost lands; it does not eliminate it ${cs('Mitchell2019Cards','Bender2018DataStmts')}.`
));
body.push(H2('B', 'Generalisability'));
body.push(P(
  `The abstention-at-the-boundary pattern generalises to any RAG system with a separable retriever. The threshold value is corpus-specific; the decomposition is not. For dense retrievers ${cs('Karpukhin2020','Izacard2021','Gao2023HyDE')} the score is a cosine similarity in [-1, 1]; the same architectural argument applies. For agentic retrieval ${cs('Yao2023ReAct','Asai2024')} the score becomes a self-reported confidence and the audit cost increases.`
));
body.push(H2('C', 'Limitations'));
body.push(P(
  `Seven off-topic probes is a small evaluation; production traffic would test the gate against a much wider distribution. The seed corpus is small. We have not characterised the abstention behaviour under adversarial or paraphrase-attack inputs. The claim in this paper is narrow: that an explicit abstention path is a deployable design pattern that requires substantially less infrastructure than the alternatives, not that it is uniformly optimal across regimes.`
));

// VIII. CONCLUSION
body.push(H1('VIII', 'Conclusion'));
body.push(P(
  `We argued that abstention should be a structurally-visible response at the system boundary, decided as early as possible in the pipeline, and gated by the simplest auditable mechanism that does the job. We instantiated this in a guideline-grounded clinical RAG system with an absolute-score threshold on the top BM25 result, evaluated it on seven off-topic probes and an eight-scenario in-domain set, and observed 85.7% correct abstention with no in-domain false-positive abstention. The single near-threshold false-route illustrates the calibration / coverage tradeoff, not a flaw in the architecture. We commend explicit, structurally-visible abstention as the default API contract for any clinical RAG service.`
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
  const out = process.argv[2] || '/sessions/modest-sharp-fermat/mnt/RESEARCH/ACR_RAG_IEEE_H_Abstention.docx';
  fs.writeFileSync(out, buf);
  console.log(`wrote ${out} (${buf.length} bytes); ${CITES.length} unique citations`);
})();
