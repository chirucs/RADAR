// IEEE conference template helpers (IEEEtran-style).
// Strict IEEE conference paper format:
//   - US Letter, IEEE conference margins (top 0.75", bottom 1", L/R 0.625")
//   - Two-column body with 0.25" gutter
//   - Title block spans both columns (separate single-column section)
//   - 10pt Times Roman body, justified
//   - 24pt bold title, centered
//   - "Abstract—" bold, body italic 9pt
//   - Roman numeral sections, centered, small caps, 10pt bold
//   - Italic letter subsections (A., B.)
//   - IEEE-style 8pt references, hanging indent
//
// Built on docx-js. Document is constructed with two sections:
//   Section 1 (single-col): title + author block
//   Section 2 (two-col):    abstract, index terms, body, references

const docx = require('docx');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageOrientation, SectionType,
} = docx;

// IEEE conference page geometry (US Letter, 0.75" top, 1" bottom, 0.625" L/R)
// In DXA (1440 = 1 inch)
const PAGE = {
  width: 12240,         // 8.5"
  height: 15840,        // 11"
  margin: {
    top: 1080,          // 0.75"
    bottom: 1440,       // 1.00"
    left: 900,          // 0.625"
    right: 900,         // 0.625"
  },
};
const CONTENT_WIDTH_FULL = PAGE.width - PAGE.margin.left - PAGE.margin.right; // 10440 dxa = 7.25"
const COLUMN_GUTTER = 360; // 0.25"
const COL_WIDTH = (CONTENT_WIDTH_FULL - COLUMN_GUTTER) / 2; // ~5040 dxa per column

// IEEE styles
function buildStyles() {
  return {
    default: { document: { run: { font: 'Times New Roman', size: 20 } } }, // 10pt body
    paragraphStyles: [
      // Title — 24pt bold, centered, mixed-case
      { id: 'IEEETitle', name: 'IEEE Title', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 48, bold: true, font: 'Times New Roman' },
        paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 240, line: 280 } } },
      // Authors — 11pt regular, centered
      { id: 'IEEEAuthor', name: 'IEEE Author', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 22, font: 'Times New Roman' },
        paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 80, after: 80, line: 240 } } },
      // Section heading — 10pt bold, centered, small caps; "I.", "II." prefix
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 20, bold: true, smallCaps: true, font: 'Times New Roman' },
        paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 200, after: 100, line: 240 }, outlineLevel: 0 } },
      // Subsection — 10pt italic, left
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 20, italics: true, font: 'Times New Roman' },
        paragraph: { spacing: { before: 140, after: 60, line: 240 }, outlineLevel: 1 } },
      // Caption — 8pt centered (figures and tables)
      { id: 'IEEECaption', name: 'IEEE Caption', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 16, font: 'Times New Roman' },
        paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 60, after: 160, line: 220 } } },
    ],
  };
}

const numberingConfig = {
  config: [
    { reference: 'bullets', levels: [
      { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 360, hanging: 200 } } } },
    ]},
    { reference: 'enum', levels: [
      { level: 0, format: LevelFormat.DECIMAL, text: '%1)', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 360, hanging: 200 } } } },
    ]},
  ],
};

// ----------------- Convenience constructors (IEEE-tuned sizes) -----------------

// Title — 24pt bold, centered
function Title(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 240, line: 280 },
    children: [new TextRun({ text, bold: true, size: 48, font: 'Times New Roman' })],
  });
}

// Author block lines — 11pt centered.  Pass an array of lines.
function AuthorBlock(lines) {
  return lines.map(line => new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 60, line: 240 },
    children: [new TextRun({ text: line, size: 22, italics: false, font: 'Times New Roman' })],
  }));
}

// Body paragraph — 10pt justified, with an indent on the first line
function P(text, opts = {}) {
  const runs = (typeof text === 'string')
    ? [new TextRun({ text, size: 20, font: 'Times New Roman' })]
    : text;
  return new Paragraph({
    alignment: opts.align || AlignmentType.JUSTIFIED,
    spacing: { before: opts.before || 0, after: opts.after || 80, line: 240 },
    indent: opts.firstLine !== false ? { firstLine: 200 } : undefined, // 0.14" indent
    children: runs,
  });
}

// Section heading — Roman numeral, centered, small caps.  Pass "I", "II", etc.
function H1(roman, text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 80, line: 240 },
    children: [new TextRun({ text: `${roman}. ${text}`, bold: true, smallCaps: true, size: 20, font: 'Times New Roman' })],
  });
}

