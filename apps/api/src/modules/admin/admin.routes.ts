import { objectId } from '@megha/validation';
import { Router } from 'express';
import { actor, authenticated } from '../../middleware/authenticate.middleware';
import { authorize } from '../../middleware/authorize.middleware';
import { DomainError } from '../../shared/errors/domain-error';
import { audit } from '../audit/audit.service';
import { adjustStock } from '../inventory-transactions/inventory.service';
import { fulfilmentRoutes } from '../shipments/fulfilment.routes';
import { shipmentSummary } from '../shipments/shipment-views';
import { reconcilePayment } from '../payments/payment-reconciliation.service';
import { lookups } from './admin-lookups.service';
import { inventoryHistory } from './admin.repository';
import * as service from './admin.service';
import { adminModule } from './admin.validation';
export const adminRoutes = Router();
adminRoutes.get('/lookups', authenticated, async (_req, res) => {
  if (actor(res).role === 'CUSTOMER')
    throw new DomainError('FORBIDDEN', 'Staff access required.', 403);
  res.json({ data: await lookups() });
});
adminRoutes.use('/:module', (req, res, next) => {
  const module = adminModule.parse(req.params.module);
  authorize(module)(req, res, next);
});
adminRoutes.use('/orders/:id', fulfilmentRoutes);
adminRoutes.get('/shipments/summary', async (_req, res) => {
  res.json({ data: await shipmentSummary() });
});
adminRoutes.get('/:module', async (req, res) => {
  res.json({
    data: await service.list(adminModule.parse(req.params.module), actor(res), req.query),
  });
});
adminRoutes.post('/:module', async (req, res) => {
  res.status(201).json({
    data: await service.create(adminModule.parse(req.params.module), req.body, actor(res)),
  });
});
adminRoutes.post('/inventory/:id/adjust', async (req, res) => {
  res.json({ data: await adjustStock(objectId.parse(req.params.id), req.body, actor(res)._id) });
});
adminRoutes.get('/inventory/:id/history', async (req, res) => {
  res.json({ data: await inventoryHistory(objectId.parse(req.params.id)) });
});
adminRoutes.post('/payments/:id/reconcile', async (req, res) => {
  const id = objectId.parse(req.params.id);
  const order = await reconcilePayment(id);
  await audit(actor(res)._id, 'RECONCILE', 'payments', id);
  res.json({ data: order });
});
adminRoutes.patch('/:module/:id', async (req, res) => {
  res.json({
    data: await service.update(
      adminModule.parse(req.params.module),
      objectId.parse(req.params.id),
      req.body,
      actor(res),
    ),
  });
});
