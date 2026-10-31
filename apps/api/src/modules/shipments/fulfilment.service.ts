import { shipmentInCourierHands, type ShipmentStatus } from '@megha/constants';
import {
  courierSchema,
  ndrActionSchema,
  packageSchema,
  reasonSchema,
  rtoInspectionSchema,
} from '@megha/validation';
import mongoose, { type ClientSession } from 'mongoose';
import { shipping } from '../../integrations/shiprocket';
import { DomainError } from '../../shared/errors/domain-error';
import { audit } from '../audit/audit.service';
import { Ledger } from '../inventory-transactions/inventory-transaction.model';
import { notifyOnce } from '../notifications/notification.service';
import { Order } from '../orders/order.model';
import { Product } from '../products/product.model';
import { requestRefund } from '../refunds/refund.service';
import { Shipment } from './shipment.model';
import { syncOrderSummary } from './shipment-summary';
import { applyTracking } from './tracking.service';

export interface Actor {
  id: string;
  requestId?: string;
}
type OrderDoc = InstanceType<typeof Order>;
type ShipmentDoc = InstanceType<typeof Shipment>;

const step: Record<string, number> = {
  NOT_CREATED: 0,
  CREATED: 1,
  COURIER_ASSIGNED: 2,
  AWB_GENERATED: 3,
  LABEL_GENERATED: 4,
  LABEL_PRINTED: 5,
  PICKUP_SCHEDULED: 6,
};
/** Moves a pre-pickup shipment forward without ever moving it back. */
function advance(shipment: ShipmentDoc, status: ShipmentStatus) {
  if ((step[shipment.status ?? 'NOT_CREATED'] ?? 99) < (step[status] ?? 99))
    shipment.status = status;
}
function timeline(order: OrderDoc, status: string, actor: string, description: string) {
  order.history.push({ status, at: new Date(), actor, description });
}

async function loadOrder(orderId: string) {
  const order = await Order.findById(orderId);
  if (!order) throw new DomainError('NOT_FOUND', 'Order not found.', 404);
  return order;
}
export const activeShipment = (orderId: string) => Shipment.findOne({ orderId, active: true });
async function requireShipment(orderId: string) {
  const shipment = await activeShipment(orderId);
  if (!shipment?.providerShipmentId)
    throw new DomainError('NO_SHIPMENT', 'Create the shipment first.', 409);
  return shipment;
}

/**
 * Runs one provider step under a short lease. Failures are saved on the shipment for retry and
 * never touch order data.
 */
async function providerStep<T>(shipment: ShipmentDoc, name: string, run: () => Promise<T>) {
  const now = new Date();
  const lease = await Shipment.findOneAndUpdate(
    {
      _id: shipment._id,
      $or: [{ lockUntil: { $exists: false } }, { lockUntil: null }, { lockUntil: { $lt: now } }],
    },
    { $set: { lockUntil: new Date(now.getTime() + 60000) } },
  );
  if (!lease)
    throw new DomainError(
      'SHIPMENT_BUSY',
      'Another update is in progress. Retry in a moment.',
      409,
    );
  try {
    const result = await run();
    await Shipment.updateOne({ _id: shipment._id }, { $unset: { lockUntil: 1, lastError: 1 } });
    shipment.lastError = undefined;
    return result;
  } catch (error) {
    await Shipment.updateOne(
      { _id: shipment._id },
      {
        $unset: { lockUntil: 1 },
        $set: {
          lastError: {
            step: name,
            message: (error as Error).message.slice(0, 300),
            at: new Date(),
          },
        },
      },
    );
    throw error;
  }
}

export async function startProcessing(orderId: string, actor: Actor) {
  const order = await loadOrder(orderId);
  if (!['PAID', 'CONFIRMED'].includes(order.status ?? ''))
    throw new DomainError('INVALID_STATE', 'Only confirmed orders can start processing.', 409);
  order.status = 'PROCESSING';
  order.fulfilmentStatus = 'PICKING';
  timeline(order, 'PROCESSING', actor.id, 'Processing started; items being picked');
  await order.save();
  await audit(actor.id, 'START_PROCESSING', 'orders', orderId, '', { requestId: actor.requestId });
  return order;
}

