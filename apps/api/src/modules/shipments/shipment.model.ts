import { Schema } from 'mongoose';
import { defineModel } from '../../database/model';
const options = { timestamps: true } as const;
const schema = new Schema(
  {
    orderId: { type: String, required: true },
    orderNumber: String,
    /** Reference sent to the provider; reships after a cancellation get a suffix. */
    providerReference: String,
    /** One active shipment per order; cancelled ones stay for history. */
    active: { type: Boolean, default: true },
    /** Short lease so two staff clicks cannot run the same provider step twice. */
    lockUntil: Date,
    customerName: String,
    customerPhone: String,
    provider: String,
    status: { type: String, default: 'NOT_CREATED' },
    providerOrderId: String,
    providerShipmentId: String,
    shipmentCreatedAt: Date,
    courierId: Number,
    courierName: String,
    awb: String,
    awbGeneratedAt: Date,
    // Generating a label and physically printing it are tracked separately.
    labelUrl: String,
    labelGeneratedAt: Date,
    labelPrinted: { type: Boolean, default: false },
    labelPrintedAt: Date,
    labelPrintedBy: String,
    labelPrintCount: { type: Number, default: 0 },
    labelPrints: [{ at: Date, by: String, reprint: Boolean }],
    pickupStatus: { type: String, default: 'NOT_SCHEDULED' },
    pickupScheduledAt: Date,
    pickupScheduledFor: Date,
    pickupReference: String,
    pickedUpAt: Date,
    package: { weight: Number, length: Number, breadth: Number, height: Number, count: Number },
    expectedDeliveryAt: Date,
    trackUrl: String,
    lastEvent: { status: String, activity: String, location: String, at: Date },
    deliveredAt: Date,
    ndr: {
      reason: String,
      attempts: Number,
      lastAttemptAt: Date,
      actions: [{ action: String, notes: String, by: String, at: Date }],
    },
    rto: {
      initiatedAt: Date,
      deliveredAt: Date,
      inspectedAt: Date,
      inspectedBy: String,
      outcome: String,
      notes: String,
    },
    /** Last failed provider step, so staff see what to retry. Cleared on success. */
    lastError: { step: String, message: String, at: Date },
    syncedAt: Date,
    cancelledAt: Date,
  },
  options,
);
schema.index({ orderId: 1, createdAt: -1 });
schema.index({ orderId: 1 }, { unique: true, partialFilterExpression: { active: true } });
schema.index({ status: 1, updatedAt: -1 });
schema.index({ awb: 1 }, { unique: true, partialFilterExpression: { awb: { $type: 'string' } } });
schema.index({ providerShipmentId: 1 });
schema.index({ createdAt: -1, _id: -1 });
export const Shipment = defineModel('Shipment', schema);

const eventSchema = new Schema(
  {
    shipmentId: { type: String, required: true },
    orderId: String,
    awb: String,
    providerStatus: String,
    normalizedStatus: String,
    activity: String,
    location: String,
    at: Date,
    source: String,
    /** Unique per scan, so webhooks and syncs can repeat safely. */
    fingerprint: { type: String, unique: true },
  },
  options,
);
eventSchema.index({ shipmentId: 1, at: -1 });
export const ShipmentEvent = defineModel('ShipmentEvent', eventSchema);
