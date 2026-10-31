'use client';

import { Empty } from '@/components/ui/empty-state';
import { Img } from '@/components/ui/image';
import { money } from '@/lib/format';
import { type Order } from '@megha/types';
import Link from 'next/link';
import { useState } from 'react';
import { deliveryText, orderStatusText, paymentStatusText } from './order-status';

const filters = {
  all: () => true,
  active: (order: Order) =>
    !['DELIVERED', 'CANCELLED', 'RETURNED', 'REFUNDED'].includes(order.status),
  delivered: (order: Order) => order.status === 'DELIVERED',
  closed: (order: Order) =>
    [
      'CANCELLED',
      'RETURN_REQUESTED',
      'RETURNED',
      'REFUND_PENDING',
      'PARTIALLY_REFUNDED',
      'REFUNDED',
    ].includes(order.status),
};
const filterLabels: Record<keyof typeof filters, string> = {
  all: 'All',
  active: 'Active',
  delivered: 'Delivered',
  closed: 'Cancelled / Returned',
};

export function OrderList({
  orders,
  showFilters = false,
}: {
  orders: Order[];
  showFilters?: boolean;
}) {
  const [filter, setFilter] = useState<keyof typeof filters>('all');
  const visible = orders.filter(filters[filter]);
  if (!orders.length)
    return <Empty title="No orders yet" href="/spare-parts" label="Browse Spare Parts" />;
  return (
    <div>
      {showFilters && (
        <div className="order-filters" role="tablist" aria-label="Filter orders">
          {(Object.keys(filters) as (keyof typeof filters)[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              onClick={() => setFilter(key)}
            >
              {filterLabels[key]}
            </button>
          ))}
        </div>
      )}
      {visible.length ? (
        visible.map((order) => (
          <div className="order-row" key={order._id}>
            <div className="order-thumbs">
              {order.items.slice(0, 3).map((item) => (
                <Img
                  key={item.productId}
                  src={item.image || '/assets/part-0.webp'}
                  alt={item.name}
                />
              ))}
            </div>
            <div className="order-row-main">
              <strong>#{order.number}</strong>
              <small>
                {new Date(order.createdAt).toLocaleDateString('en-IN')} · {order.items.length} item
                {order.items.length === 1 ? '' : 's'}
              </small>
            </div>
            <div className="order-row-status">
              <span className="badge">{orderStatusText[order.status] ?? order.status}</span>
              <small>
                {paymentStatusText[order.paymentStatus] ?? order.paymentStatus} ·{' '}
                {deliveryText(order)}
              </small>
            </div>
            <strong className="order-row-total">{money(order.total)}</strong>
            <div className="order-row-actions">
              <Link href={'/order/success/' + order._id}>View</Link>
              {!['PENDING_PAYMENT', 'CANCELLED'].includes(order.status) && (
                <Link href={'/track/' + order.number}>Track</Link>
              )}
            </div>
          </div>
        ))
      ) : (
        <p className="muted">No orders in this view.</p>
      )}
    </div>
  );
}