/** Records the final packed parcel; required before any courier is requested. */
export async function markPacked(orderId: string, input: unknown, actor: Actor) {
  const parcel = packageSchema.parse(input);
  const order = await loadOrder(orderId);
  const repack = order.status === 'PACKED' && order.fulfilmentStatus === 'PACKED';
  if (order.status !== 'PROCESSING' && !repack)
    throw new DomainError('INVALID_STATE', 'Start processing before packing.', 409);
  const before = order.package ? { ...order.package } : undefined;
  order.package = { ...parcel, packedAt: new Date(), packedBy: actor.id };
  order.status = 'PACKED';
  order.fulfilmentStatus = 'PACKED';
  timeline(
    order,
    repack ? 'PACKAGE_UPDATED' : 'PACKED',
    actor.id,
    `${parcel.count} parcel(s), ${parcel.weight} kg, ${parcel.length}×${parcel.breadth}×${parcel.height} cm`,
  );
  await order.save();
  await ensureShipmentRecord(order);
  if (!repack)
    await notifyOnce(
      String(order.userId),
      'order:' + order.number + ':PACKED',
      'Order packed · ' + order.number,
      'Your order is packed and being prepared for shipment.',
      { orderId },
    );
  await audit(actor.id, repack ? 'PACKAGE_UPDATED' : 'PACKED', 'orders', orderId, '', {
    before,
    after: parcel,
    requestId: actor.requestId,
  });
  return order;
}

/**
 * A packed order gets a waiting shipment record (status NOT_CREATED) carrying the parcel, so it
 * appears in the Ready to Ship queue before anything is sent to the provider.
 */
async function ensureShipmentRecord(order: OrderDoc) {
  const parcel = {
    weight: order.package!.weight,
    length: order.package!.length,
    breadth: order.package!.breadth,
    height: order.package!.height,
    count: order.package!.count,
  };
  const previous = await Shipment.countDocuments({ orderId: String(order._id), active: false });
  try {
    return await Shipment.findOneAndUpdate(
      { orderId: String(order._id), active: true },
      {
        $set: { package: parcel },
        $setOnInsert: {
          orderNumber: order.number,
          providerReference: previous ? order.number + '-R' + previous : order.number,
          customerName: order.customer?.name,
          customerPhone: order.customer?.phone,
          provider: shipping.name,
          status: 'NOT_CREATED',
        },
      },
      { upsert: true, new: true },
    );
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    return activeShipment(String(order._id));
  }
}

export async function createShipment(orderId: string, actor: Actor) {
  const order = await loadOrder(orderId);
  if (order.status !== 'PACKED' || !order.package?.weight)
    throw new DomainError('INVALID_STATE', 'Pack the order and record its parcel first.', 409);
  const existing = await activeShipment(orderId);
  if (existing?.providerShipmentId) return existing;
  const current = existing ?? (await ensureShipmentRecord(order));
  if (!current) throw new DomainError('SHIPMENT_BUSY', 'Retry in a moment.', 409);
  const address = order.address!;
  const billing = (order.billingAddress ?? address) as typeof address;
  const contact = {
    name: order.customer?.name ?? '',
    email: order.customer?.email ?? '',
    phone: order.customer?.phone ?? '',
  };
  const created = await providerStep(current, 'shipment', () =>
    shipping.createOrder({
      orderNumber: current.providerReference ?? order.number!,
      orderDate: order.createdAt ?? new Date(),
      shipping: {
        ...contact,
        line1: address.line1!,
        line2: address.line2 ?? undefined,
        city: address.city!,
        state: address.state!,
        pincode: address.pincode!,
      },
      billing: {
        ...contact,
        line1: billing.line1!,
        line2: billing.line2 ?? undefined,
        city: billing.city!,
        state: billing.state!,
        pincode: billing.pincode!,
      },
      items: order.items.map((item) => ({
        name: item.name ?? '',
        sku: item.sku ?? '',
        units: item.quantity ?? 1,
        unitPrice: item.unitPrice ?? 0,
        gstRate: item.gstRate ?? 0,
      })),
      subTotal: order.subtotal ?? 0,
      parcel: {
        weight: order.package!.weight!,
        length: order.package!.length!,
        breadth: order.package!.breadth!,
        height: order.package!.height!,
      },
    }),
  );
  current.providerOrderId = created.providerOrderId;
  current.providerShipmentId = created.providerShipmentId;
  current.shipmentCreatedAt = new Date();
  current.status = 'CREATED';
  await current.save();
  order.fulfilmentStatus = 'READY_TO_SHIP';
  timeline(order, 'SHIPMENT_CREATED', actor.id, 'Shipment created with ' + shipping.name);
  await order.save();
  await syncOrderSummary(current);
  await audit(actor.id, 'SHIPMENT_CREATED', 'shipments', String(current._id), order.number ?? '', {
    after: {
      providerOrderId: created.providerOrderId,
      providerShipmentId: created.providerShipmentId,
    },
    requestId: actor.requestId,
  });
  return current;
}

