import { returnDecisionSchema, returnReceiptSchema, returnRequestSchema } from '@megha/validation';
import mongoose from 'mongoose';
import { DomainError } from '../../shared/errors/domain-error';
import { audit } from '../audit/audit.service';
import { nextNumber } from '../counters/counter.service';
import { Ledger } from '../inventory-transactions/inventory-transaction.model';
import { notifyOnce } from '../notifications/notification.service';
import { Order } from '../orders/order.model';
import { Product } from '../products/product.model';
import { requestRefund } from '../refunds/refund.service';
import { Return } from './return.model';

const openStatuses = ['REQUESTED', 'APPROVED', 'RECEIVED'];

/** Customer return request for a delivered order. Quantities cannot exceed what was bought. */
export async function requestReturn(orderId: string, userId: string, input: unknown) {
  const data = returnRequestSchema.parse(input);
  const existing = await Return.findOne({ idempotencyKey: data.idempotencyKey }).lean();
  if (existing) return existing;
  const order = await Order.findOne({ _id: orderId, userId });
  if (!order) throw new DomainError('NOT_FOUND', 'Order not found.', 404);
  if (!['DELIVERED', 'RETURN_REQUESTED'].includes(order.status ?? ''))
    throw new DomainError('NOT_RETURNABLE', 'Returns can be requested after delivery.', 409);
  const previous = await Return.find({ orderId, status: { $ne: 'REJECTED' } }).lean();
  const items = data.items.map((requested) => {
    const line = order.items.find((item) => item.productId === requested.productId);
    if (!line) throw new DomainError('INVALID_ITEM', 'That item is not part of this order.');
    const already = previous
      .flatMap((entry) => entry.items)
      .filter((item) => item.productId === requested.productId)
      .reduce((sum, item) => sum + (item.quantity ?? 0), 0);
    if (requested.quantity > (line.quantity ?? 0) - already)
      throw new DomainError(
        'INVALID_QUANTITY',
        'Return quantity exceeds what can be returned for ' + line.name + '.',
      );
    // Refund value includes the item's GST share.
    const unitPrice = Math.round((line.total ?? 0) / (line.quantity ?? 1));
    return {
      productId: line.productId,
      name: line.name,
      sku: line.sku,
      quantity: requested.quantity,
      unitPrice,
    };
  });
  let record;
  try {
    record = await Return.create({
      number: await nextNumber('RET'),
      orderId,
      orderNumber: order.number,
      userId,
      items,
      reason: data.reason,
      comments: data.comments,
      history: [
        { status: 'REQUESTED', at: new Date(), actor: 'customer', description: data.reason },
      ],
      idempotencyKey: data.idempotencyKey,
    });
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    return Return.findOne({ idempotencyKey: data.idempotencyKey }).lean();
  }
  if (order.status === 'DELIVERED') order.status = 'RETURN_REQUESTED';
  order.history.push({
    status: 'RETURN_REQUESTED',
    at: new Date(),
    actor: 'customer',
    description: 'Return ' + record.number,
  });
  await order.save();
  await notifyOnce(
    userId,
    'return:' + record.number + ':REQUESTED',
    'Return request received · ' + record.number,
    'We will review your return request and contact you.',
    { orderId, returnId: String(record._id) },
  );
  return record.toObject();
}

async function loadReturn(orderId: string, returnId: string) {
  const record = await Return.findOne({ _id: returnId, orderId });
  if (!record) throw new DomainError('NOT_FOUND', 'Return not found.', 404);
  return record;
}

