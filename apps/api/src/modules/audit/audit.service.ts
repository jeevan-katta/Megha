import type { ClientSession } from 'mongoose';
import { Audit } from './audit.model';
export async function audit(
  actorId: string,
  action: string,
  entity: string,
  entityId: string,
  summary = '',
  details: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    requestId?: string;
    session?: ClientSession;
  } = {},
) {
  const { session, ...rest } = details;
  await Audit.create([{ actorId, action, entity, entityId, summary, ...rest }], { session });
}
