type Filter = Record<string, unknown>;
const available = { $subtract: [{ $ifNull: ['$stock', 0] }, { $ifNull: ['$reserved', 0] }] };
const limit = { $ifNull: ['$threshold', 5] };
/** Stock expressions shared by the inventory list tabs and the dashboard, so counts match. */
export const stockFields = { available, limit };
/** Inventory list tabs: active products running low or with nothing left to sell. */
export const inventoryViews: Record<string, () => Filter> = {
  low: () => ({
    active: true,
    $expr: { $and: [{ $gt: [available, 0] }, { $lte: [available, limit] }] },
  }),
  out: () => ({ active: true, $expr: { $lte: [available, 0] } }),
};
