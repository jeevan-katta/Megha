import type { RequestHandler } from 'express';
import { Schema } from 'mongoose';
import { createHash } from 'node:crypto';
import { defineModel } from '../database/model';
import { DomainError } from '../shared/errors/domain-error';
const schema = new Schema({
  _id: String,
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, expires: 0 },
});
const RateBucket = defineModel('RateBucket', schema);
/** Durable counters survive concurrent Vercel instances. */
export function rateLimit(scope: string, limit: number, windowMs: number): RequestHandler {
  return async (req, res, next) => {
    try {
      const now = Date.now(),
        window = Math.floor(now / windowMs);
      const identity = createHash('sha256')
        .update(req.ip || 'unknown')
        .digest('hex');
      const key = `${scope}:${identity}:${window}`;
      let bucket;
      try {
        bucket = await RateBucket.findByIdAndUpdate(
          key,
          { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((window + 2) * windowMs) } },
          { upsert: true, new: true },
        )
          .select('count')
          .lean();
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
        bucket = await RateBucket.findByIdAndUpdate(key, { $inc: { count: 1 } }, { new: true })
          .select('count')
          .lean();
      }
      if ((bucket?.count || 0) > limit) {
        res.setHeader('Retry-After', Math.ceil(((window + 1) * windowMs - now) / 1000));
        throw new DomainError('RATE_LIMITED', 'Too many requests. Please try again shortly.', 429);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
