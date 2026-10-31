import { Router } from 'express';
import { config } from './config';
import { jobRoutes } from './jobs/jobs.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import { authRoutes } from './modules/auth/auth.routes';
import { cartRoutes } from './modules/cart/cart.routes';
import { catalogueRoutes } from './modules/catalogue/catalogue.routes';
import { checkoutRoutes } from './modules/checkout/checkout.routes';
import { contentRoutes } from './modules/content/content.routes';
import { newsletterRoutes } from './modules/content/newsletter.routes';
import { customerRoutes } from './modules/customers/customer.routes';
import { orderRoutes } from './modules/orders/order.routes';
import { paymentRoutes } from './modules/payments/payment.routes';
import { mediaRoutes } from './modules/product-media/media.routes';
import { productRoutes } from './modules/products/product.routes';
import { requestRoutes } from './modules/records/record.routes';
import { developmentLabelRoutes } from './modules/shipments/development-label.routes';
import { publicSettings } from './modules/content/public-settings.service';
export const routes = Router();
routes.get('/health', (_req, res) => {
  res.json({ data: { status: 'ok', mode: config.development ? 'development' : 'production' } });
});
routes.get('/config', async (_req, res) => {
  res.json({
    data: {
      development: config.development,
      checkoutEnabled: config.checkoutEnabled,
      paymentProvider: config.payment,
      testPayments: config.testPayments,
      publicSettings: await publicSettings(),
    },
  });
});
routes.use('/auth', authRoutes);
routes.use('/catalogue', catalogueRoutes);
routes.use('/products', productRoutes);
routes.use('/me', customerRoutes);
routes.use('/cart', cartRoutes);
routes.use('/checkout', checkoutRoutes);
routes.use('/orders', orderRoutes);
routes.use('/payments', paymentRoutes);
routes.use('/requests', requestRoutes);
routes.use('/newsletter', newsletterRoutes);
routes.use('/admin', adminRoutes);
routes.use('/content', contentRoutes);
routes.use('/jobs', jobRoutes);
routes.use('/media', mediaRoutes);
routes.use('/shipping-labels/development', developmentLabelRoutes);
routes.use('/shipping-labels/demo', developmentLabelRoutes);
