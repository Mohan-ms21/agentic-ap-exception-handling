// Minimal RFC 4180 CSV parser: quoted fields, escaped quotes (""), commas
// and newlines inside quotes, CRLF or LF line endings. No dependencies so
// the generator script and the drift test share exactly one parser.

/**
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (inQuotes) throw new Error("CSV ends inside a quoted field");
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop blank lines (e.g. a trailing newline).
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

/**
 * Maps rows to objects keyed by the header row. Every cell stays a string,
 * exactly as it appears in the file.
 * @param {string} text
 * @returns {Record<string, string>[]}
 */
export function parseCsvRecords(text) {
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  return rows.map((cells, index) => {
    if (cells.length !== header.length) {
      throw new Error(
        `CSV row ${index + 2} has ${cells.length} cells; header has ${header.length}`,
      );
    }
    return Object.fromEntries(header.map((name, i) => [name, cells[i]]));
  });
}