export async function decideReturn(
  orderId: string,
  returnId: string,
  input: unknown,
  actor: { id: string; requestId?: string },
) {
  const { decision, notes } = returnDecisionSchema.parse(input);
  const record = await loadReturn(orderId, returnId);
  if (record.status !== 'REQUESTED')
    throw new DomainError('INVALID_STATE', 'This return was already reviewed.', 409);
  record.status = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
  record.decisionNotes = notes;
  record.history.push({
    status: record.status,
    at: new Date(),
    actor: actor.id,
    description: notes,
  });
  await record.save();
  const order = await Order.findById(orderId);
  if (order) {
    const open = await Return.countDocuments({ orderId, status: { $in: openStatuses } });
    if (decision === 'REJECT' && !open && order.status === 'RETURN_REQUESTED')
      order.status = 'DELIVERED';
    order.history.push({
      status: 'RETURN_' + record.status,
      at: new Date(),
      actor: actor.id,
      description: record.number + (notes ? ' · ' + notes : ''),
    });
    await order.save();
    await notifyOnce(
      String(order.userId),
      'return:' + record.number + ':' + record.status,
      'Return ' + (decision === 'APPROVE' ? 'approved' : 'declined') + ' · ' + record.number,
      notes ||
        (decision === 'APPROVE'
          ? 'Please hand the parcel to the courier or our team.'
          : 'Contact us if you have questions.'),
      { orderId },
    );
  }
  await audit(actor.id, 'RETURN_' + record.status, 'orders', orderId, notes, {
    requestId: actor.requestId,
  });
  return record.toObject();
}

/** Records the returned parcel. Each line is restocked or written off as damaged. */
export async function receiveReturn(
  orderId: string,
  returnId: string,
  input: unknown,
  actor: { id: string; requestId?: string },
) {
  const data = returnReceiptSchema.parse(input);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const record = await Return.findOne({ _id: returnId, orderId }).session(session);
      if (!record) throw new DomainError('NOT_FOUND', 'Return not found.', 404);
      if (record.status !== 'APPROVED')
        throw new DomainError('INVALID_STATE', 'Approve the return before receiving it.', 409);
      for (const line of data.items) {
        const requested = record.items.find((item) => item.productId === line.productId);
        if (!requested || line.quantity > (requested.quantity ?? 0))
          throw new DomainError('INVALID_QUANTITY', 'Received quantity exceeds the return.');
        if (line.condition === 'RESTOCK')
          await Product.updateOne(
            { _id: line.productId },
            { $inc: { stock: line.quantity } },
            { session },
          );
        await Ledger.create(
          [
            {
              key: returnId + ':received:' + line.productId,
              productId: line.productId,
              quantity: line.condition === 'RESTOCK' ? line.quantity : 0,
              type: line.condition === 'RESTOCK' ? 'RETURN_RECEIVED' : 'DAMAGED',
              reason:
                record.number +
                (line.condition === 'RESTOCK'
                  ? ' restocked'
                  : ' written off as damaged (' + line.quantity + ')'),
              actorId: actor.id,
              orderId,
            },
          ],
          { session },
        );
      }
      record.status = 'RECEIVED';
      record.set('receivedItems', data.items);
      record.history.push({
        status: 'RECEIVED',
        at: new Date(),
        actor: actor.id,
        description: data.notes,
      });
      await record.save({ session });
      const order = await Order.findById(orderId).session(session);
      if (order) {
        order.status = 'RETURNED';
        order.history.push({
          status: 'RETURNED',
          at: new Date(),
          actor: actor.id,
          description: record.number + ' received',
        });
        await order.save({ session });
      }
      await audit(actor.id, 'RETURN_RECEIVED', 'orders', orderId, data.notes, {
        after: { items: data.items },
        requestId: actor.requestId,
        session,
      });
    });
  } finally {
    await session.endSession();
  }
  return Return.findById(returnId).lean();
}

/** Refunds the returned items' value (including GST) through Razorpay. */
export async function refundReturn(
  orderId: string,
  returnId: string,
  idempotencyKey: string,
  actor: { id: string; requestId?: string },
) {
  const record = await loadReturn(orderId, returnId);
  if (record.status !== 'RECEIVED')
    throw new DomainError('INVALID_STATE', 'Receive the returned parcel before refunding.', 409);
  const amount = record.items.reduce(
    (sum, item) => sum + (item.unitPrice ?? 0) * (item.quantity ?? 0),
    0,
  );
  const refund = await requestRefund(
    orderId,
    { amount, reason: 'Return ' + record.number, idempotencyKey },
    actor.id,
    { returnId, requestId: actor.requestId },
  );
  record.refundId = String(refund?._id);
  record.status = 'COMPLETED';
  record.history.push({
    status: 'COMPLETED',
    at: new Date(),
    actor: actor.id,
    description: 'Refund requested',
  });
  await record.save();
  return record.toObject();
}
