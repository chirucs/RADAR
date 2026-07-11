// Shared docx-js styling helpers and convenience constructors.
const docx = require('docx');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType,
  ShadingType, TabStopType, TabStopPosition, PageNumber, Header, Footer,
  PageOrientation,
} = docx;

// Page geometry — US Letter, 1-inch margins
const PAGE = {
  width: 12240,
  height: 15840,
  margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
};
const CONTENT_WIDTH = 9360;

// Style/document defaults
function buildStyles() {
  return {
    default: { document: { run: { font: 'Times New Roman', size: 22 } } }, // 11pt body
    paragraphStyles: [
      { id: 'Title', name: 'Title', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 36, bold: true, font: 'Times New Roman' },
        paragraph: { spacing: { before: 0, after: 240 }, alignment: AlignmentType.CENTER } },
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, font: 'Times New Roman' },
        paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 24, bold: true, italics: true, font: 'Times New Roman' },
        paragraph: { spacing: { before: 220, after: 100 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 22, bold: true, font: 'Times New Roman' },
        paragraph: { spacing: { before: 180, after: 80 }, outlineLevel: 2 } },
      { id: 'Caption', name: 'Caption', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 20, italics: true, font: 'Times New Roman' },
        paragraph: { spacing: { before: 60, after: 180 }, alignment: AlignmentType.CENTER } },
    ],
  };
}

const numberingConfig = {
  config: [
    { reference: 'bullets', levels: [
      { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 540, hanging: 270 } } } },
    ]},
    { reference: 'enum', levels: [
      { level: 0, format: LevelFormat.DECIMAL, text: '%1)', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 540, hanging: 270 } } } },
    ]},
  ],
};

// --- Convenience constructors ---

function P(text, opts = {}) {
  if (typeof text === 'string') {
    return new Paragraph({
      alignment: opts.align || AlignmentType.JUSTIFIED,
      spacing: { before: opts.before || 0, after: opts.after || 100, line: 280 },
      indent: opts.indent ? { firstLine: 360 } : undefined,
      children: [new TextRun({ text, font: 'Times New Roman', size: 22 })],
    });
  }
  // text is array of TextRun
  return new Paragraph({
    alignment: opts.align || AlignmentType.JUSTIFIED,
    spacing: { before: opts.before || 0, after: opts.after || 100, line: 280 },
    indent: opts.indent ? { firstLine: 360 } : undefined,
    children: text,
  });
}

function H1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, bold: true, size: 26, font: 'Times New Roman' })],
  });
}

function H2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, bold: true, italics: true, size: 24, font: 'Times New Roman' })],
  });
}

function H3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [new TextRun({ text, bold: true, size: 22, font: 'Times New Roman' })],
  });
}

function Title(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 240, line: 320 },
    children: [new TextRun({ text, bold: true, size: 36, font: 'Times New Roman' })],
  });
}

function Subtitle(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 360, line: 280 },
    children: [new TextRun({ text, italics: true, size: 24, font: 'Times New Roman' })],
  });
}

function Caption(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 200, line: 240 },
    children: [new TextRun({ text, italics: true, size: 20, font: 'Times New Roman' })],
  });
}

function Bullet(text) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { before: 0, after: 80, line: 280 },
    children: [new TextRun({ text, font: 'Times New Roman', size: 22 })],
  });
}

function Numbered(text) {
  return new Paragraph({
    numbering: { reference: 'enum', level: 0 },
    spacing: { before: 0, after: 80, line: 280 },
    children: [new TextRun({ text, font: 'Times New Roman', size: 22 })],
  });
}

function Mono(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: opts.before || 80, after: opts.after || 120, line: 260 },
    indent: { left: 360 },
    children: [new TextRun({ text, font: 'Consolas', size: 18 })],
  });
}

function Abstract(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: 80, after: 240, line: 280 },
    indent: { left: 360, right: 360 },
    children: [
      new TextRun({ text: 'Abstract—', bold: true, size: 22, font: 'Times New Roman' }),
      new TextRun({ text, size: 22, font: 'Times New Roman' }),
    ],
  });
}

function Keywords(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: 0, after: 240, line: 280 },
    indent: { left: 360, right: 360 },
    children: [
      new TextRun({ text: 'Index Terms—', bold: true, italics: true, size: 22, font: 'Times New Roman' }),
      new TextRun({ text, italics: true, size: 22, font: 'Times New Roman' }),
    ],
  });
}

// --- Table helpers ---

const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: '888888' };
const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

function tableHeaderCell(text, width, opts = {}) {
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: 'D9E2F3', type: ShadingType.CLEAR, color: 'auto' },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({
      alignment: opts.align || AlignmentType.CENTER,
      spacing: { before: 0, after: 0 },
      children: [new TextRun({ text, bold: true, size: 20, font: 'Times New Roman' })],
    })],
  });
}

function tableCell(text, width, opts = {}) {
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
    children: [new Paragraph({
      alignment: opts.align || AlignmentType.LEFT,
      spacing: { before: 0, after: 0 },
      children: [new TextRun({ text, size: 20, font: opts.mono ? 'Consolas' : 'Times New Roman' })],
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

// --- References section builder ---

function refsHeading() { return H1('References'); }
function refLine(num, text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: 0, after: 80, line: 240 },
    indent: { left: 360, hanging: 360 },
    children: [new TextRun({ text: `[${num}] ${text}`, size: 20, font: 'Times New Roman' })],
  });
}

function buildSection(children) {
  return {
    properties: { page: { size: { width: PAGE.width, height: PAGE.height }, margin: PAGE.margin } },
    children,
  };
}

module.exports = {
  docx,
  PAGE, CONTENT_WIDTH,
  buildStyles, numberingConfig,
  P, H1, H2, H3, Title, Subtitle, Caption, Bullet, Numbered, Mono,
  Abstract, Keywords,
  tableHeaderCell, tableCell, table,
  refsHeading, refLine,
  buildSection,
};
