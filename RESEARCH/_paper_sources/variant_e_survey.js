// Variant E — Mini-survey / position paper (~6 pages).
// Voice: opinionated review article. Frames the field as a small taxonomy and
// situates the ACR-AC system as a worked case study supporting the position.

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
  Title('Guideline-Grounded Clinical RAG: A Mini-Survey and a Position'),
  Subtitle('Why "ground-on-the-guideline, validate-the-citation, abstain-when-uncertain" should be the default architecture, with a worked case study on the ACR Appropriateness Criteria'),
  Subtitle('[Author Name], [Affiliation], [Email]'),
  Abstract(
    `We survey the rapidly growing literature at the intersection of large language models (LLMs), retrieval-augmented generation (RAG), and clinical decision support, and argue that the field has reached a point where a default architecture should be named and adopted. The default we propose is guideline-grounded RAG: retrieve from a curated, citable, panel-rated guideline corpus rather than from open-domain medical text; constrain the LLM to recommend only items present in retrieved context; validate each citation deterministically before serialising the response; and abstain visibly when no retrieved chunk crosses threshold. We organise the recent literature along three axes — corpus, control, and accountability — and place representative systems on the resulting grid. We then present a worked case study on the ACR Appropriateness Criteria that exhibits all three properties, with quantitative evidence: 100.0% topic accuracy and 100.0% citation fidelity on an eight-scenario harness, with a single instructive failure on a negation case that motivates a clear retrieval-layer upgrade. We argue that adopting this default architecture is the necessary precondition for a regulatory and clinical-acceptance pathway that the LLM-only literature, on its own, will struggle to deliver.`
  ),
  Keywords(
    ' Survey, position paper, clinical RAG, guideline-grounded retrieval, citation faithfulness, abstention, large language models in medicine, ACR Appropriateness Criteria.'
  ),
];

// ---------------- 1. Why a survey now ----------------
const why = [
  H1('1. Why This Survey Now'),
  P(
    `The literature on LLMs in clinical settings has grown faster than the literature on how to deploy them safely. Med-PaLM ${c('Singhal2023')} and Med-PaLM 2 ${c('Singhal2025')} demonstrated that frontier models can reach expert-level scores on USMLE-style benchmarks ${c('Jin2021MedQA')}. GPT-4 has been characterised on broad medical-challenge sets ${c('Nori2023')}, evaluated as a clinical-medicine chatbot ${c('Lee2023NEJM')}, and tested against reference clinicians on complex diagnoses ${c('Kanjee2023JAMA')}. In radiology, ChatGPT-class systems have been studied on board-style examinations ${c('Bhayana2023')}, on report transformation ${c('Adams2023')}, on plain-language translation ${c('Lyu2023')}, and as decision-support adjuncts ${cs('Rao2023','Elkassem2023','Bhayana2024')}. Yet a recent randomised clinical trial showed that an unaided LLM did not reliably improve physician diagnostic reasoning ${c('Goh2024JAMA')}, and reviews continue to catalog hallucination at clinically meaningful rates ${cs('Ji2023','Huang2023','Tonmoy2024')}.`,
    { indent: true }
  ),
  P(
    `In parallel, retrieval-augmented generation has become the dominant approach for grounding LLMs ${cs('Lewis2020','Gao2023Survey')}, and dedicated medical-RAG systems have emerged: MedRAG ${c('Xiong2024')} benchmarks medical RAG over five corpora; Almanac ${c('Zakka2024')} demonstrates a clinical RAG system whose evaluation axes (factuality, completeness, safety) are the right ones; Rau et al. ${c('Rau2023')} show an ACR-AC-grounded chatbot outperforming both generic ChatGPT and trained radiologists. Yet there is no consensus on what the default architecture should look like — what the corpus should be, what the LLM is allowed to do, and what the system as a whole owes the clinician.`,
    { indent: true }
  ),
  P(
    `This paper takes a position. We argue that the default architecture should be guideline-grounded RAG: not "retrieve from medical literature," but "retrieve from a curated, citable, panel-rated guideline corpus and constrain the LLM accordingly." Section 2 organises the recent literature along three axes that make the position legible. Section 3 surveys systems against those axes. Section 4 presents an ACR Appropriateness Criteria case study that satisfies the position. Section 5 discusses three open questions. Section 6 concludes.`,
    { indent: true }
  ),
];

