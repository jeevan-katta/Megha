import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config';
import { connectDatabase } from './database/mongoose';
import { identify } from './middleware/authenticate.middleware';
import { errorHandler, notFound } from './middleware/error.middleware';
import { rateLimit } from './middleware/rate-limit.middleware';
import { requestContext, validateOrigin } from './middleware/security.middleware';
import { razorpayWebhookRoutes } from './modules/webhooks/razorpay-webhook.routes';
import { shiprocketWebhookRoutes } from './modules/webhooks/shiprocket-webhook.routes';
import { routes } from './routes';
import { timing } from './middleware/timing.middleware';

/** Composition root only. Business rules belong to domain services. */
const app = express();
app.disable('x-powered-by');
if (process.env.VERCEL) app.set('trust proxy', 1);
app.use(requestContext);
app.use(timing);
app.use(helmet());
app.use(cors({ origin: config.origins, credentials: true }));
app.use(cookieParser());
app.use(validateOrigin);
app.use('/api/v1/webhooks/razorpay', express.raw({ type: 'application/json', limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(async (_req, _res, next) => {
  try {
    await connectDatabase();
    next();
  } catch (error) {
    next(error);
  }
});
app.use(rateLimit('api', 300, 60000));
app.use('/api/v1/webhooks/razorpay', razorpayWebhookRoutes);
// Shiprocket rejects webhook URLs containing its own name, so the same handler has a neutral path.
app.use('/api/v1/webhooks/shiprocket', shiprocketWebhookRoutes);
app.use('/api/v1/webhooks/courier-updates', shiprocketWebhookRoutes);
app.use(identify);
app.use('/api/v1', routes);
app.use(notFound);
app.use(errorHandler);
export default app;
