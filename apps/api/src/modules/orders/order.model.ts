import { Schema } from 'mongoose';
import { defineModel } from '../../database/model';
const options = { timestamps: true } as const;
const id = { type: Schema.Types.ObjectId };
const schema = new Schema(
  {
    number: { type: String, unique: true },
    userId: id,
    idempotencyKey: { type: String, unique: true },
    requestFingerprint: String,
    items: [
      {
        productId: String,
        name: String,
        sku: String,
        partNumber: String,
        image: String,
        quantity: Number,
        unitPrice: Number,
        gstRate: Number,
        tax: Number,
        total: Number,
      },
    ],
    subtotal: Number,
    tax: Number,
    shipping: Number,
    total: Number,
    customer: { name: String, email: String, phone: String, company: String, gstin: String },
    address: { line1: String, line2: String, city: String, state: String, pincode: String },
    billingAddress: Schema.Types.Mixed,
    status: String,
    paymentStatus: String,
    fulfilmentStatus: { type: String, default: 'UNFULFILLED' },
    /** Delivery option chosen at checkout, priced by the server. */
    shippingService: { service: String, label: String, amount: Number, etaDays: Number },
    package: {
      weight: Number,
      length: Number,
      breadth: Number,
      height: Number,
      count: Number,
      notes: String,
      packedAt: Date,
      packedBy: String,
    },
    /** Summary of the active shipment, kept in step with the Shipment record for lists/search. */
    shipment: {
      id: String,
      status: String,
      awb: String,
      courierName: String,
      labelStatus: String,
      pickupStatus: String,
      providerOrderId: String,
      providerShipmentId: String,
      expectedDeliveryAt: Date,
      lastUpdateAt: Date,
      lastLocation: String,
    },
    confirmedAt: Date,
    deliveredAt: Date,
    cancelledAt: Date,
    cancelReason: String,
    /** Paise refunded through Razorpay so far. */
    refundedAmount: { type: Number, default: 0 },
    paymentProvider: String,
    providerOrderId: String,
    providerPaymentId: String,
    paymentLockUntil: Date,
    reservationExpires: Date,
    /** Timeline. actor is a staff user id, 'customer' or 'system'. */
    history: [{ status: String, at: Date, actor: String, description: String }],
  },
  options,
);

schema.index({ userId: 1, createdAt: -1, _id: -1 });
schema.index({ createdAt: -1, _id: -1 });
schema.index({ status: 1, reservationExpires: 1 });
schema.index({ providerOrderId: 1 });
schema.index({ fulfilmentStatus: 1, createdAt: -1 });
schema.index({ 'shipment.awb': 1 });
schema.index({ 'shipment.status': 1 });
// Dashboard sales windows: when payment was confirmed.
schema.index({ paymentStatus: 1, confirmedAt: -1 });
export const Order = defineModel('Order', schema);