// ---------------- 2. Three axes ----------------
const axes = [
  H1('2. Three Axes for Reading the Field'),
  P(
    `We organise the recent literature on clinical RAG along three axes — corpus, control, and accountability — chosen because together they determine whether a system can be placed in a clinical workflow.`
  ),
  H2('2.1 Corpus axis: open-domain ↔ curated-guideline'),
  P(
    `At one end is open-domain medical text (PubMed, textbooks, clinical notes, web). MedRAG ${c('Xiong2024')} sits near this end and benchmarks five corpora that span this range; Atlas ${c('Izacard2023Atlas')} and HyDE ${c('Gao2023HyDE')} are general retrieval techniques that can be applied to any corpus. At the other end is a curated, panel-rated guideline corpus (ACR Appropriateness Criteria, NICE guidelines, Choosing Wisely, antibiogram tables, oncology pathway documents). The differentiator is not size but provenance: a guideline corpus has known authors, an explicit methodology ${c('ACRMethod2021')}, a versioning policy, and a citation unit (the panel-rated variant or recommendation) that maps directly to the consumer's recommendation.`
  ),
  H2('2.2 Control axis: free-form ↔ schema-constrained'),
  P(
    `At one end the LLM produces free-form prose; at the other it produces a typed, schema-constrained object whose fields are checkable against the retrieved context. Adams et al. ${c('Adams2023')} demonstrate that GPT-4 can produce well-formed structured radiology output reliably when constrained to a clear schema; Asai et al.'s Self-RAG ${c('Asai2024')} pushes structure into the model's decoding via reflection tokens. ReAct-style ${c('Yao2023ReAct')} and active-retrieval ${c('Jiang2023FLARE')} architectures expose more control points; in-context RAG ${c('Ram2023')} and FiD ${c('Izacard2021')} are simpler but less expressive. The control axis matters because schema constraints are what make the citation-validation guardrail expressible at all.`
  ),
  H2('2.3 Accountability axis: implicit ↔ invariant'),
  P(
    `At one end, faithfulness is an emergent property of the LLM (subject to fine-tuning and prompting). At the other, faithfulness is a system invariant (enforced by deterministic post-hoc machinery). The attribution literature ${cs('Bohnet2022','Rashkin2023')} sits at the implicit end; RARR ${c('Gao2023RARR')} and self-consistency-style ${c('Wang2023SC')} approaches push toward stronger guarantees but remain statistical. A deterministic post-hoc check that strips any recommendation whose citation does not exist is at the invariant end. The accountability axis is the most consequential of the three: a clinical service that wants to give a hard guarantee on citation existence cannot get there by improving the model alone ${c('Tonmoy2024')}.`
  ),
  H2('2.4 The grid'),
  table([
    new TableRow({ children: [
      tableHeaderCell('System / approach', 3000),
      tableHeaderCell('Corpus', 1800),
      tableHeaderCell('Control', 2000),
      tableHeaderCell('Accountability', 2560),
    ]}),
    ...[
      ['Open-domain RAG (Lewis 2020 RAG)','Open','Free-form','Implicit'],
      ['Atlas (few-shot RAG)','Open','Free-form','Implicit'],
      ['HyDE (zero-shot dense retrieval)','Open','Free-form','Implicit'],
      ['Self-RAG (reflection tokens)','Open','Schema/critique','Statistical'],
      ['ReAct / FLARE (active retrieval)','Open','Tool-use','Statistical'],
      ['MedRAG (medical-corpus benchmark)','Curated medical','Free-form','Statistical'],
      ['Almanac (clinical RAG, NEJM AI)','Curated clinical','Schema-constrained','Statistical'],
      ['Rau et al. 2023 (ACR-AC chatbot)','Guideline','Free-form','Statistical'],
      ['Our case study (this paper)','Guideline','Schema-constrained','Invariant'],
    ].map(row => new TableRow({ children: row.map((c_, i) => tableCell(c_, [3000,1800,2000,2560][i])) })),
  ], [3000,1800,2000,2560]),
  Caption('Table I. Representative clinical-RAG approaches placed on the three axes. The position of this paper is that the bottom-right cell (guideline corpus + schema-constrained control + invariant accountability) should be the default. No paper we have found previously occupies this cell with a deterministic post-hoc citation-existence guarantee.'),
];

