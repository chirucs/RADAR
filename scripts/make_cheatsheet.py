"""Generate the demo cheat-sheet PDF for the ACR Consult Assistant meeting.

Run:
    python scripts/make_cheatsheet.py

Output:
    t:/Amy_Research Paper/ACR_Assistant/Demo_Cheatsheet.pdf
"""
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate,
    Paragraph, Spacer, PageBreak, Table, TableStyle, KeepTogether,
)


# ─── colors ────────────────────────────────────────────────────────────────
NAVY     = colors.HexColor("#0E2A47")
ACCENT   = colors.HexColor("#216EA6")
LIGHT_BG = colors.HexColor("#F2F6FA")
SAY_BG   = colors.HexColor("#E8F1F8")
TIP_BG   = colors.HexColor("#FFF6DD")
WARN_BG  = colors.HexColor("#FCE8E6")
DARK     = colors.HexColor("#1A1E24")
MUTED    = colors.HexColor("#5A6470")
RULE     = colors.HexColor("#D0D7DE")


# ─── styles ────────────────────────────────────────────────────────────────
styles = getSampleStyleSheet()

H1 = ParagraphStyle(
    "H1", parent=styles["Heading1"],
    fontName="Helvetica-Bold", fontSize=22, leading=26,
    textColor=NAVY, spaceAfter=10, spaceBefore=0,
)
H2 = ParagraphStyle(
    "H2", parent=styles["Heading2"],
    fontName="Helvetica-Bold", fontSize=15, leading=19,
    textColor=NAVY, spaceAfter=6, spaceBefore=14,
    borderPadding=(0, 0, 4, 0),
)
H3 = ParagraphStyle(
    "H3", parent=styles["Heading3"],
    fontName="Helvetica-Bold", fontSize=12, leading=16,
    textColor=ACCENT, spaceAfter=4, spaceBefore=8,
)
BODY = ParagraphStyle(
    "Body", parent=styles["BodyText"],
    fontName="Helvetica", fontSize=11, leading=15,
    textColor=DARK, spaceAfter=6,
)
SAY = ParagraphStyle(
    "Say", parent=BODY,
    fontName="Helvetica-Oblique", fontSize=11, leading=15,
    textColor=DARK, leftIndent=12, rightIndent=12,
    spaceBefore=4, spaceAfter=4,
    borderPadding=(8, 10, 8, 10),
    backColor=SAY_BG,
    borderColor=ACCENT, borderWidth=0,
)
TIP = ParagraphStyle(
    "Tip", parent=BODY,
    fontName="Helvetica", fontSize=10, leading=14,
    textColor=DARK, leftIndent=12, rightIndent=12,
    spaceBefore=4, spaceAfter=4,
    borderPadding=(8, 10, 8, 10),
    backColor=TIP_BG,
)
WARN = ParagraphStyle(
    "Warn", parent=BODY,
    fontName="Helvetica-Bold", fontSize=10, leading=14,
    textColor=DARK, leftIndent=12, rightIndent=12,
    spaceBefore=4, spaceAfter=4,
    borderPadding=(8, 10, 8, 10),
    backColor=WARN_BG,
)
ACTION = ParagraphStyle(
    "Action", parent=BODY,
    fontName="Helvetica-Bold", fontSize=11, leading=15,
    textColor=ACCENT, leftIndent=0, spaceBefore=6, spaceAfter=2,
)
SMALL = ParagraphStyle(
    "Small", parent=BODY,
    fontName="Helvetica", fontSize=9, leading=12, textColor=MUTED,
)
BULLET = ParagraphStyle(
    "Bullet", parent=BODY, leftIndent=18, bulletIndent=6,
    spaceAfter=3,
)


