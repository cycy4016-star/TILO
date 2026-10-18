// Spreadsheet serializers for the operator's investor-ready exports.
//
// Pure string builders — no I/O — so unit tests can pin the CSV quoting rules:
//   • CSV is RFC-4180 (CRLF, quotes doubled) and carries a UTF-8 BOM so Excel
//     and LibreOffice open it in the right encoding.
//   • "XLS" is an HTML table served with an .xls extension and the MS-Excel
//     MIME type — the oldest trick Excel still honours, so operators get a
//     true spreadsheet without pulling in a worksheet-writer dependency.

export type ExportCell = string | number | null;
export type ExportSheet = {
  title: string;
  generatedAt: Date;
  headers: string[];
  rows: ExportCell[][];
};

function csvCell(value: ExportCell): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function sheetToCsv(sheet: ExportSheet): string {
  const lines = [sheet.headers.map(csvCell).join(',')];
  for (const row of sheet.rows) lines.push(row.map(csvCell).join(','));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

function escapeHtml(value: ExportCell): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function sheetToXls(sheet: ExportSheet): string {
  const head = sheet.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('');
  const body = sheet.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
    .join('');
  return [
    '<html xmlns:x="urn:schemas-microsoft-com:office:excel">',
    '<head><meta charset="utf-8">',
    `<title>${escapeHtml(sheet.title)}</title>`,
    '<style>th{background:#111;color:#fff;font-weight:bold;text-align:left}td,th{border:1px solid #999;padding:4px 8px;font-family:monospace}</style>',
    '</head><body>',
    `<h2>${escapeHtml(sheet.title)}</h2>`,
    `<p>Generated ${escapeHtml(sheet.generatedAt.toISOString())} · Tilza platform</p>`,
    `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`,
    '</body></html>',
  ].join('');
}