// ---------------- 3. The position ----------------
const position = [
  H1('3. The Position'),
  P(
    `The default architecture for clinical RAG should satisfy four properties simultaneously:`
  ),
  Numbered(
    `Ground on a curated, citable, panel-rated guideline corpus. Open-domain medical text is too noisy a substrate for a system whose recommendations must be defendable to a credentialing body or a malpractice review.`
  ),
  Numbered(
    `Constrain the LLM to a typed schema whose fields can be checked against the retrieved context. This is the precondition for any deterministic citation guarantee.`
  ),
  Numbered(
    `Validate citations by deterministic post-hoc check. Treat citation faithfulness as a system invariant; do not rely on the LLM to be faithful.`
  ),
  Numbered(
    `Abstain visibly when no retrieved chunk crosses threshold. INSUFFICIENT_EVIDENCE should be a structured response, not a confidence score buried in the payload.`
  ),
  P(
    `These four properties are mutually reinforcing. A guideline corpus makes the citation unit clean and checkable; a typed schema makes the deterministic check expressible; the deterministic check makes abstention coherent (because what we are abstaining on is the existence of a valid recommendation); and abstention closes the only remaining failure path that the citation guarantee does not handle.`
  ),
  P(
    `Many recent systems satisfy two or three of the properties (Table I); few satisfy all four. The ones that come closest — Almanac ${c('Zakka2024')}, Rau et al. ${c('Rau2023')} — do so without an explicit invariant on citation existence. We argue this is the cell of the field that is now ready to be filled in.`
  ),
];

// ---------------- 4. Worked case study ----------------
const worked = [
  H1('4. Worked Case Study: ACR Appropriateness Criteria'),
  H2('4.1 Why ACR-AC is the right corpus'),
  P(
    `The ACR Appropriateness Criteria ${cs('ACRMethod2021','Sistrom2008','Sheng2016')} are produced by topic-specific expert panels using a modified RAND/UCLA Appropriateness Method augmented with GRADE evidence rating. There are over two hundred topics; within each topic, a small number of variants capture clinically significant differences in presentation; within each variant, each candidate procedure is rated 1–9 and assigned a Relative Radiation Level. Three properties make ACR-AC unusually well-suited as a RAG corpus: (i) the unit of meaningful retrieval is the variant; (ii) the procedure ranking is the recommendation, with no narrative-summary step required; (iii) the citation unit is also the variant. These three together mean that a guideline-grounded RAG over ACR-AC is essentially a chunk → reformat operation, with no synthesis required of the LLM. This is the simplest possible setting in which to demonstrate the position.`
  ),
  H2('4.2 The system'),
  P(
    `We summarise the system whose detail is in companion papers; here we describe only the components that satisfy the four properties. The retriever is BM25 ${cs('Robertson2009','Trotman2014')} over variant-level chunks with a 3× keyword amplification on variant-specific tokens (so that BM25 can distinguish pregnant, pediatric, and red-flag variants from the generic adult variant of the same topic). An absolute-score floor (top BM25 ≥ 2.0) implements the abstention gate: below the floor the retriever returns empty and the pipeline emits INSUFFICIENT_EVIDENCE. The generator (Anthropic Claude) is constrained by a six-rule in-prompt grounding contract (ground-only, citation-required, abstain-on-mismatch, JSON-only, surface-RRL/contrast, sort-descending). A deterministic post-hoc validator strips any recommendation whose citation_id is not in the set of valid retrieved chunk IDs; rejected items are surfaced separately for audit.`
  ),
  H2('4.3 Quantitative evidence'),
  P(
    `On an eight-scenario in-domain harness (thunderclap headache; LBP with and without red flags; low/intermediate-risk ACS; suspected appendicitis in adult, pregnant, and pediatric variants; suspected PE in general and pregnancy variants), the system achieves 100.0% topic accuracy (8/8), 87.5% variant accuracy (7/8), 87.5% top-procedure accuracy (7/8), 87.5% appropriateness-score concordance, and 100.0% citation fidelity. On seven off-topic abstention probes, 6/7 (85.7%) correctly return INSUFFICIENT_EVIDENCE; the single false-route is a near-threshold case that scores 2.16 on a 2.0 floor. End-to-end stub-mode pipeline latency is 0.04 ms (mean over 100 queries).`
  ),
  H2('4.4 The instructive failure'),
  P(
    `The single in-domain miss is a negation case: a young patient with explicit negative red flags ("no fever, no neurologic symptoms, no weight loss, no cancer history") is over-routed to the red-flag LBP variant because BM25 cannot represent polarity. This is exactly the boundary at which a lexical retriever should hand off to a polarity-aware mechanism — a dense retriever ${cs('Karpukhin2020','Izacard2021','Gao2023HyDE')} fine-tuned with negation-aware contrastive pairs, or an LLM-based variant rerank step ${cs('Asai2024','Yao2023ReAct')} that inspects the polarity of the query directly. The failure direction is conservative (over-recommends imaging) and is immediately visible to the clinician through the matched_scenario field of the response. From the survey's perspective, the negation case is useful because it makes the boundary between corpus axis and control axis legible: there is nothing the corpus or the validator can do for negation; the fix is on the retrieval/control side.`
  ),
];