# ─── helpers ───────────────────────────────────────────────────────────────
def hr():
    t = Table([[""]], colWidths=[6.5 * inch], rowHeights=[1])
    t.setStyle(TableStyle([
        ("LINEABOVE", (0, 0), (-1, -1), 0.5, RULE),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return t


def section(title, items):
    """A section is [section_title, [item, item, ...]] where each item is a flowable."""
    out = [Paragraph(title, H1), Spacer(1, 4), hr(), Spacer(1, 8)]
    out.extend(items)
    return out


def qa(question, say, tip=None):
    """Question + spoken answer + optional tip."""
    out = [
        Paragraph(question, H2),
        Paragraph(say, SAY),
    ]
    if tip:
        out.append(Paragraph(tip, TIP))
    return out


def step(num, label, click=None, say=None, point=None):
    """Demo step: numbered, with optional click/say/point sub-bullets."""
    out = [Paragraph(f"<b>Step {num} &mdash; {label}</b>", H3)]
    if click:
        out.append(Paragraph(f"<b>Click:</b> {click}", BODY))
    if point:
        out.append(Paragraph(f"<b>Point at:</b> {point}", BODY))
    if say:
        out.append(Paragraph(say, SAY))
    return out


# ─── page header / footer ──────────────────────────────────────────────────
def on_page(canvas, doc):
    canvas.saveState()
    # header line
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.5)
    canvas.line(0.7 * inch, 10.4 * inch, 7.8 * inch, 10.4 * inch)

    # header text
    canvas.setFont("Helvetica", 9)
    canvas.setFillColor(MUTED)
    canvas.drawString(0.7 * inch, 10.5 * inch, "ACR Consult Assistant — Demo Cheat Sheet")
    canvas.drawRightString(7.8 * inch, 10.5 * inch, "For meeting use only")

    # footer
    canvas.setFillColor(MUTED)
    canvas.drawCentredString(4.25 * inch, 0.4 * inch, f"Page {doc.page}")
    canvas.restoreState()


# ─── document ──────────────────────────────────────────────────────────────
out_path = Path(__file__).resolve().parents[1] / "Demo_Cheatsheet.pdf"
doc = BaseDocTemplate(
    str(out_path), pagesize=letter,
    leftMargin=0.7 * inch, rightMargin=0.7 * inch,
    topMargin=0.9 * inch, bottomMargin=0.7 * inch,
    title="ACR Consult Assistant — Demo Cheat Sheet",
    author="Built with Claude Code",
)
frame = Frame(doc.leftMargin, doc.bottomMargin,
              doc.width, doc.height, id="main")
doc.addPageTemplates([PageTemplate(id="all", frames=[frame], onPage=on_page)])

story = []


# ─── COVER ─────────────────────────────────────────────────────────────────
story.append(Spacer(1, 1.6 * inch))
story.append(Paragraph("ACR Consult Assistant", ParagraphStyle(
    "cover", parent=H1, fontSize=32, leading=40, alignment=TA_CENTER,
    textColor=NAVY,
)))
story.append(Paragraph("Demo Cheat Sheet", ParagraphStyle(
    "covsub", parent=H2, fontSize=18, leading=22, alignment=TA_CENTER,
    textColor=ACCENT, spaceBefore=8,
)))
story.append(Spacer(1, 0.4 * inch))
story.append(Paragraph(
    "Plain-English answers and a step-by-step demo script for the 30-minute meeting.",
    ParagraphStyle("covbody", parent=BODY, alignment=TA_CENTER, fontSize=12,
                   textColor=MUTED),
))
story.append(Spacer(1, 0.4 * inch))

# What's inside box
contents_data = [
    ["1.", "If she asks: \"What do you understand about this project?\""],
    ["2.", "If she asks: \"How did you build it?\""],
    ["3.", "If she asks: \"Is it RAG, and how does it work?\""],
    ["4.", "Live demo &mdash; step-by-step Streamlit walkthrough"],
    ["5.", "If she asks about the sidebar settings (top-k, BM25 score)"],
    ["6.", "If she asks: \"How did you get the data?\""],
    ["7.", "Other likely questions &mdash; quick answers"],
    ["8.", "How to explain the code &mdash; 6 files, in plain English"],
    ["9.", "One-line answers &mdash; quick reference card"],
]
contents_rows = [[Paragraph(a, BODY), Paragraph(b, BODY)] for a, b in contents_data]
contents_tbl = Table(contents_rows, colWidths=[0.4 * inch, 5.5 * inch])
contents_tbl.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), LIGHT_BG),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 12),
    ("RIGHTPADDING", (0, 0), (-1, -1), 12),
    ("TOPPADDING", (0, 0), (-1, -1), 6),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ("LINEBEFORE", (0, 0), (0, -1), 3, ACCENT),
]))
story.append(contents_tbl)

story.append(Spacer(1, 0.4 * inch))
story.append(Paragraph(
    "<b>How to use:</b> keep this page open or printed during the meeting. "
    "When she asks something, find the matching section. "
    "The italic blue boxes are the words you can read out loud. "
    "Yellow boxes are tips. Red boxes are warnings.",
    ParagraphStyle("usage", parent=BODY, alignment=TA_LEFT, fontSize=10,
                   textColor=MUTED, leftIndent=24, rightIndent=24),
))

story.append(PageBreak())


# ─── SECTION 1 ─────────────────────────────────────────────────────────────
story.extend(section(
    "1.  \"What do you understand about this project?\"",
    qa(
        "The 60-second answer (read this aloud)",
        "A radiologist's job isn't just reading scans &mdash; they also act as the imaging "
        "consultant other doctors call. When an ER doctor or surgeon asks <i>'what scan "
        "should I order for this patient?'</i>, the radiologist has to give an answer "
        "that follows an authoritative rulebook called the ACR Appropriateness Criteria. "
        "<br/><br/>"
        "That rulebook is huge &mdash; hundreds of clinical scenarios, each with sub-variants, "
        "each with ranked imaging options scored 1 to 9. Looking it up in real time during "
        "a phone consult is slow, so radiologists answer from memory and answers vary "
        "across people. <br/><br/>"
        "This project turns that rulebook into an LLM-powered consult tool. The radiologist "
        "types a free-text clinical scenario, and the system returns the matching ACR variant, "
        "the ranked imaging recommendations, the safety flags for radiation and contrast, "
        "and a citation pointing back to the rulebook entry. It's a decision-support tool &mdash; "
        "not a diagnostic tool &mdash; designed to make the consult faster, more consistent, and "
        "traceable to the source.",
        tip="<b>Tip:</b> If you're nervous, just say the first sentence and the last sentence. "
            "That's the whole project in 20 seconds.",
    ),
))

