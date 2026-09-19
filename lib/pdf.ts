// Minimal, dependency-free PDF writer. Supports left-aligned text lines and
// stroked rectangles on a single A4 page — enough for a clean receipt without
// pulling in a PDF library or needing network access to install one.

type PdfLine = { x: number; y: number; size: number; text: string; bold?: boolean }
type PdfRect = { x: number; y: number; w: number; h: number }

function escapeText(text: string) {
  // WinAnsi/Helvetica only reliably covers latin-1; strip anything outside it
  // so the receipt never contains a byte that corrupts the content stream.
  const ascii = text.replace(/[^\x20-\x7e]/g, '?')
  return ascii.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

export function buildReceiptPdf(lines: PdfLine[], rects: PdfRect[] = []): Buffer {
  const contentParts: string[] = []
  for (const line of lines) {
    const font = line.bold ? 'F2' : 'F1'
    contentParts.push(`BT /${font} ${line.size} Tf ${line.x} ${line.y} Td (${escapeText(line.text)}) Tj ET`)
  }
  for (const rect of rects) {
    contentParts.push(`${rect.x} ${rect.y} ${rect.w} ${rect.h} re S`)
  }
  const contentBuffer = Buffer.from(contentParts.join('\n'), 'latin1')

  const chunks: Buffer[] = []
  const offsets: number[] = [0]
  let position = 0

  function push(text: string | Buffer) {
    const buf = typeof text === 'string' ? Buffer.from(text, 'latin1') : text
    chunks.push(buf)
    position += buf.length
  }

  push('%PDF-1.4\n')

  offsets[1] = position
  push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')

  offsets[2] = position
  push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n')

  offsets[3] = position
  push(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ' +
      '/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>\nendobj\n',
  )

  offsets[4] = position
  push(`4 0 obj\n<< /Length ${contentBuffer.length} >>\nstream\n`)
  push(contentBuffer)
  push('\nendstream\nendobj\n')

  offsets[5] = position
  push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n')

  offsets[6] = position
  push('6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n')

  const xrefOffset = position
  let xref = 'xref\n0 7\n0000000000 65535 f \n'
  for (let i = 1; i <= 6; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  push(xref)
  push(`trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`)

  return Buffer.concat(chunks)
}

type PdfPage = { lines: PdfLine[]; rects?: PdfRect[] }

// Generalized multi-page version of buildReceiptPdf — used by reports, which
// can run to many rows and need to spill onto additional A4 pages while still
// sharing the same two Helvetica font resources.
export function buildMultiPagePdf(pages: PdfPage[]): Buffer {
  const pageCount = Math.max(1, pages.length)
  const safePages = pages.length > 0 ? pages : [{ lines: [], rects: [] }]

  // Object numbering: 1=Catalog, 2=Pages, then for each page a (Page, Contents)
  // pair, then two shared Font objects at the end.
  const fontObjNum = 3 + pageCount * 2
  const boldFontObjNum = fontObjNum + 1
  const pageObjNum = (i: number) => 3 + i * 2
  const contentObjNum = (i: number) => 4 + i * 2

  const chunks: Buffer[] = []
  const offsets = new Map<number, number>()
  let position = 0

  function push(text: string | Buffer) {
    const buf = typeof text === 'string' ? Buffer.from(text, 'latin1') : text
    chunks.push(buf)
    position += buf.length
  }
  function setOffset(objNum: number) {
    offsets.set(objNum, position)
  }

  push('%PDF-1.4\n')

  setOffset(1)
  const kids = safePages.map((_, i) => `${pageObjNum(i)} 0 R`).join(' ')
  push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`)

  setOffset(2)
  push(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${safePages.length} >>\nendobj\n`)

  safePages.forEach((page, i) => {
    const contentParts: string[] = []
    for (const line of page.lines) {
      const font = line.bold ? 'F2' : 'F1'
      contentParts.push(`BT /${font} ${line.size} Tf ${line.x} ${line.y} Td (${escapeText(line.text)}) Tj ET`)
    }
    for (const rect of page.rects ?? []) {
      contentParts.push(`${rect.x} ${rect.y} ${rect.w} ${rect.h} re S`)
    }
    const contentBuffer = Buffer.from(contentParts.join('\n'), 'latin1')

    setOffset(pageObjNum(i))
    push(
      `${pageObjNum(i)} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ` +
        `/Resources << /Font << /F1 ${fontObjNum} 0 R /F2 ${boldFontObjNum} 0 R >> >> /Contents ${contentObjNum(i)} 0 R >>\nendobj\n`,
    )

    setOffset(contentObjNum(i))
    push(`${contentObjNum(i)} 0 obj\n<< /Length ${contentBuffer.length} >>\nstream\n`)
    push(contentBuffer)
    push('\nendstream\nendobj\n')
  })

  setOffset(fontObjNum)
  push(`${fontObjNum} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`)

  setOffset(boldFontObjNum)
  push(`${boldFontObjNum} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`)

  const totalObjects = boldFontObjNum
  const xrefOffset = position
  let xref = `xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`
  for (let n = 1; n <= totalObjects; n++) {
    xref += `${String(offsets.get(n) ?? 0).padStart(10, '0')} 00000 n \n`
  }
  push(xref)
  push(`trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`)

  return Buffer.concat(chunks)
}

const REPORT_PAGE_TOP = 792
const REPORT_PAGE_BOTTOM = 40
const REPORT_MARGIN_X = 40

export function generateReportPdf(opts: {
  academyName: string
  reportTitle: string
  periodLabel: string
  generatedAt: Date
  summaryLines: string[]
  columns: string[]
  colWidths: number[]
  rows: string[][]
}): Buffer {
  const pages: PdfPage[] = []
  let currentLines: PdfLine[] = []
  let y = REPORT_PAGE_TOP

  function newPage() {
    if (currentLines.length > 0) pages.push({ lines: currentLines })
    currentLines = []
    y = REPORT_PAGE_TOP
  }
  function add(text: string, size: number, bold = false, gap = 16, x = REPORT_MARGIN_X) {
    if (y < REPORT_PAGE_BOTTOM) newPage()
    currentLines.push({ x, y, size, text, bold })
    y -= gap
  }
  function addRow(cells: string[], bold = false) {
    if (y < REPORT_PAGE_BOTTOM) { newPage(); addColumnHeader() }
    let x = REPORT_MARGIN_X
    cells.forEach((cell, i) => {
      currentLines.push({ x, y, size: 9, text: cell, bold })
      x += opts.colWidths[i] ?? 100
    })
    y -= 15
  }
  function addColumnHeader() {
    addRow(opts.columns, true)
    y -= 2
  }

  add(opts.academyName, 18, true, 26)
  add(opts.reportTitle, 14, true, 20)
  add(`Period: ${opts.periodLabel}`, 10, false, 14)
  add(`Generated: ${opts.generatedAt.toLocaleString('en-US')}`, 9, false, 22)

  if (opts.summaryLines.length > 0) {
    add('Summary', 11, true, 16)
    for (const line of opts.summaryLines) add(line, 10, false, 14)
    y -= 8
  }

  if (opts.rows.length > 0) {
    addColumnHeader()
    for (const row of opts.rows) addRow(row)
  } else {
    add('No records for this period.', 10, false, 14)
  }

  newPage()
  return buildMultiPagePdf(pages)
}

export function generateReceiptPdf(opts: {
  academyName: string
  receiptNumber: string
  paidAt: Date
  studentName: string
  className: string
  parentName: string
  month: string
  paymentMethod: string
  amountPaid: number
  invoiceAmountDue: number
  invoiceAmountPaidTotal: number
  invoiceBalance: number
  recordedByName: string
}) {
  const money = (n: number) => `Rs ${Math.round(n).toLocaleString('en-US')}`
  const methodLabel = opts.paymentMethod
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ')

  let y = 780
  const lines: PdfLine[] = []
  const add = (text: string, size: number, bold = false, gap = 20) => {
    lines.push({ x: 50, y, size, text, bold })
    y -= gap
  }

  add(opts.academyName, 20, true, 30)
  add('Fee Payment Receipt', 14, true, 28)

  add(`Receipt No:      ${opts.receiptNumber}`, 11, false, 18)
  add(`Date:            ${opts.paidAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 11, false, 26)

  add(`Student:         ${opts.studentName}`, 12, false, 18)
  add(`Class:           ${opts.className}`, 12, false, 18)
  add(`Parent/Guardian: ${opts.parentName}`, 12, false, 18)
  add(`Fee month:       ${opts.month}`, 12, false, 26)

  add(`Payment method:  ${methodLabel}`, 12, false, 18)
  add(`Recorded by:     ${opts.recordedByName}`, 12, false, 30)

  add(`Amount paid:     ${money(opts.amountPaid)}`, 14, true, 24)

  add(`Invoice total:   ${money(opts.invoiceAmountDue)}`, 10, false, 15)
  add(`Total paid:      ${money(opts.invoiceAmountPaidTotal)}`, 10, false, 15)
  add(`Balance:         ${opts.invoiceBalance > 0 ? money(opts.invoiceBalance) : 'Fully paid'}`, 10, false, 40)

  add('Thank you for your payment.', 10, false, 14)
  add('This is a computer-generated receipt.', 9, false, 14)

  const rects: PdfRect[] = [{ x: 40, y: y - 10, w: 515, h: 780 - y + 30 }]

  return buildReceiptPdf(lines, rects)
}
