import app from './app';
import { config } from './config';
import { connectDatabase } from './database/mongoose';
import { maintainReservations } from './jobs/reservations.job';
import { reconcileTracking } from './jobs/tracking.job';
import { deliverEmails } from './modules/email/email.service';
await connectDatabase();
// Long-running local server: release expired reservations every minute.
setInterval(() => {
  maintainReservations().catch((error) => console.error('Reservation maintenance failed', error));
}, 60000).unref();
// Backstop for missed courier webhooks: poll shipments with no update for a few hours.
setInterval(() => {
  reconcileTracking().catch((error) => console.error('Tracking reconciliation failed', error));
}, 15 * 60000).unref();
// Send queued emails (also triggered right after each email is queued).
setInterval(() => {
  deliverEmails().catch((error) => console.error('Email delivery failed', error));
}, 30000).unref();
// Express 5 reports listen failures to this callback; without the check a busy port would log
// "ready" while another (possibly stale) server keeps answering requests.
app.listen(config.port, '127.0.0.1', (error?: Error) => {
  if (error) {
    console.error(
      'Megha API could not start on port ' +
        config.port +
        ': ' +
        error.message +
        '. Stop the other server using this port (for example an earlier npm run dev or preview).',
    );
    process.exit(1);
  }
  console.log('Megha API ready at http://127.0.0.1:' + config.port);
});
