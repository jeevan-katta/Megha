import { objectId, profileSchema } from '@megha/validation';
import { Router } from 'express';
import { actor, authenticated } from '../../middleware/authenticate.middleware';
import { expireCustomerOrders } from '../../jobs/reservations.job';
import { DomainError } from '../../shared/errors/domain-error';
import { orderRepository } from '../orders/order.repository';
import { recordRepository } from '../records/record.repository';
import { personalRecords, savePersonal } from '../records/record.service';
import { publicUser } from '../users/user.mapper';
import { userRepository } from '../users/user.repository';
export const customerRoutes = Router();
customerRoutes.use(authenticated);
customerRoutes.get('/', (_req, res) => {
  res.json({ data: actor(res) });
});
customerRoutes.patch('/', async (req, res) => {
  const user = await userRepository.updateProfile(actor(res)._id, profileSchema.parse(req.body));
  if (!user) throw new DomainError('NOT_FOUND', 'Account not found.', 404);
  res.json({ data: publicUser(user) });
});
customerRoutes.get('/orders', async (_req, res) => {
  await expireCustomerOrders(actor(res)._id);
  res.json({ data: await orderRepository.byCustomer(actor(res)._id) });
});
customerRoutes.get('/records/:kind', async (req, res) => {
  res.json({ data: await personalRecords(req.params.kind, actor(res)._id) });
});
customerRoutes.post('/records/:kind', async (req, res) => {
  res.status(201).json({ data: await savePersonal(req.params.kind, req.body, actor(res)._id) });
});
customerRoutes.post('/notifications/read', async (_req, res) => {
  const result = await recordRepository.markNotificationsRead(actor(res)._id);
  res.json({ data: { updated: result.modifiedCount } });
});
customerRoutes.delete('/records/:id', async (req, res) => {
  await recordRepository.removePersonal(objectId.parse(req.params.id), actor(res)._id);
  res.json({ data: { ok: true } });
});