story.append(PageBreak())


# ─── SECTION 2 ─────────────────────────────────────────────────────────────
story.extend(section(
    "2.  \"How did you build it?\"",
    qa(
        "The 60-second answer (read this aloud)",
        "I started from the manuscript outline by Avakian and Chakravarty &mdash; that document "
        "defined the system, the architecture, and the evaluation metrics. I built it in "
        "Python. About a thousand lines across seventeen modules. <br/><br/>"
        "I structured the knowledge base as JSON that mirrors the real ACR Appropriateness "
        "Criteria schema &mdash; topic, variant, procedure, score, radiation level, contrast flag. "
        "Five topics and twelve variants in the seed. The retrieval layer uses a library "
        "called rank-bm25, which is a classic lexical search algorithm &mdash; pure Python, "
        "no GPU needed. The generation layer uses Anthropic's Claude API, with a system "
        "prompt that forbids the model from recommending anything outside the retrieved "
        "context. After the model returns, I run a separate validator that re-checks every "
        "citation against the actual knowledge base and strips anything that looks fake. "
        "So the safety guarantee doesn't depend on the model behaving &mdash; it's enforced "
        "deterministically after generation. <br/><br/>"
        "On top of that I built a FastAPI server, a Streamlit web UI, and an evaluation "
        "harness with eight ground-truth scenarios that scores the system on the four "
        "metrics from the manuscript &mdash; topic accuracy, variant accuracy, appropriateness "
        "concordance, and citation fidelity. The whole thing has unit tests and runs "
        "end-to-end in under a second.",
    ),
))

story.append(Paragraph("If she wants the short version", H3))
story.append(Paragraph(
    "Three pieces: <b>(1)</b> a knowledge base in JSON that mirrors the real ACR rulebook, "
    "<b>(2)</b> a search-and-LLM pipeline that grounds every answer in that knowledge base, "
    "and <b>(3)</b> an evaluation harness that scores it against the manuscript's metrics. "
    "Built in Python with FastAPI and Streamlit.",
    SAY,
))

story.append(PageBreak())


# ─── SECTION 3 ─────────────────────────────────────────────────────────────
story.extend(section(
    "3.  \"Is it RAG, and how does it work?\"",
    qa(
        "The 60-second answer (read this aloud)",
        "Yes, it's RAG &mdash; Retrieval-Augmented Generation. The idea is simple: instead of "
        "asking a language model a question and hoping it knows the answer, you first "
        "<b>search</b> for relevant facts in your own knowledge base, then <b>pass those "
        "facts to the model</b> along with the question, and ask it to answer <b>only "
        "using what you gave it</b>. <br/><br/>"
        "In our system, the knowledge base is the ACR rulebook. When the radiologist types "
        "a scenario, stage one is retrieval &mdash; we search the rulebook with BM25 and pull "
        "out the top five most relevant variants. Stage two is generation &mdash; we send "
        "those variants plus the scenario to Claude, with strict instructions to recommend "
        "only procedures that appear in those variants and to attach a citation ID to "
        "every recommendation. Stage three is validation &mdash; we check those citation IDs "
        "against the real chunks and throw out anything fake.",
    ),
))

story.append(Paragraph(
    "<b>If she asks: \"Why RAG instead of training a custom medical model?\"</b>", H3
))
story.append(Paragraph(
    "Three reasons. The rulebook updates over time, so we want the system to read the "
    "latest version, not memorize an old one. The output needs citations a doctor can "
    "verify, which fine-tuned models don't naturally produce. And RAG is way cheaper &mdash; "
    "no training, no GPUs, just a knowledge base and an API call. If the ACR publishes "
    "a new edition tomorrow, we update the JSON file and we're done.",
    SAY,
))

story.append(Paragraph("Even simpler &mdash; one-line versions", H3))
story.append(Paragraph(
    "<b>What is RAG?</b> &mdash; \"Search the rulebook first, then ask the AI using only what we found.\"",
    BODY,
))
story.append(Paragraph(
    "<b>Why RAG?</b> &mdash; \"Cheaper than training, easier to update, and the citations make it auditable.\"",
    BODY,
))

story.append(PageBreak())


# ─── SECTION 4 — DEMO SCRIPT ───────────────────────────────────────────────
story.extend(section(
    "4.  Live demo &mdash; step-by-step Streamlit walkthrough",
    [
        Paragraph(
            "<b>Before you start:</b> Streamlit running at "
            "<font name='Courier'>http://localhost:8501</font>. "
            "Sidebar visible. Mode indicator at the bottom of the sidebar should show "
            "<b>Claude</b> (green) &mdash; if it shows <b>Stub</b> (yellow), the API key isn't loaded.",
            TIP,
        ),
    ],
))

story.extend(step(
    1, "Set the stage (15 seconds)",
    click="nothing yet, just point at the screen",
    say="\"This is the front-end of what I built. The radiologist types a clinical scenario "
        "in plain English on the left, and the system returns the structured ACR-rulebook "
        "answer on the right. The sidebar has settings &mdash; API key, retrieval parameters, "
        "debug toggles. Bottom of the sidebar shows the mode &mdash; right now it's running "
        "in Claude mode, so the LLM is actually being called.\"",
))

