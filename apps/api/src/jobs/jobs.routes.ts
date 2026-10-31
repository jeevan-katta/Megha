import { Router, type Request, type Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { DomainError } from '../shared/errors/domain-error';
import { maintainReservations } from './reservations.job';
import { reconcileTracking } from './tracking.job';
import { deliverEmails } from '../modules/email/email.service';
export const jobRoutes = Router();
function requireScheduler(req: Request) {
  const expected = process.env.CRON_SECRET;
  const supplied = req.get('authorization') ?? '';
  const wanted = 'Bearer ' + expected;
  if (
    !expected ||
    supplied.length !== wanted.length ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(wanted))
  )
    throw new DomainError('UNAUTHORIZED', 'Scheduler authentication required.', 401);
}
// POST for any authenticated scheduler; GET because Vercel Cron calls with GET and this header.
async function reservations(req: Request, res: Response) {
  requireScheduler(req);
  res.json({ data: await maintainReservations() });
}
async function tracking(req: Request, res: Response) {
  requireScheduler(req);
  res.json({ data: await reconcileTracking() });
}
async function email(req: Request, res: Response) {
  requireScheduler(req);
  res.json({ data: await deliverEmails({ limit: 50 }) });
}
jobRoutes.post('/reservations', reservations);
jobRoutes.post('/email', email);
jobRoutes.get('/email', email);
jobRoutes.get('/reservations', reservations);
jobRoutes.post('/tracking', tracking);
jobRoutes.get('/tracking', tracking);
