'use client';

import { money } from '@/lib/format';
import { type Totals } from '@megha/types';

export function Summary({ totals }: { totals: Totals | null }) {
  const quoted = totals?.shippingQuoted !== false;
  return (
    <div className="panel order-summary">
      <h2>Order Summary</h2>
      <div>
        <span>Subtotal</span>
        <strong>{money(totals?.subtotal || 0)}</strong>
      </div>
      <div>
        <span>
          Shipping
          {totals?.shippingService?.label ? ' · ' + totals.shippingService.label : ''}
        </span>
        <strong>{quoted ? money(totals?.shipping || 0) : 'At checkout'}</strong>
      </div>
      <div>
        <span>GST</span>
        <strong>{money(totals?.tax || 0)}</strong>
      </div>
      <div className="summary-total">
        <strong>{quoted ? 'Total Amount' : 'Total before shipping'}</strong>
        <strong>{money(totals?.total || 0)}</strong>
      </div>
    </div>
  );
}
