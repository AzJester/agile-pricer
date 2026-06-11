export function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function downloadText(content: string, type: string, filename: string) {
  downloadBlob(new Blob([content], { type }), filename);
}

export function csvCell(v: string | number): string {
  let s = String(v);
  // Excel executes cells starting with = + - @ (or tab/CR-prefixed
  // variants). Free-text fields (milestone names, teaming parties) flow in
  // here, so neutralize with a leading apostrophe — but leave numbers,
  // including stringified negatives like "-42.50", as numbers.
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function csvRows(rows: (string | number)[][]): string {
  // BOM so Excel decodes UTF-8 on double-click; CRLF per RFC 4180.
  return '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
