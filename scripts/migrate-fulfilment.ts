// One-time migration to the separated order / fulfilment status model. Safe to re-run: only
// orders without a fulfilment status are touched.
import dotenv from 'dotenv';
import mongoose from 'mongoose';
dotenv.config({ path: 'apps/api/.env', quiet: true });
const { connectDatabase } = await import('../apps/api/src/database/mongoose');
const { Order } = await import('../apps/api/src/modules/orders/order.model');

const fulfilmentFor: Record<string, string> = {
  PROCESSING: 'PICKING',
  PACKED: 'PACKED',
  SHIPPED: 'SHIPPED',
  OUT_FOR_DELIVERY: 'SHIPPED',
  RTO: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  RETURN_REQUESTED: 'DELIVERED',
  RETURNED: 'RETURNED',
};
// Courier states now live on the shipment; the order keeps its business status.
const orderStatusFor: Record<string, string> = { OUT_FOR_DELIVERY: 'SHIPPED', RTO: 'SHIPPED' };

try {
  await connectDatabase();
  let updated = 0;
  for (const order of await Order.find(
    { fulfilmentStatus: { $exists: false } },
    { status: 1 },
  ).lean()) {
    const status = order.status ?? 'PENDING_PAYMENT';
    await Order.updateOne(
      { _id: order._id, fulfilmentStatus: { $exists: false } },
      {
        $set: {
          fulfilmentStatus: fulfilmentFor[status] ?? 'UNFULFILLED',
          status: orderStatusFor[status] ?? status,
        },
      },
    );
    updated++;
  }
  console.log(`Orders given a fulfilment status: ${updated}.`);
} finally {
  await mongoose.disconnect();
}