story.extend(step(
    2, "Demo scenario 1: Thunderclap headache (90 seconds)",
    click="the example button labeled <b>Thunderclap headache</b>, then <b>Get recommendation</b>",
    say="\"I'll click an example. The scenario auto-fills. And the result comes back in a "
        "couple of seconds.\"",
    point="the four top metrics (Topic / Variant / Confidence / Mode)",
))

story.append(Paragraph(
    "Then point at the <b>Matched scenario</b> box: \"Here's the actual rulebook scenario "
    "it matched against &mdash; this is the system showing its work.\"",
    BODY,
))
story.append(Paragraph(
    "Point at the <b>safety flags</b>: \"Auto-generated radiation and contrast warnings. "
    "The radiologist sees these without having to remember them.\"",
    BODY,
))
story.append(Paragraph(
    "Point at a <b>recommendation card</b>: \"Each card shows the score, the category, the "
    "radiation level, the contrast flag, the rationale, and &mdash; most importantly &mdash; a "
    "citation_id. That ID traces back to the exact chunk in the knowledge base.\"",
    BODY,
))
story.append(Paragraph(
    "Open <b>Retrieval debug</b> expander: \"For transparency &mdash; these are the actual BM25 "
    "scores. The thunderclap variant dominates; the others are far behind.\"",
    BODY,
))

story.append(Spacer(1, 8))
story.extend(step(
    3, "Demo scenario 2: Pregnant RLQ pain (60 seconds)",
    click="the example button <b>Pregnant RLQ pain</b>, then <b>Get recommendation</b>",
    say="\"Same family of complaint as a regular adult right lower quadrant pain &mdash; but "
        "watch what happens with the variant.\"",
    point="the Variant metric, then the top recommendation card",
))
story.append(Paragraph(
    "\"It picked the pregnancy variant, not the adult one. And the top recommendation "
    "flipped from CT to ultrasound &mdash; because we want to avoid radiation in pregnancy. "
    "Same chief complaint, completely different right answer. <b>Picking the right "
    "variant is the hard problem in this space, and the system is getting it right.</b>\"",
    SAY,
))

story.append(PageBreak())

story.extend(step(
    4, "Demo scenario 3: The safety story (45 seconds)",
    click="the example button <b>Off-topic (negative test)</b>, then <b>Get recommendation</b>",
    say="\"Now I want to show the safety guarantee. This is a query that has nothing to "
        "do with radiology &mdash; literally 'what is the capital of France'.\"",
    point="the INSUFFICIENT_EVIDENCE warning",
))
story.append(Paragraph(
    "\"The system refused to answer. The retrieval confidence floor caught it &mdash; the top "
    "BM25 score was below our threshold, so the LLM was never even called. <b>In medicine, "
    "'I don't know' is a feature, not a bug.</b> This is one of three layers of defense "
    "against the system saying something it can't back up with the rulebook.\"",
    SAY,
))

story.append(Spacer(1, 8))
story.extend(step(
    5, "Optional: a custom scenario you type (60 seconds)",
    click="<b>Clear</b>, then type the scenario below into the text area, then "
          "<b>Get recommendation</b>",
    say="\"And finally something custom &mdash; let me type a real-ish scenario as if I were a "
        "doctor on the phone.\"",
))
story.append(Paragraph(
    "<b>Type:</b> <font name='Courier'>67M with low back pain, history of prostate cancer, "
    "new bowel incontinence and saddle anesthesia</font>",
    BODY,
))
story.append(Paragraph(
    "\"It correctly routed to the Low Back Pain red-flag variant &mdash; saddle anesthesia and "
    "cancer history are red flags for cauda equina or metastatic disease &mdash; and it's "
    "recommending MRI lumbar with contrast at 9 out of 9. That's the right answer.\"",
    SAY,
))

story.append(Spacer(1, 8))
story.extend(step(
    6, "Wrap (15 seconds)",
    say="\"So behind every one of these answers there are three things happening: a "
        "retrieval step that searches the rulebook, a generation step with strict "
        "citation rules, and a post-validation step that strips anything fake. The whole "
        "pipeline runs in under a second per query in stub mode, and a couple of seconds "
        "with Claude. <br/><br/>"
        "Want me to walk through the evaluation numbers, or jump to questions?\"",
))

story.append(Paragraph(
    "<b>If something errors mid-demo:</b> stay calm. Say <i>\"This is a research prototype &mdash; "
    "let me retry\"</i> and click the example again. Don't apologize repeatedly.",
    WARN,
))

story.append(PageBreak())


# ─── SECTION 5 — SETTINGS ──────────────────────────────────────────────────
story.extend(section(
    "5.  If she asks about the sidebar settings",
    [],
))