/** Couriers available for the created shipment, with rates and delivery estimates. */
export async function listCouriers(orderId: string) {
  const shipment = await requireShipment(orderId);
  return shipping.couriers(shipment.providerShipmentId!, shipment.providerOrderId!);
}

/** Assigns the chosen (or recommended) courier and stores the AWB. */
export async function assignCourier(orderId: string, input: unknown, actor: Actor) {
  const { courierId } = courierSchema.parse(input);
  const shipment = await requireShipment(orderId);
  if (shipment.awb) return shipment;
  const result = await providerStep(shipment, 'awb', () =>
    shipping.assignAwb(shipment.providerShipmentId!, courierId),
  );
  shipment.awb = result.awb;
  shipment.courierId = result.courierId;
  shipment.courierName = result.courierName;
  shipment.awbGeneratedAt = new Date();
  advance(shipment, 'AWB_GENERATED');
  await shipment.save();
  const order = await loadOrder(orderId);
  timeline(
    order,
    'COURIER_ASSIGNED',
    actor.id,
    result.courierName + (courierId ? '' : ' (recommended)'),
  );
  timeline(order, 'AWB_GENERATED', actor.id, 'AWB ' + result.awb);
  await order.save();
  await syncOrderSummary(shipment);
  await audit(actor.id, 'COURIER_ASSIGNED', 'shipments', String(shipment._id), result.courierName, {
    after: { awb: result.awb, courierId: result.courierId, courierName: result.courierName },
    requestId: actor.requestId,
  });
  return shipment;
}

export async function generateLabel(orderId: string, actor: Actor) {
  const shipment = await requireShipment(orderId);
  if (!shipment.awb) throw new DomainError('NO_AWB', 'Generate the AWB first.', 409);
  if (shipment.labelUrl) return shipment;
  const { labelUrl } = await providerStep(shipment, 'label', () =>
    shipping.generateLabel(shipment.providerShipmentId!),
  );
  shipment.labelUrl = labelUrl;
  shipment.labelGeneratedAt = new Date();
  advance(shipment, 'LABEL_GENERATED');
  await shipment.save();
  const order = await loadOrder(orderId);
  timeline(order, 'LABEL_GENERATED', actor.id, 'Shipping label generated');
  await order.save();
  await syncOrderSummary(shipment);
  await audit(actor.id, 'LABEL_GENERATED', 'shipments', String(shipment._id), '', {
    requestId: actor.requestId,
  });
  return shipment;
}

/** Records a physical print. Reprints are allowed and every print is kept in history. */
export async function recordLabelPrint(orderId: string, actor: Actor) {
  const shipment = await requireShipment(orderId);
  if (!shipment.labelUrl) throw new DomainError('NO_LABEL', 'Generate the label first.', 409);
  const reprint = (shipment.labelPrintCount ?? 0) > 0;
  const at = new Date();
  const updated = await Shipment.findOneAndUpdate(
    { _id: shipment._id },
    {
      $set: { labelPrinted: true, labelPrintedAt: at, labelPrintedBy: actor.id },
      $inc: { labelPrintCount: 1 },
      $push: { labelPrints: { at, by: actor.id, reprint } },
    },
    { new: true },
  );
  advance(updated!, 'LABEL_PRINTED');
  await updated!.save();
  const order = await loadOrder(orderId);
  timeline(
    order,
    reprint ? 'LABEL_REPRINTED' : 'LABEL_PRINTED',
    actor.id,
    'Print #' + updated!.labelPrintCount,
  );
  await order.save();
  await syncOrderSummary(updated!);
  await audit(
    actor.id,
    reprint ? 'LABEL_REPRINT' : 'LABEL_PRINT',
    'shipments',
    String(shipment._id),
    '',
    {
      after: { labelPrintCount: updated!.labelPrintCount },
      requestId: actor.requestId,
    },
  );
  return updated!;
}

export async function schedulePickup(orderId: string, actor: Actor) {
  const shipment = await requireShipment(orderId);
  if (!shipment.awb) throw new DomainError('NO_AWB', 'Generate the AWB first.', 409);
  if (shipment.pickupStatus === 'SCHEDULED' || shipment.pickupStatus === 'PICKED_UP')
    return shipment;
  const result = await providerStep(shipment, 'pickup', () =>
    shipping.schedulePickup(shipment.providerShipmentId!),
  );
  shipment.pickupStatus = 'SCHEDULED';
  shipment.pickupScheduledAt = new Date();
  shipment.pickupScheduledFor = result.scheduledFor ?? undefined;
  shipment.pickupReference = result.reference ?? undefined;
  advance(shipment, 'PICKUP_SCHEDULED');
  await shipment.save();
  const order = await loadOrder(orderId);
  timeline(
    order,
    'PICKUP_SCHEDULED',
    actor.id,
    result.scheduledFor
      ? 'Pickup on ' + result.scheduledFor.toISOString().slice(0, 10)
      : 'Pickup requested',
  );
  await order.save();
  await syncOrderSummary(shipment);
  await audit(
    actor.id,
    'PICKUP_SCHEDULED',
    'shipments',
    String(shipment._id),
    result.reference ?? '',
    { requestId: actor.requestId },
  );
  return shipment;
}

