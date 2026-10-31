import { Order } from './order.model';
export const orderRepository = {
  byCustomer: (userId: string) =>
    Order.find(
      { userId },
      {
        idempotencyKey: 0,
        requestFingerprint: 0,
        history: 0,
        providerOrderId: 0,
        paymentLockUntil: 0,
      },
    )
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
  owned: (id: string, userId: string) => Order.findOne({ _id: id, userId }),
};
