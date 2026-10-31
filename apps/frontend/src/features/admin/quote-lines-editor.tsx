'use client';
import { money } from '@/lib/format';
export type QuoteLine = {
  description: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
};
export function QuoteLinesEditor({
  lines,
  setLines,
}: {
  lines: QuoteLine[];
  setLines: (lines: QuoteLine[]) => void;
}) {
  const total = lines.reduce((sum, line) => {
    const base = line.quantity * line.unitPrice;
    return sum + base + Math.round((base * line.gstRate) / 100);
  }, 0);
  function change(index: number, patch: Partial<QuoteLine>) {
    setLines(lines.map((line, position) => (position === index ? { ...line, ...patch } : line)));
  }
  return (
    <fieldset className="quote-editor">
      <legend>Quotation line items</legend>
      {lines.map((line, index) => (
        <div className="quote-line" key={index}>
          <label>
            Description
            <input
              value={line.description}
              required
              minLength={2}
              onChange={(event) => change(index, { description: event.target.value })}
            />
          </label>
          <label>
            Qty
            <input
              type="number"
              min={1}
              max={10000}
              required
              value={line.quantity}
              onChange={(event) => change(index, { quantity: Number(event.target.value) })}
            />
          </label>
          <label>
            Unit price (₹)
            <input
              type="number"
              min={0}
              step="0.01"
              required
              value={line.unitPrice / 100}
              onChange={(event) =>
                change(index, { unitPrice: Math.round(Number(event.target.value) * 100) })
              }
            />
          </label>
          <label>
            GST %
            <input
              type="number"
              min={0}
              max={100}
              required
              value={line.gstRate}
              onChange={(event) => change(index, { gstRate: Number(event.target.value) })}
            />
          </label>
          <button
            type="button"
            className="secondary"
            onClick={() => setLines(lines.filter((_, position) => position !== index))}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="secondary"
        onClick={() =>
          setLines([...lines, { description: '', quantity: 1, unitPrice: 0, gstRate: 18 }])
        }
      >
        Add Line Item
      </button>
      <strong>Total incl. GST: {money(total)}</strong>
    </fieldset>
  );
}
