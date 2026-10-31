import { objectId } from '@megha/validation';
import { Router } from 'express';
import { z } from 'zod';
import { actor, authenticated } from '../../middleware/authenticate.middleware';
import { reconcilePayment } from './payment-reconciliation.service';
import { confirmDevelopment, verifyPayment } from './payment-verification.service';
import { preparePayment } from './payment.service';
const orderInput = z.object({ orderId: objectId }).strict();
const verification = orderInput.extend({
  razorpay_payment_id: z.string().regex(/^pay_[A-Za-z0-9]+$/),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/),
});
export const paymentRoutes = Router();
paymentRoutes.use(authenticated);
paymentRoutes.post('/order', async (req, res) => {
  res.json({ data: await preparePayment(orderInput.parse(req.body).orderId, actor(res)._id) });
});
paymentRoutes.post('/development/confirm', async (req, res) => {
  res.json({ data: await confirmDevelopment(orderInput.parse(req.body).orderId, actor(res)._id) });
});
paymentRoutes.post('/razorpay/verify', async (req, res) => {
  res.json({ data: await verifyPayment(verification.parse(req.body), actor(res)._id) });
});
paymentRoutes.post('/reconcile', async (req, res) => {
  res.json({ data: await reconcilePayment(orderInput.parse(req.body).orderId, actor(res)._id) });
});
