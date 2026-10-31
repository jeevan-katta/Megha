import dotenv from 'dotenv';
import mongoose from 'mongoose';
dotenv.config({ path: 'apps/api/.env', quiet: true });
const { connectDatabase } = await import('../apps/api/src/database/mongoose');
const models = await Promise.all([
  import('../apps/api/src/modules/orders/order.model'),
  import('../apps/api/src/modules/products/product.model'),
  import('../apps/api/src/modules/records/record.model'),
  import('../apps/api/src/modules/users/user.model'),
  import('../apps/api/src/modules/audit/audit.model'),
  import('../apps/api/src/modules/inventory-transactions/inventory-transaction.model'),
  import('../apps/api/src/modules/shipments/shipment.model'),
  import('../apps/api/src/modules/refunds/refund.model'),
  import('../apps/api/src/modules/returns/return.model'),
  import('../apps/api/src/modules/webhooks/webhook-event.model'),
  import('../apps/api/src/modules/email/email.model'),
  import('../apps/api/src/modules/auth/password-reset.model'),
]);
try {
  await connectDatabase();
  for (const group of models) {
    for (const model of Object.values(group)) {
      await model.createIndexes();
      console.log(`Indexes ensured: ${model.modelName}`);
    }
  }
} finally {
  await mongoose.disconnect();
}