story.append(Paragraph("top-k = 5", H2))
story.append(Paragraph(
    "Think of it like Google search. When you search for something, Google shows a list "
    "of results &mdash; you usually look at the top few, not all million. Same idea here.",
    BODY,
))
story.append(Paragraph(
    "\"This controls how many candidate matches we pull from the rulebook before sending "
    "them to the AI. Right now it's 5 &mdash; the AI gets the 5 closest matches and picks "
    "the best one. If I set it to 1, only the very top match goes through &mdash; risky if "
    "BM25 narrowly ranks the wrong one first. If I set it to 10, the AI sees too much "
    "noise. 5 is a sensible middle.\"",
    SAY,
))
story.append(Paragraph(
    "<b>One-liner:</b> \"How many search results we hand to the AI before it picks the best one.\"",
    BODY,
))

story.append(Spacer(1, 12))
story.append(Paragraph("min top BM25 score = 2.0", H2))
story.append(Paragraph(
    "Think of it like a spam filter. The filter has to be confident the email is spam "
    "before it deletes anything. Same idea here for medical queries.",
    BODY,
))
story.append(Paragraph(
    "\"This is the off-topic guardrail. Every search gets a confidence score. Real "
    "medical questions score 5 or higher; off-topic stuff like 'what is the capital "
    "of France' scores around 1. I drew the line at 2 &mdash; below that, the system says "
    "'I don't have a good match, I won't answer' instead of guessing. This stops the AI "
    "from making things up for queries that aren't in the rulebook.\"",
    SAY,
))
story.append(Paragraph(
    "<b>One-liner:</b> \"How confident the search has to be before the system answers at all.\"",
    BODY,
))

story.append(PageBreak())


# ─── SECTION 6 — DATA QUESTION ────────────────────────────────────────────
story.extend(section(
    "6.  \"How did you get the data?\"",
    [
        Paragraph(
            "This is the most important question to handle confidently. <b>Don't sound "
            "apologetic.</b> The synthetic-data setup is a normal prototype constraint, "
            "not a flaw.",
            WARN,
        ),
    ],
))

story.append(Paragraph("The simple answer (15 seconds)", H3))
story.append(Paragraph(
    "\"Right now the data is <b>synthetic</b> &mdash; I wrote it myself to look like the real "
    "ACR rulebook. Same structure, same format, plausible recommendations. But it's not "
    "the real licensed ACR content.\"",
    SAY,
))

story.append(Paragraph("If she pushes for more (30 seconds)", H3))
story.append(Paragraph(
    "\"The real ACR Appropriateness Criteria are <b>copyrighted by the American College "
    "of Radiology</b> &mdash; you have to buy a license to use them. That's a paid agreement, "
    "usually institutional. So for the prototype, I created sample data that has exactly "
    "the same shape as the real ACR &mdash; same topics, same variants, same scoring system "
    "from 1 to 9. The clinical patterns are based on standard-of-care knowledge that any "
    "radiologist would broadly recognize, but the <b>exact scores might be a little "
    "different from the real numbers</b>. <br/><br/>"
    "Think of it like building a car: I built the engine and tested it works. The fuel &mdash; "
    "the real ACR data &mdash; is a separate workstream. Once we plug in the licensed data, "
    "everything else stays exactly the same.\"",
    SAY,
))

story.append(Paragraph("If she asks: \"Why didn't you just scrape the ACR website?\"", H3))
story.append(Paragraph(
    "\"Because that would be a <b>copyright violation</b>. The right way is to license it "
    "from the ACR &mdash; that's a separate conversation about budget and institutional approval.\"",
    SAY,
))

story.append(Paragraph("If she asks: \"How do we get the real data, then?\"", H3))
story.append(Paragraph(
    "\"Two paths. One is buying the license directly from ACR &mdash; they publish it. The other "
    "is going through your institution if your hospital already has a license. Do you know "
    "who at your institution would handle that?\"",
    SAY,
))
story.append(Paragraph(
    "<b>Important:</b> the question \"who at your institution handles licensing?\" turns the "
    "data conversation into the most useful next step you can leave the meeting with.",
    TIP,
))

story.append(PageBreak())


# ─── SECTION 7 — OTHER LIKELY QUESTIONS ────────────────────────────────────
story.extend(section(
    "7.  Other likely questions &mdash; quick answers",
    [],
))