/** Cancels a shipment that the courier does not yet have. The order returns to packed. */
export async function cancelShipment(orderId: string, input: unknown, actor: Actor) {
  const { reason } = reasonSchema.parse(input);
  const shipment = await activeShipment(orderId);
  if (!shipment) throw new DomainError('NO_SHIPMENT', 'There is no active shipment.', 409);
  if (shipmentInCourierHands.includes(shipment.status as ShipmentStatus))
    throw new DomainError(
      'ALREADY_SHIPPED',
      'The courier already has this parcel; it cannot be cancelled here.',
      409,
    );
  if (shipment.providerOrderId)
    await providerStep(shipment, 'cancel', () => shipping.cancel(shipment.providerOrderId!));
  const before = { status: shipment.status, awb: shipment.awb };
  shipment.status = 'CANCELLED';
  shipment.active = false;
  shipment.cancelledAt = new Date();
  await shipment.save();
  const order = await loadOrder(orderId);
  if (order.status === 'PACKED') order.fulfilmentStatus = 'PACKED';
  timeline(order, 'SHIPMENT_CANCELLED', actor.id, reason);
  await order.save();
  await syncOrderSummary(shipment);
  // Back in the Ready to Ship queue for a new shipment.
  if (order.status === 'PACKED') await ensureShipmentRecord(order);
  await audit(actor.id, 'SHIPMENT_CANCELLED', 'shipments', String(shipment._id), reason, {
    before,
    after: { status: 'CANCELLED' },
    requestId: actor.requestId,
  });
  return shipment;
}

/** Pulls the latest scans from the provider (manual retry when a webhook was missed). */
export async function syncTracking(orderId: string) {
  const shipment = await requireShipment(orderId);
  if (!shipment.awb) throw new DomainError('NO_AWB', 'There is no AWB to track yet.', 409);
  const result = await providerStep(shipment, 'tracking', () => shipping.track(shipment.awb!));
  const applied = await applyTracking(String(shipment._id), result.updates, 'sync', {
    expectedDelivery: result.expectedDelivery,
    trackUrl: result.trackUrl,
  });
  return { applied, shipment: await Shipment.findById(shipment._id).lean() };
}

export async function recordNdrAction(orderId: string, input: unknown, actor: Actor) {
  const { action, notes } = ndrActionSchema.parse(input);
  const shipment = await activeShipment(orderId);
  if (!shipment || !['NDR', 'DELIVERY_EXCEPTION'].includes(shipment.status ?? ''))
    throw new DomainError('INVALID_STATE', 'This shipment has no open delivery exception.', 409);
  await Shipment.updateOne(
    { _id: shipment._id },
    { $push: { 'ndr.actions': { action, notes, by: actor.id, at: new Date() } } },
  );
  const order = await loadOrder(orderId);
  timeline(order, 'NDR_ACTION', actor.id, action.replaceAll('_', ' ').toLowerCase() + ': ' + notes);
  await order.save();
  await audit(actor.id, 'NDR_' + action, 'shipments', String(shipment._id), notes, {
    requestId: actor.requestId,
  });
  return shipment;
}

async function restock(
  order: OrderDoc,
  type: 'RETURN_RECEIVED' | 'ORDER_RELEASED',
  reason: string,
  actor: string,
  keyPrefix: string,
  session: ClientSession,
) {
  for (const item of order.items) {
    await Product.updateOne(
      { _id: item.productId },
      { $inc: { stock: item.quantity! } },
      { session },
    );
    await Ledger.create(
      [
        {
          key: String(order._id) + ':' + keyPrefix + ':' + item.productId,
          productId: item.productId,
          quantity: item.quantity,
          type,
          reason,
          actorId: actor,
          orderId: String(order._id),
        },
      ],
      { session },
    );
  }
}

