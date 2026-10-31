import { permitted } from '@megha/constants';
import { objectId } from '@megha/validation';
import { Router, type Response } from 'express';
import { z } from 'zod';
import { actor } from '../../middleware/authenticate.middleware';
import { authorize } from '../../middleware/authorize.middleware';
import { DomainError } from '../../shared/errors/domain-error';
import { Audit } from '../audit/audit.model';
import { cancel as cancelUnpaid } from '../orders/order-cancellation.service';
import { Order } from '../orders/order.model';
import { Refund } from '../refunds/refund.model';
import { reconcileRefund, requestRefund } from '../refunds/refund.service';
import { Return } from '../returns/return.model';
import { decideReturn, receiveReturn, refundReturn } from '../returns/return.service';
import { User } from '../users/user.model';
import * as fulfilment from './fulfilment.service';
import { Shipment, ShipmentEvent } from './shipment.model';

/** Admin order operations, mounted at /admin/orders/:id (orders permission already checked). */
export const fulfilmentRoutes = Router({ mergeParams: true });
const orderId = (params: Record<string, unknown>) => objectId.parse(params.id);
const who = (res: Response) => ({ id: actor(res)._id, requestId: res.locals.requestId as string });
const key = z.object({ idempotencyKey: z.string().uuid() }).passthrough();
const shipments = authorize('shipments');
const payments = authorize('payments');

fulfilmentRoutes.get('/details', async (req, res) => {
  const id = orderId(req.params);
  const [order, shipmentList, refunds, returns] = await Promise.all([
    Order.findById(id, { idempotencyKey: 0, requestFingerprint: 0 }).lean(),
    Shipment.find({ orderId: id }, { lockUntil: 0 }).sort({ createdAt: -1 }).lean(),
    Refund.find({ orderId: id }, { idempotencyKey: 0 }).sort({ createdAt: -1 }).lean(),
    Return.find({ orderId: id }, { idempotencyKey: 0 }).sort({ createdAt: -1 }).lean(),
  ]);
  if (!order) throw new DomainError('NOT_FOUND', 'Order not found.', 404);
  const shipmentIds = shipmentList.map((shipment) => String(shipment._id));
  const [events, audits] = await Promise.all([
    ShipmentEvent.find({ shipmentId: { $in: shipmentIds } }, { fingerprint: 0 })
      .sort({ at: -1 })
      .limit(200)
      .lean(),
    Audit.find({ entityId: { $in: [id, ...shipmentIds] } })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
  ]);
  // Resolve staff ids in the timeline and audit trail to names.
  const actorIds = [
    ...new Set(
      [
        ...(order.history ?? []).map((entry) => entry.actor),
        ...audits.map((entry) => entry.actorId),
        ...shipmentList.flatMap((s) => (s.labelPrints ?? []).map((p) => p.by)),
      ].filter((value): value is string => !!value && /^[a-f0-9]{24}$/.test(value)),
    ),
  ];
  const users = await User.find({ _id: { $in: actorIds } }, { name: 1 }).lean();
  res.json({
    data: {
      order,
      shipments: shipmentList,
      events,
      refunds,
      returns,
      audits,
      actors: Object.fromEntries(users.map((user) => [String(user._id), user.name])),
    },
  });
});

