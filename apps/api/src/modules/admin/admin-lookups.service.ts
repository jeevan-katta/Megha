import { Category } from '../categories/category.model';
import { Machine } from '../machines/machine.model';
import { Product } from '../products/product.model';
import { Entity } from '../records/record.model';
import { User } from '../users/user.model';
export async function lookups() {
  const [products, categories, machines, models, technicians] = await Promise.all([
    Product.find().select('name sku').sort({ name: 1 }).limit(1000).lean(),
    Category.find().select('name slug').sort({ name: 1 }).limit(1000).lean(),
    Machine.find().select('name').sort({ name: 1 }).limit(1000).lean(),
    Entity.find({ kind: 'machine-models' }).select('title').limit(1000).lean(),
    User.find({ role: 'TECHNICIAN', active: true }).select('name').limit(1000).lean(),
  ]);
  return {
    products: products.map((p) => ({ value: String(p._id), label: p.name + ' · ' + p.sku })),
    categories: categories.map((c) => ({ value: c.slug, label: c.name })),
    machines: machines.map((m) => ({ value: String(m._id), label: m.name })),
    models: models.map((m) => ({ value: String(m._id), label: m.title })),
    technicians: technicians.map((t) => ({ value: String(t._id), label: t.name })),
  };
}