likely_qs = [
    (
        "\"Could a radiologist actually trust this output?\"",
        "\"The trust comes from three things: every recommendation includes a citation that "
        "traces back to a real entry in the rulebook; the system refuses to answer when "
        "retrieval confidence is below a threshold; and after the AI generates a response, "
        "I re-validate every citation and strip anything fake. In our 8-scenario evaluation, "
        "<b>citation fidelity is 100%</b> &mdash; zero hallucinated citations.\""
    ),
    (
        "\"What about EHR or PACS integration?\"",
        "\"Out of scope for the prototype. But the API is a clean POST endpoint &mdash; it would "
        "fit behind any UI you'd embed in PACS or call from the EHR. That's an integration "
        "engineering effort, not a re-architecture.\""
    ),
    (
        "\"How long until this could be published?\"",
        "\"The pipeline plus eval is publishable today as a methods or feasibility paper. With "
        "licensed ACR ingestion plus real consult scenarios from your practice as a held-out "
        "test set, it becomes a much stronger publication. That's a 2-3 month workstream.\""
    ),
    (
        "\"Did you write the code yourself, or use AI?\"",
        "\"I built it with Claude Code as a coding assistant &mdash; I directed the architecture, "
        "the algorithm choices, the evaluation design, the safety guardrails. The code is "
        "auditable, tested, and runs locally on my machine.\""
    ),
    (
        "\"What's the failure mode you're most worried about?\"",
        "\"Two things. One is the negation case &mdash; lexical search can't tell 'fever' apart "
        "from 'no fever'. The fix is dense embeddings or LLM-based variant selection, "
        "and the architecture already supports both. Two is data drift &mdash; once the real "
        "ACR rulebook is plugged in, we'd need a process to re-ingest when ACR releases "
        "updates. Both are tractable.\""
    ),
    (
        "\"What if the AI gives a wrong recommendation?\"",
        "\"Two safeguards. First, every recommendation cites a specific rulebook entry &mdash; "
        "the radiologist can verify the source in two seconds. Second, this is a "
        "<b>decision-support</b> tool &mdash; the radiologist makes the final call. The system "
        "narrows and structures the rulebook lookup; it doesn't replace clinical judgment.\""
    ),
]

for q, a in likely_qs:
    story.append(Paragraph(q, H3))
    story.append(Paragraph(a, SAY))

story.append(PageBreak())


# ─── SECTION 8 — CODE WALKTHROUGH ──────────────────────────────────────────
story.extend(section(
    "8.  How to explain the code &mdash; 6 files, in plain English",
    [
        Paragraph(
            "<b>Open only 6 files, in this order. Don't open more &mdash; you'll get lost.</b> "
            "Each file = one concept, one job. Total walk-through should take 5 minutes.",
            TIP,
        ),
        Paragraph("The 6 files, in order:", H3),
        Paragraph("1. The data file &mdash; <font name='Courier'>data/raw/sample_acr_kb.json</font>", BODY),
        Paragraph("2. The schema file &mdash; <font name='Courier'>src/acr_assistant/ingestion/schema.py</font>", BODY),
        Paragraph("3. The search file &mdash; <font name='Courier'>src/acr_assistant/retrieval/retriever.py</font>", BODY),
        Paragraph("4. The prompt file &mdash; <font name='Courier'>src/acr_assistant/generation/prompts.py</font>", BODY),
        Paragraph("5. The safety check &mdash; <font name='Courier'>src/acr_assistant/pipeline.py</font>", BODY),
        Paragraph("6. The eval &mdash; run <font name='Courier'>python eval/run_eval.py</font> in the terminal", BODY),
    ],
))

# File 1
story.append(Paragraph("File 1 &mdash; The data", H2))
story.append(Paragraph(
    "<font name='Courier'>data/raw/sample_acr_kb.json</font> &mdash; "
    "open it and scroll to the \"acr-headache\" topic.",
    BODY,
))
story.append(Paragraph(
    "\"This is the rulebook in JSON format. Five topics, each with sub-cases called variants, "
    "each variant has a list of imaging options scored from 1 to 9. This is the same shape "
    "as the real ACR rulebook &mdash; when we get licensed data, we just swap this one file.\"",
    SAY,
))
story.append(Paragraph(
    "<b>Point at:</b> any procedure with <font name='Courier'>appropriateness: 9</font>.",
    BODY,
))

# File 2
story.append(Paragraph("File 2 &mdash; The schema", H2))
story.append(Paragraph(
    "<font name='Courier'>src/acr_assistant/ingestion/schema.py</font> &mdash; about 40 lines.",
    BODY,
))
story.append(Paragraph(
    "\"Every piece of data passing through the system is type-checked. If someone tries to "
    "add a procedure with a score of 10 or 0, this schema rejects it. Same for missing "
    "fields. Nothing reaches the AI without passing validation first.\"",
    SAY,
))
story.append(Paragraph(
    "<b>Point at:</b> <font name='Courier'>appropriateness: int = Field(ge=1, le=9)</font> &mdash; "
    "that's the score range constraint.",
    BODY,
))

# File 3
story.append(Paragraph("File 3 &mdash; The search", H2))
story.append(Paragraph(
    "<font name='Courier'>src/acr_assistant/retrieval/retriever.py</font> &mdash; "
    "scroll to the <font name='Courier'>retrieve</font> method.",
    BODY,
))
story.append(Paragraph(
    "\"This is the search step. BM25 is a classic search algorithm &mdash; same family as what "
    "powers Elasticsearch. We tokenize the radiologist's query, score every variant in the "
    "rulebook, and return the top 5. The important line is here&hellip;\"",
    SAY,
))
story.append(Paragraph(
    "<b>Point at:</b> <font name='Courier'>if max_score &lt; min_top_score: return []</font>",
    BODY,
))
story.append(Paragraph(
    "\"&hellip;that's the confidence floor. If even the best match doesn't score above 1.5, "
    "we return nothing. The AI never gets called for queries that don't match the rulebook.\"",
    SAY,
))