// Subsection — italic, left-aligned, "A. text" form
function H2(letter, text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 120, after: 40, line: 240 },
    children: [new TextRun({ text: `${letter}. ${text}`, italics: true, size: 20, font: 'Times New Roman' })],
  });
}

// Abstract — "Abstract—" bold, then italic body, 9pt
function Abstract(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: 0, after: 120, line: 220 },
    indent: { firstLine: 200 },
    children: [
      new TextRun({ text: 'Abstract—', bold: true, italics: true, size: 18, font: 'Times New Roman' }),
      new TextRun({ text, italics: true, size: 18, font: 'Times New Roman' }),
    ],
  });
}

// Index terms — same shape as abstract
function IndexTerms(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: 0, after: 200, line: 220 },
    indent: { firstLine: 200 },
    children: [
      new TextRun({ text: 'Index Terms—', bold: true, italics: true, size: 18, font: 'Times New Roman' }),
      new TextRun({ text, italics: true, size: 18, font: 'Times New Roman' }),
    ],
  });
}

// Numbered list item ("1)", "2)")
function Numbered(text) {
  return new Paragraph({
    numbering: { reference: 'enum', level: 0 },
    spacing: { before: 0, after: 60, line: 240 },
    children: [new TextRun({ text, size: 20, font: 'Times New Roman' })],
  });
}

function Bullet(text) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { before: 0, after: 60, line: 240 },
    children: [new TextRun({ text, size: 20, font: 'Times New Roman' })],
  });
}

// Monospace block — for code / pseudo-architecture diagrams. 8pt mono, indented.
function Mono(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 60, after: 100, line: 220 },
    indent: { left: 200 },
    children: [new TextRun({ text, font: 'Consolas', size: 16 })],
  });
}

// Caption — 8pt centered, italic
function Caption(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 40, after: 160, line: 220 },
    children: [new TextRun({ text, italics: true, size: 16, font: 'Times New Roman' })],
  });
}

// ----------------- Tables (IEEE: 8pt, single-line borders, head shaded) -----------------

const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

function tableHeaderCell(text, width, opts = {}) {
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: 'E5E5E5', type: ShadingType.CLEAR, color: 'auto' },
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [new Paragraph({
      alignment: opts.align || AlignmentType.CENTER,
      spacing: { before: 0, after: 0 },
      children: [new TextRun({ text, bold: true, size: 16, font: 'Times New Roman' })],
    })],
  });
}

function tableCell(text, width, opts = {}) {
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    margins: { top: 30, bottom: 30, left: 80, right: 80 },
    children: [new Paragraph({
      alignment: opts.align || AlignmentType.LEFT,
      spacing: { before: 0, after: 0 },
      children: [new TextRun({ text, size: 16, font: opts.mono ? 'Consolas' : 'Times New Roman' })],
    })],
  });
}

function table(rows, columnWidths) {
  return new Table({
    width: { size: columnWidths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths,
    rows,
  });
}

// ----------------- References — 8pt hanging indent -----------------

function refsHeading() {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 80, line: 240 },
    children: [new TextRun({ text: 'References', bold: true, smallCaps: true, size: 20, font: 'Times New Roman' })],
  });
}

function refLine(num, text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: 0, after: 50, line: 200 },
    indent: { left: 240, hanging: 240 },
    children: [new TextRun({ text: `[${num}] ${text}`, size: 16, font: 'Times New Roman' })],
  });
}

// ----------------- Section builders -----------------

// IEEE single-column section for the title block (continuous so the next
// two-column section flows on the same page).
function buildTitleSection(children) {
  return {
    properties: {
      page: { size: { width: PAGE.width, height: PAGE.height }, margin: PAGE.margin },
      type: SectionType.CONTINUOUS,
      column: { count: 1, space: COLUMN_GUTTER, equalWidth: true, separate: false },
    },
    children,
  };
}

// IEEE two-column body section.  Continuous so it follows the title section
// on the same page.
function buildBodySection(children) {
  return {
    properties: {
      page: { size: { width: PAGE.width, height: PAGE.height }, margin: PAGE.margin },
      type: SectionType.CONTINUOUS,
      column: { count: 2, space: COLUMN_GUTTER, equalWidth: true, separate: false },
    },
    children,
  };
}

module.exports = {
  docx,
  PAGE, CONTENT_WIDTH_FULL, COL_WIDTH,
  buildStyles, numberingConfig,
  Title, AuthorBlock, P, H1, H2, Abstract, IndexTerms, Numbered, Bullet, Mono, Caption,
  table, tableHeaderCell, tableCell,
  refsHeading, refLine,
  buildTitleSection, buildBodySection,
};
