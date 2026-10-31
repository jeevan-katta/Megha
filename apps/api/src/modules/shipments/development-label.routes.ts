import { Router } from 'express';
import { z } from 'zod';
import { config } from '../../config';
import { actor, authenticated } from '../../middleware/authenticate.middleware';
import { authorize } from '../../middleware/authorize.middleware';
import { DomainError } from '../../shared/errors/domain-error';
import { Shipment } from './shipment.model';

const escape = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');

/** Printable stand-in labels, always marked as unsuitable for real shipping. */
export const developmentLabelRoutes = Router();
developmentLabelRoutes.get(
  '/:shipmentId',
  authenticated,
  authorize('shipments'),
  async (req, res) => {
    if (!['development', 'demo'].includes(config.shipping))
      throw new DomainError('NOT_FOUND', 'Label not found.', 404);
    actor(res);
    const shipment = await Shipment.findOne({
      providerShipmentId: z.string().max(60).parse(req.params.shipmentId),
      provider: config.shipping,
    }).lean();
    if (!shipment) throw new DomainError('NOT_FOUND', 'Label not found.', 404);
    res.type('html').send(`<!doctype html><title>Label ${escape(shipment.awb)}</title>
<body style="font:14px Arial;margin:24px"><div style="border:2px solid #000;padding:16px;width:360px">
<p style="margin:0 0 8px;font-weight:bold">${config.shipping === 'demo' ? 'DEMO' : 'DEVELOPMENT'} LABEL · NOT FOR SHIPPING</p>
<p style="margin:0">AWB</p><p style="font:bold 24px monospace;margin:0 0 12px">${escape(shipment.awb)}</p>
<p style="margin:0">Order ${escape(shipment.orderNumber)} · ${escape(shipment.courierName)}</p>
<p style="margin:8px 0 0">To: ${escape(shipment.customerName)} · ${escape(shipment.customerPhone)}</p>
<p style="margin:8px 0 0">${escape(shipment.package?.weight)} kg · ${escape(shipment.package?.length)}×${escape(shipment.package?.breadth)}×${escape(shipment.package?.height)} cm</p>
</div></body>`);
  },
);
