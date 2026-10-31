import type { AdminQuery } from '@megha/validation';
import type { FilterQuery, Model } from 'mongoose';
import type { Actor } from '../../middleware/authenticate.middleware';
import { Audit } from '../audit/audit.model';
import { Category } from '../categories/category.model';
import { Compatibility } from '../compatibility/compatibility.model';
import { Ledger } from '../inventory-transactions/inventory-transaction.model';
import { Machine } from '../machines/machine.model';
import { Order } from '../orders/order.model';
import { inventoryViews } from '../products/inventory-views';
import { Product } from '../products/product.model';
import { Entity } from '../records/record.model';
import { Shipment } from '../shipments/shipment.model';
import {
  orderSearchFields,
  orderViews,
  shipmentSearchFields,
  shipmentViews,
} from '../shipments/shipment-views';
import { User } from '../users/user.model';
import type { AdminModule } from './admin.validation';

const defaultSearch = ['name', 'title', 'sku', 'email', 'number', 'description', 'action'];
async function page<T>(
  model: Model<T>,
  filter: FilterQuery<T>,
  query: AdminQuery,
  fields: string[] = defaultSearch,
  projection: Record<string, 0> = {},
) {
  const search = query.q
    ? {
        $or: fields.map((key) => ({
          [key]: { $regex: query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
        })),
      }
    : {};
  const where = { ...filter, ...search, ...(query.status ? { status: query.status } : {}) };
  const sort: Record<string, 1 | -1> =
    query.sort === 'oldest'
      ? { createdAt: 1, _id: 1 }
      : query.sort === 'name'
        ? { name: 1, _id: 1 }
        : { createdAt: -1, _id: -1 };
  const [items, total] = await Promise.all([
    model
      .find(where, projection)
      .sort(sort)
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    model.countDocuments(where),
  ]);
  return { items, total, page: query.page, pages: Math.max(1, Math.ceil(total / query.limit)) };
}
export function list(module: AdminModule, user: Actor, query: AdminQuery) {
  switch (module) {
    case 'products':
      return page(Product, {}, query);
    case 'inventory':
      return page(Product, inventoryViews[query.view]?.() ?? {}, query);
    case 'categories':
      return page(Category, {}, query);
    case 'machines':
      return page(Machine, {}, query);
    case 'compatibility':
      return page(Compatibility, {}, query);
    case 'users':
      return page(User, {}, query);
    case 'customers':
      return page(User, { role: 'CUSTOMER' }, query);
    case 'technicians':
      return page(User, { role: 'TECHNICIAN' }, query);
    case 'orders':
    case 'payments':
      return page(
        Order,
        (module === 'orders' && orderViews[query.view]?.()) || {},
        query,
        orderSearchFields,
        // Lists never need the timeline or checkout keys; the detail view loads those.
        { idempotencyKey: 0, requestFingerprint: 0, history: 0 },
      );
    case 'shipments':
      return page(
        Shipment,
        shipmentViews[query.view]?.filter() ?? {},
        query,
        shipmentSearchFields,
        { lockUntil: 0, labelPrints: 0 },
      );
    case 'audit':
      return page(Audit, {}, query);
    default:
      return page(
        Entity,
        { kind: module, ...(user.role === 'TECHNICIAN' ? { 'data.technicianId': user._id } : {}) },
        query,
      );
  }
}
export const inventoryHistory = (id: string) =>
  Ledger.find({ productId: id }).sort({ createdAt: -1 }).limit(100).lean();
