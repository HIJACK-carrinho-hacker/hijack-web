export type Cell = string | number | boolean | null;

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function csvCell(value: Cell): string {
  if (value === null) return "";
  let s = String(value);
  if (typeof value === "string" && FORMULA_PREFIX.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(columns: readonly string[], rows: readonly Record<string, Cell>[]): string {
  const lines = [columns.join(",")];
  for (const row of rows) lines.push(columns.map((c) => csvCell(row[c] ?? null)).join(","));
  return `${lines.join("\r\n")}\r\n`;
}