/** Staff decision after an RTO parcel is back and inspected. Stock is never restocked automatically. */
export async function inspectRto(orderId: string, input: unknown, actor: Actor) {
  const decision = rtoInspectionSchema.parse(input);
  const shipment = await Shipment.findOne({ orderId, status: 'RTO_DELIVERED' }).sort({
    createdAt: -1,
  });
  if (!shipment)
    throw new DomainError('INVALID_STATE', 'No returned parcel is awaiting inspection.', 409);
  if (shipment.rto?.inspectedAt) return shipment;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const order = await Order.findById(orderId).session(session);
      if (!order) throw new DomainError('NOT_FOUND', 'Order not found.', 404);
      if (decision.goods === 'RESTOCK')
        await restock(
          order,
          'RETURN_RECEIVED',
          'RTO parcel inspected and restocked',
          actor.id,
          'rto-restock:' + shipment._id,
          session,
        );
      if (decision.goods === 'RESHIP') {
        order.status = 'PACKED';
        order.fulfilmentStatus = 'PACKED';
        shipment.active = false;
      }
      shipment.set({
        'rto.inspectedAt': new Date(),
        'rto.inspectedBy': actor.id,
        'rto.outcome': decision.goods + (decision.refund ? '+REFUND' : ''),
        'rto.notes': decision.notes,
      });
      order.history.push({
        status: 'RTO_INSPECTED',
        at: new Date(),
        actor: actor.id,
        description:
          decision.goods.replaceAll('_', ' ').toLowerCase() +
          (decision.refund ? ', refund issued' : '') +
          (decision.notes ? ' · ' + decision.notes : ''),
      });
      await shipment.save({ session });
      await order.save({ session });
      await audit(actor.id, 'RTO_INSPECTED', 'orders', orderId, decision.notes, {
        after: { goods: decision.goods, refund: decision.refund },
        requestId: actor.requestId,
        session,
      });
    });
  } finally {
    await session.endSession();
  }
  if (decision.goods === 'RESHIP') await ensureShipmentRecord(await loadOrder(orderId));
  if (decision.refund)
    await requestRefund(
      orderId,
      { reason: 'Returned to origin', idempotencyKey: decision.idempotencyKey },
      actor.id,
      { requestId: actor.requestId },
    );
  return Shipment.findById(shipment._id).lean();
}

/**
 * Cancels an order before the courier has it: cancels any shipment, returns stock, records the
 * reason, and refunds a captured payment in full.
 */
export async function cancelPaidOrder(
  orderId: string,
  input: unknown,
  actor: Actor,
  refundKey: string,
) {
  const { reason } = reasonSchema.parse(input);
  const order = await loadOrder(orderId);
  if (!['PAID', 'CONFIRMED', 'PROCESSING', 'PACKED'].includes(order.status ?? ''))
    throw new DomainError(
      'INVALID_STATE',
      'Only orders that have not shipped can be cancelled.',
      409,
    );
  const shipment = await activeShipment(orderId);
  if (shipment && shipment.status !== 'NOT_CREATED')
    await cancelShipment(orderId, { reason: 'Order cancelled: ' + reason }, actor);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const current = await Order.findById(orderId).session(session);
      if (!current || !['PAID', 'CONFIRMED', 'PROCESSING', 'PACKED'].includes(current.status ?? ''))
        return;
      const before = { status: current.status, fulfilmentStatus: current.fulfilmentStatus };
      // Payment capture already took the units out of stock; put them back.
      await restock(
        current,
        'ORDER_RELEASED',
        'Paid order cancelled: ' + reason,
        actor.id,
        'cancel',
        session,
      );
      current.status = 'CANCELLED';
      current.fulfilmentStatus = 'UNFULFILLED';
      current.cancelledAt = new Date();
      current.cancelReason = reason;
      current.history.push({
        status: 'CANCELLED',
        at: new Date(),
        actor: actor.id,
        description: reason,
      });
      await current.save({ session });
      await audit(actor.id, 'ORDER_CANCELLED', 'orders', orderId, reason, {
        before,
        after: { status: 'CANCELLED' },
        requestId: actor.requestId,
        session,
      });
    });
  } finally {
    await session.endSession();
  }
  await Shipment.updateMany(
    { orderId, active: true },
    { $set: { active: false, status: 'CANCELLED', cancelledAt: new Date() } },
  );
  await notifyOnce(
    String(order.userId),
    'order:' + order.number + ':CANCELLED',
    'Order cancelled · ' + order.number,
    'Your order was cancelled. Any payment will be refunded to your original payment method.',
    { orderId },
  );
  if (order.paymentStatus === 'CAPTURED')
    await requestRefund(
      orderId,
      { reason: 'Order cancelled: ' + reason, idempotencyKey: refundKey },
      actor.id,
      { requestId: actor.requestId },
    );
  return Order.findById(orderId).lean();
}