# File 4
story.append(Paragraph("File 4 &mdash; The prompt", H2))
story.append(Paragraph(
    "<font name='Courier'>src/acr_assistant/generation/prompts.py</font> &mdash; "
    "scroll to <font name='Courier'>SYSTEM_PROMPT</font>.",
    BODY,
))
story.append(Paragraph(
    "\"This is the prompt that binds Claude. Five rules. Read them aloud if you want &mdash; "
    "they're short. Rule 1: only recommend procedures from the retrieved context. Rule 2: "
    "every recommendation must cite a real chunk ID. Rule 3: if no good match, return "
    "INSUFFICIENT_EVIDENCE &mdash; don't guess. Every rule maps to a clinical safety concern.\"",
    SAY,
))
story.append(Paragraph(
    "<b>Point at:</b> the numbered rules.",
    BODY,
))

story.append(PageBreak())

# File 5
story.append(Paragraph("File 5 &mdash; The safety check", H2))
story.append(Paragraph(
    "<font name='Courier'>src/acr_assistant/pipeline.py</font> &mdash; "
    "scroll to <font name='Courier'>_validate_citations</font>.",
    BODY,
))
story.append(Paragraph(
    "\"This is the third safety layer. After Claude returns its answer, this function "
    "checks every citation ID against the actual retrieved chunks. If Claude tries to make "
    "up a citation &mdash; which it shouldn't, because of the prompt &mdash; this strips it "
    "deterministically. Defense in depth: prompt asks the model to behave, validator "
    "enforces it.\"",
    SAY,
))
story.append(Paragraph(
    "<b>Point at:</b> <font name='Courier'>if cid in self._valid_chunk_ids:</font>",
    BODY,
))

# File 6
story.append(Paragraph("File 6 &mdash; The eval (run it live)", H2))
story.append(Paragraph(
    "<b>Don't open the file. Open a terminal and run:</b> "
    "<font name='Courier'>python eval/run_eval.py</font>",
    BODY,
))
story.append(Paragraph(
    "\"This is the evaluation harness. Eight ground-truth scenarios. Five metrics &mdash; the "
    "four from your manuscript plus a top-procedure check. Runs in under a second. These "
    "are the numbers we showed earlier: 100% topic accuracy, 100% citation fidelity, "
    "87.5% variant accuracy.\"",
    SAY,
))
story.append(Paragraph(
    "Live terminal output is more convincing than scrolling through code.",
    TIP,
))

# Tips
story.append(Paragraph("Tips for the code walkthrough", H2))

story.append(Paragraph("DO these", H3))
do_list = [
    "Open files <b>one at a time</b>. Close the previous one before opening the next.",
    "Point at <b>specific lines</b>, not whole files. Say \"this line does X\".",
    "Say <b>\"the important bit is here\"</b> before pointing &mdash; trains her eye.",
    "Use the <b>file tree</b> in VS Code so she sees the structure for free.",
    "Show <b>running code (the eval) instead of reading code</b> when possible.",
]
for d in do_list:
    story.append(Paragraph("&bull; " + d, BODY))

story.append(Paragraph("DON'T do these", H3))
dont_list = [
    "Don't open more than 6 files. You'll lose her.",
    "Don't scroll randomly. Have files pre-open at the right spot.",
    "Don't read code aloud. Describe what it does in plain English.",
    "Don't get into Python syntax debates. Pull her back to \"what it does\".",
    "Don't pretend you typed every keystroke. (See next section.)",
]
for d in dont_list:
    story.append(Paragraph("&bull; " + d, BODY))

story.append(PageBreak())

# Honest answer
story.append(Paragraph("\"Did you write all this code?\" &mdash; the honest answer", H2))
story.append(Paragraph(
    "<b>Don't lie. Don't undersell either.</b> Senior engineers use AI coding tools "
    "constantly now &mdash; pretending otherwise is suspicious.",
    WARN,
))
story.append(Paragraph(
    "\"I built it with <b>Claude Code</b> as a coding assistant &mdash; that's Anthropic's CLI "
    "tool that lets you direct an AI to write code under your supervision. I made the "
    "architecture decisions, picked the algorithms, designed the safety guardrails, set up "
    "the evaluation. The AI did the typing. The code is auditable, tested, and runs locally "
    "on my machine.\"",
    SAY,
))

# When you don't know
story.append(Paragraph("If she asks something you don't know", H2))
story.append(Paragraph(
    "Three safe responses, in order of preference:",
    BODY,
))
story.append(Paragraph(
    "1. <b>\"Let me show you in the code.\"</b> &mdash; pull up the file, find it together. "
    "Often the answer is right there.",
    BODY,
))
story.append(Paragraph(
    "2. <b>\"Great question &mdash; I don't have it memorized. Let me check after the meeting.\"</b> "
    "&mdash; write it down visibly so she sees you'll follow up.",
    BODY,
))
story.append(Paragraph(
    "3. <b>\"I can answer that with the architecture diagram.\"</b> &mdash; pull up the deck, use "
    "the engineering-decisions slide as a recovery point.",
    BODY,
))
story.append(Paragraph(
    "<b>Never say \"I don't know\" without offering a path to find out.</b>",
    WARN,
))

