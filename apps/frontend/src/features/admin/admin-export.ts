import type { AdminRow } from './admin-config';
/** Export only the loaded page. Prevent spreadsheet formula execution. */
export function exportRows(module: string, rows: AdminRow[]) {
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))].filter(
    (key) => !['__v', 'idempotencyKey'].includes(key),
  );
  const cell = (value: unknown) => {
    let text =
      value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  const csv = [keys, ...rows.map((row) => keys.map((key) => row[key]))]
    .map((row) => row.map(cell).join(','))
    .join('\r\n');
  const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'megha-' + module + '.csv';
  link.click();
  URL.revokeObjectURL(url);
}
