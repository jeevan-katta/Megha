import { ButtonLink } from '@/components/ui/button-link';
import { Heading } from '@/components/ui/section-heading';
import { OrderList } from '@/features/orders/order-list';
import type { Order } from '@megha/types';
import { ArrowRight, Clock, PackageCheck, ShoppingBag, Wrench } from 'lucide-react';
export function AccountDashboard({ orders }: { orders: Order[] }) {
  const stats = [
    ['Total Orders', orders.length, ShoppingBag],
    ['Pending Orders', orders.filter((order) => order.status === 'PENDING_PAYMENT').length, Clock],
    ['Delivered', orders.filter((order) => order.status === 'DELIVERED').length, PackageCheck],
  ] as const;
  return (
    <>
      <div className="stat-grid">
        {stats.map(([label, value, Icon]) => (
          <div className="panel stat-card" key={label}>
            <Icon />
            <span>
              {label}
              <strong>{value}</strong>
            </span>
          </div>
        ))}
      </div>
      <div className="panel">
        <Heading title="Recent Orders" href="/account/orders" />
        <OrderList orders={orders.slice(0, 4)} />
      </div>
      <div className="find-banner account-banner">
        <Wrench size={40} />
        <div>
          <h2>Need Service or Installation?</h2>
          <p>Request support for your laundry equipment.</p>
        </div>
        <ButtonLink href="/services" secondary>
          Request Service <ArrowRight size={16} />
        </ButtonLink>
      </div>
    </>
  );
}