// ---------------- 5. Open questions ----------------
const open = [
  H1('5. Three Open Questions'),
  H2('5.1 What is the right confidence calibrator?'),
  P(
    `An absolute BM25 floor is the simplest possible abstention gate. The selective-prediction literature ${cs('Kamath2020','Varshney2022')} argues that learned calibrators outperform heuristic thresholds; in clinical settings the cost of a learned calibrator is that it adds a model that must be itself explained and audited. Self-consistency ${c('Wang2023SC')} and LLM-as-judge ${c('Zheng2023MTBench')} provide alternative confidence signals. The open question is whether the marginal benefit of a learned calibrator over a single integer comparison is worth the audit cost in this regime.`
  ),
  H2('5.2 What does a regulatory pathway look like for an invariant-grounded service?'),
  P(
    `Existing FDA pathways for clinical decision support are written for rule-based or fixed-model devices. A service whose recommendations are produced by an LLM but whose citation faithfulness is enforced by a deterministic post-hoc check is a different artifact: the LLM is not the system of record; the guideline corpus is. We do not believe existing regulatory frameworks have absorbed this distinction yet. Documentation artifacts in the spirit of model cards ${c('Mitchell2019Cards')}, datasheets ${c('Gebru2021Datasheets')}, and data statements ${c('Bender2018DataStmts')} are likely the right starting point for that conversation.`
  ),
  H2('5.3 How does the architecture extend to multi-step clinical reasoning?'),
  P(
    `ACR-AC is a one-step task: scenario → variant → ranked recommendations. Many clinical tasks are multi-step (differential diagnosis, treatment planning, follow-up scheduling). The position-paper claim — ground-on-guideline, schema-constrain, validate-citation, abstain-on-uncertainty — extends in principle but requires a per-step citation guarantee and per-step abstention. Self-RAG ${c('Asai2024')} and ReAct ${c('Yao2023ReAct')} are the architectures we expect to inherit, augmented with the deterministic citation invariant. We treat this as the natural next research direction for the field.`
  ),
];

// ---------------- 6. Conclusion ----------------
const conclusion = [
  H1('6. Conclusion'),
  P(
    `The clinical-RAG literature has reached a point where a default architecture should be named. We named it: ground on a curated, citable, panel-rated guideline corpus; constrain the LLM to a typed schema; validate citations deterministically; abstain visibly. The four properties are mutually reinforcing and together close the dominant LLM failure modes that have made prior LLM-in-medicine evaluations unsuitable for deployment ${cs('Bhayana2023','Lyu2023','Goh2024JAMA')}. The case study on the ACR Appropriateness Criteria provides quantitative evidence that the architecture is realisable today (100.0% citation fidelity, 100.0% topic accuracy, 6/7 abstention) with a small, transparent implementation. We argue that this architecture should be the default starting point for the next generation of clinical-decision-support systems.`
  ),
];

const refs_section = () => {
  const out = [refsHeading()];
  CITES.forEach((key, i) => out.push(refLine(i + 1, R[key])));
  return out;
};

const allChildren = [
  ...front, ...why, ...axes, ...position, ...worked, ...open, ...conclusion,
  ...refs_section(),
];

const doc = new Document({
  styles: buildStyles(),
  numbering: numberingConfig,
  sections: [buildSection(allChildren)],
});

(async () => {
  const buf = await Packer.toBuffer(doc);
  const out = process.argv[2] || '/sessions/modest-sharp-fermat/mnt/RESEARCH/ACR_RAG_Variant_E_Survey.docx';
  fs.writeFileSync(out, buf);
  console.log(`wrote ${out} (${buf.length} bytes); ${CITES.length} unique citations`);
})();
