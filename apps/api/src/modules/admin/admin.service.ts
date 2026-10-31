import { publicRequestKinds } from '@megha/constants';
import { adminQuerySchema, contentSchema, requestSchema, settingSchema } from '@megha/validation';
import { randomUUID } from 'node:crypto';
import type { Actor } from '../../middleware/authenticate.middleware';
import { DomainError } from '../../shared/errors/domain-error';
import { checkTransition } from '../../shared/state/transition';
import { audit } from '../audit/audit.service';
import { saveCatalogue } from '../catalogue/catalogue-admin.service';
import { Product } from '../products/product.model';
import { productPatch } from '../products/product.validation';
import { Entity } from '../records/record.model';
import { dashboard } from '../reports/report.service';
import { saveStaff } from '../users/staff.service';
import { User } from '../users/user.model';
import * as repository from './admin.repository';
import { recordPatch, type AdminModule } from './admin.validation';
const catalogueModules = ['products', 'categories', 'machines', 'machine-models', 'compatibility'];
/** Lists are paged records; the reports module answers with the dashboard instead. */
export const list = async (module: AdminModule, user: Actor, query: unknown) =>
  module === 'reports'
    ? dashboard(query)
    : repository.list(module, user, adminQuerySchema.parse(query));
export async function create(module: AdminModule, input: unknown, user: Actor) {
  let result;
  if (catalogueModules.includes(module)) result = await saveCatalogue(module, input, user._id);
  else if (['users', 'customers', 'technicians'].includes(module))
    result = await saveStaff(module, input, user);
  else if (module === 'content' || module === 'settings') {
    const data = (module === 'content' ? contentSchema : settingSchema).parse(input);
    result = await Entity.create({ ...data, kind: module });
  } else if ((publicRequestKinds as readonly string[]).includes(module)) {
    const data = requestSchema.parse(input);
    const customer = await User.findOne({ email: data.email.toLowerCase(), role: 'CUSTOMER' });
    result = await Entity.create({
      ...data,
      ownerId: customer?._id,
      kind: module,
      number: module.slice(0, 3).toUpperCase() + '-' + randomUUID().slice(0, 8).toUpperCase(),
      status: 'NEW',
    });
  } else
    throw new DomainError('READ_ONLY', 'Records in this module are created by their workflow.');
  await audit(user._id, 'CREATE', module, String(result?._id));
  return result;
}
export async function update(module: AdminModule, id: string, input: unknown, user: Actor) {
  let result;
  if (catalogueModules.includes(module) && !(module === 'products' && !('slug' in Object(input))))
    result = await saveCatalogue(module, input, user._id, id);
  else if (['users', 'customers', 'technicians'].includes(module))
    result = await saveStaff(module, input, user, id);
  else if (module === 'content' || module === 'settings')
    result = await Entity.findOneAndUpdate(
      { _id: id, kind: module },
      { $set: (module === 'content' ? contentSchema : settingSchema).parse(input) },
      { new: true, runValidators: true },
    );
  else if (module === 'products')
    result = await Product.findByIdAndUpdate(
      id,
      { $set: productPatch.parse(input) },
      { new: true, runValidators: true },
    );
  else if (module === 'orders' || module === 'payments' || module === 'shipments')
    // Order progress goes through the dedicated order actions (packing needs parcel details;
    // shipped and delivered come only from courier tracking).
    throw new DomainError('USE_ORDER_ACTIONS', 'Use the order actions to update this order.', 409);
  else if (
    ['enquiries', 'service-requests', 'find-my-spare', 'content', 'settings'].includes(module)
  ) {
    const record = await Entity.findOne({ _id: id, kind: module });
    if (!record) throw new DomainError('NOT_FOUND', 'Record not found.', 404);
    if (user.role === 'TECHNICIAN' && record.data?.technicianId !== user._id)
      throw new DomainError('FORBIDDEN', 'This job is not assigned to you.', 403);
    const patch = recordPatch.parse(input);
    if (user.role === 'TECHNICIAN' && patch.data?.technicianId)
      throw new DomainError('FORBIDDEN', 'Only service managers can change assignments.', 403);
    if (
      patch.data?.technicianId &&
      !(await User.exists({ _id: patch.data.technicianId, role: 'TECHNICIAN', active: true }))
    )
      throw new DomainError('INVALID_TECHNICIAN', 'Choose an active technician.');
    if (module !== 'enquiries' && patch.data?.quoteLines)
      throw new DomainError('INVALID_FIELDS', 'Quote lines belong to enquiries only.');
    if (
      module === 'service-requests' &&
      patch.status === 'ASSIGNED' &&
      !(patch.data?.technicianId || record.data?.technicianId)
    )
      throw new DomainError(
        'TECHNICIAN_REQUIRED',
        'Assign a technician before changing this status.',
      );
    if (
      module === 'enquiries' &&
      ['QUOTE_PREPARED', 'QUOTE_SENT'].includes(patch.status || '') &&
      !(patch.data?.quoteLines?.length || record.data?.quoteLines?.length)
    )
      throw new DomainError('QUOTE_LINES_REQUIRED', 'Add quotation line items first.');
    if (
      patch.status &&
      patch.status !== record.status &&
      (publicRequestKinds as readonly string[]).includes(module)
    ) {
      checkTransition(module, record.status!, patch.status);
      record.history.push({ status: patch.status, at: new Date() });
    }
    if (patch.data) {
      const quoteLines = patch.data.quoteLines;
      const totals = quoteLines
        ? quoteLines.reduce(
            (sum, line) => {
              const subtotal = line.quantity * line.unitPrice;
              return {
                subtotal: sum.subtotal + subtotal,
                tax: sum.tax + Math.round((subtotal * line.gstRate) / 100),
              };
            },
            { subtotal: 0, tax: 0 },
          )
        : undefined;
      record.data = {
        ...record.data,
        ...patch.data,
        ...(totals ? { quoteTotals: { ...totals, total: totals.subtotal + totals.tax } } : {}),
      };
      record.markModified('data');
    }
    if (patch.description !== undefined) record.description = patch.description;
    if (patch.status) record.status = patch.status;
    result = await record.save();
  } else throw new DomainError('UNSUPPORTED_ACTION', 'This record is read-only.');
  if (!result)
    throw new DomainError(
      'UPDATE_CONFLICT',
      'Record changed or was not found. Refresh and retry.',
      409,
    );
  await audit(user._id, 'UPDATE', module, id);
  return result;
}