fulfilmentRoutes.post('/process', shipments, async (req, res) => {
  res.json({ data: await fulfilment.startProcessing(orderId(req.params), who(res)) });
});
fulfilmentRoutes.post('/pack', shipments, async (req, res) => {
  res.json({ data: await fulfilment.markPacked(orderId(req.params), req.body, who(res)) });
});
fulfilmentRoutes.post('/shipment', shipments, async (req, res) => {
  res.json({ data: await fulfilment.createShipment(orderId(req.params), who(res)) });
});
fulfilmentRoutes.get('/couriers', shipments, async (req, res) => {
  res.json({ data: await fulfilment.listCouriers(orderId(req.params)) });
});
fulfilmentRoutes.post('/awb', shipments, async (req, res) => {
  res.json({ data: await fulfilment.assignCourier(orderId(req.params), req.body, who(res)) });
});
fulfilmentRoutes.post('/label', shipments, async (req, res) => {
  res.json({ data: await fulfilment.generateLabel(orderId(req.params), who(res)) });
});
fulfilmentRoutes.post('/label/print', shipments, async (req, res) => {
  res.json({ data: await fulfilment.recordLabelPrint(orderId(req.params), who(res)) });
});
fulfilmentRoutes.post('/pickup', shipments, async (req, res) => {
  res.json({ data: await fulfilment.schedulePickup(orderId(req.params), who(res)) });
});
fulfilmentRoutes.post('/shipment/cancel', shipments, async (req, res) => {
  res.json({ data: await fulfilment.cancelShipment(orderId(req.params), req.body, who(res)) });
});
fulfilmentRoutes.post('/tracking/sync', shipments, async (req, res) => {
  res.json({ data: await fulfilment.syncTracking(orderId(req.params)) });
});
fulfilmentRoutes.post('/ndr', shipments, async (req, res) => {
  res.json({ data: await fulfilment.recordNdrAction(orderId(req.params), req.body, who(res)) });
});
fulfilmentRoutes.post('/rto-inspection', shipments, async (req, res) => {
  if (req.body?.refund && !permitted(actor(res).role, 'payments'))
    throw new DomainError('FORBIDDEN', 'Refunds require payments permission.', 403);
  res.json({ data: await fulfilment.inspectRto(orderId(req.params), req.body, who(res)) });
});

fulfilmentRoutes.post('/cancel', payments, async (req, res) => {
  const id = orderId(req.params);
  const { idempotencyKey, ...body } = key.parse(req.body);
  const order = await Order.findById(id, { status: 1, userId: 1 }).lean();
  if (!order) throw new DomainError('NOT_FOUND', 'Order not found.', 404);
  if (order.status === 'PENDING_PAYMENT') {
    const reason = z.object({ reason: z.string().trim().min(5).max(1000) }).parse(body).reason;
    await cancelUnpaid(id, String(order.userId), true, { reason: 'Cancelled by staff: ' + reason });
    res.json({ data: await Order.findById(id).lean() });
    return;
  }
  res.json({ data: await fulfilment.cancelPaidOrder(id, body, who(res), idempotencyKey) });
});
fulfilmentRoutes.post('/refunds', payments, async (req, res) => {
  const input = z
    .object({
      amount: z.number().int().min(100).optional(),
      reason: z.string().trim().min(5).max(500),
      idempotencyKey: z.string().uuid(),
    })
    .strict()
    .parse(req.body);
  res.json({
    data: await requestRefund(orderId(req.params), input, actor(res)._id, {
      requestId: who(res).requestId,
    }),
  });
});
fulfilmentRoutes.post('/refunds/:refundId/reconcile', payments, async (req, res) => {
  const refund = await Refund.findOne({
    _id: objectId.parse(req.params.refundId),
    orderId: orderId(req.params),
  }).lean();
  if (!refund) throw new DomainError('NOT_FOUND', 'Refund not found.', 404);
  res.json({ data: await reconcileRefund(String(refund._id)) });
});

fulfilmentRoutes.post('/returns/:returnId/decision', async (req, res) => {
  res.json({
    data: await decideReturn(
      orderId(req.params),
      objectId.parse(req.params.returnId),
      req.body,
      who(res),
    ),
  });
});
fulfilmentRoutes.post('/returns/:returnId/receive', shipments, async (req, res) => {
  res.json({
    data: await receiveReturn(
      orderId(req.params),
      objectId.parse(req.params.returnId),
      req.body,
      who(res),
    ),
  });
});
fulfilmentRoutes.post('/returns/:returnId/refund', payments, async (req, res) => {
  const { idempotencyKey } = key.parse(req.body);
  res.json({
    data: await refundReturn(
      orderId(req.params),
      objectId.parse(req.params.returnId),
      idempotencyKey,
      who(res),
    ),
  });
});
