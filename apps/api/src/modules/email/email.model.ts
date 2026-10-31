import { Schema } from 'mongoose';
import { defineModel } from '../../database/model';

/**
 * Outgoing email outbox. Messages are written here (inside the same transaction as the change
 * they describe) and sent by the dispatcher, so a failed or repeated request never sends twice.
 */
const schema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    to: { type: String, required: true },
    subject: { type: String, required: true },
    text: String,
    html: String,
    status: { type: String, default: 'PENDING' },
    attempts: { type: Number, default: 0 },
    lockedUntil: Date,
    lastError: String,
    sentAt: Date,
    /** Bodies holding secrets (password reset links) are cleared once sent. */
    sensitive: { type: Boolean, default: false },
  },
  { timestamps: true },
);
schema.index({ status: 1, lockedUntil: 1, createdAt: 1 });
export const Email = defineModel('Email', schema);
