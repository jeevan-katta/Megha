/** Match only reads affected by a successful write. Validation POSTs never invalidate reads. */
export function affectedByMutation(path: string, key: readonly unknown[]) {
  if (key[0] !== 'private') return false;
  if (path === '/checkout/validate') return false;
  if (path.startsWith('/admin/')) {
    const module = path.split('/')[2];
    const related: Record<string, string[]> = {
      products: ['inventory', 'lookups', 'reports'],
      inventory: ['products', 'lookups', 'reports'],
      categories: ['lookups'],
      machines: ['lookups'],
      users: ['customers', 'technicians', 'lookups', 'reports'],
      customers: ['users', 'lookups', 'reports'],
      technicians: ['users', 'lookups', 'reports'],
      orders: ['payments', 'shipments', 'inventory', 'products', 'reports'],
      payments: ['orders', 'shipments', 'inventory', 'products', 'reports'],
    };
    if (key[2] === 'account') {
      return ['orders', 'payments', 'shipments'].includes(module)
        ? key[3] === 'orders'
        : key[3] === 'records/' + module;
    }
    return (
      key[2] === 'admin' &&
      new Set([module, 'audit', ...(related[module] ?? ['reports'])]).has(String(key[3]))
    );
  }
  if (path.startsWith('/me/notifications'))
    return key[2] === 'account' && key[3] === 'records/notifications';
  if (path.startsWith('/me/records/')) {
    const kind = path.split('/')[3];
    // DELETE /me/records/:id cannot identify the record kind; refresh personal lists only.
    return (
      key[2] === 'account' &&
      String(key[3]).startsWith('records/') &&
      (/^[a-f\d]{24}$/i.test(kind) || key[3] === 'records/' + kind)
    );
  }
  if (path.startsWith('/orders') || path.startsWith('/payments')) {
    return (
      (key[2] === 'account' && key[3] === 'orders') ||
      (key[2] === 'admin' &&
        ['orders', 'payments', 'shipments', 'inventory', 'products', 'reports'].includes(
          String(key[3]),
        ))
    );
  }
  if (path.startsWith('/requests/')) {
    const kind = path.split('/')[2];
    return key[2] === 'account'
      ? key[3] === 'records/' + kind
      : [kind, 'reports', 'audit'].includes(String(key[3]));
  }
  return false;
}