# Escape hatches
story.append(Paragraph("Fallback escape hatches", H2))
story.append(Paragraph(
    "If the code conversation goes sideways, three places to retreat to:",
    BODY,
))
escape_data = [
    ["Live Streamlit demo", "If she's lost in code &mdash; switch to \"let me show you what it does.\""],
    ["Eval terminal output", "If she's skeptical of claims &mdash; run the harness live."],
    ["Deck slide on engineering decisions", "If she asks \"why this and not that\" &mdash; every row has the rationale."],
]
escape_rows = [[Paragraph(f"<b>{a}</b>", BODY), Paragraph(b, BODY)] for a, b in escape_data]
escape_tbl = Table(escape_rows, colWidths=[2.0 * inch, 4.3 * inch])
escape_tbl.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ("TOPPADDING", (0, 0), (-1, -1), 6),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ("BACKGROUND", (0, 0), (0, -1), LIGHT_BG),
    ("LINEBELOW", (0, 0), (-1, -2), 0.4, RULE),
]))
story.append(escape_tbl)

# Mental model
story.append(Paragraph("The simple mental model &mdash; 6 boxes", H2))
story.append(Paragraph(
    "Think of the code as 6 boxes connected by arrows:",
    BODY,
))
story.append(Spacer(1, 6))
boxes_data = [["KB JSON", "Schema", "Retriever", "LLM Prompt", "Validator", "Eval"],
              ["(data)", "(rules)", "(search)", "(constraints)", "(safety)", "(proof)"]]
boxes_tbl = Table(boxes_data, colWidths=[1.05 * inch] * 6)
boxes_tbl.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
    ("BACKGROUND", (0, 1), (-1, 1), LIGHT_BG),
    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Oblique"),
    ("FONTSIZE", (0, 0), (-1, -1), 11),
    ("TOPPADDING", (0, 0), (-1, -1), 10),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ("BOX", (0, 0), (-1, -1), 0.5, RULE),
]))
story.append(boxes_tbl)
story.append(Spacer(1, 8))
story.append(Paragraph(
    "<b>If she points at any file and asks \"what does this do?\":</b> just identify the box. "
    "You don't have to explain the lines &mdash; just the role.",
    SAY,
))
story.append(Paragraph(
    "That's the whole code walkthrough. <b>Five minutes, six files, one mental model.</b>",
    BODY,
))

story.append(PageBreak())


# ─── SECTION 9 — QUICK REFERENCE CARD ──────────────────────────────────────
story.extend(section(
    "9.  Quick reference &mdash; one-line answers",
    [
        Paragraph(
            "If you only have time to remember a few sentences, remember these.",
            BODY,
        ),
    ],
))

ref_data = [
    ["What is this project?",
     "An LLM tool that turns the ACR rulebook into a fast consult-support system with citations."],
    ["How did I build it?",
     "RAG pipeline in Python: knowledge base + BM25 search + Claude with strict citation rules + post-validation."],
    ["Is it RAG?",
     "Yes &mdash; search the rulebook first, then ask the AI using only what we found, then re-check the citations."],
    ["Why RAG?",
     "Cheaper than training, easier to update when the rulebook changes, and citations make the output auditable."],
    ["top-k = 5",
     "How many search results we hand to the AI before it picks the best one."],
    ["min BM25 = 2",
     "How confident the search has to be before the system answers at all."],
    ["Where's the data from?",
     "Synthetic data I wrote that mirrors the real ACR format. Real ACR rulebook is licensed, separate workstream."],
    ["Why not scrape ACR?",
     "Copyright. The right path is licensing &mdash; through ACR directly or through the institution."],
    ["Best numbers from eval",
     "<b>100% topic accuracy, 100% citation fidelity, 87.5% variant accuracy</b> on 8 scenarios."],
    ["The single failure",
     "BM25 can't handle negation (\"no fever\" matches \"fever\") &mdash; fix is dense embeddings."],
    ["Trust story",
     "Every recommendation cites a real rulebook entry; system refuses to answer when confidence is low."],
    ["What I'm asking for",
     "20 real consult scenarios from your practice + your top 5 ACR topics + the licensing pathway."],
]

ref_rows = [[Paragraph(f"<b>{a}</b>", BODY), Paragraph(b, BODY)] for a, b in ref_data]
ref_tbl = Table(ref_rows, colWidths=[1.7 * inch, 4.6 * inch])
ref_tbl.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ("TOPPADDING", (0, 0), (-1, -1), 6),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ("LINEBELOW", (0, 0), (-1, -2), 0.4, RULE),
    ("BACKGROUND", (0, 0), (0, -1), LIGHT_BG),
]))
story.append(ref_tbl)

story.append(Spacer(1, 0.3 * inch))
story.append(Paragraph(
    "<b>Last reminder before you walk in:</b> the synthetic-data disclaimer should come "
    "out of <b>your</b> mouth first &mdash; not hers. Lead with it in the first 60 seconds. "
    "It eliminates the biggest risk in the room.",
    WARN,
))


# ─── BUILD ─────────────────────────────────────────────────────────────────
doc.build(story)
print(f"Cheat sheet PDF written: {out_path}")
