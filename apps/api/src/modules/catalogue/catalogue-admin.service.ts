import {
  adminCategorySchema,
  adminMachineSchema,
  adminProductSchema,
  compatibilitySchema,
  machineModelSchema,
} from '@megha/validation';
import { DomainError } from '../../shared/errors/domain-error';
import { Category } from '../categories/category.model';
import { Compatibility } from '../compatibility/compatibility.model';
import { Machine } from '../machines/machine.model';
import { Product } from '../products/product.model';
import { Entity } from '../records/record.model';

export async function saveCatalogue(module: string, input: unknown, actorId: string, id?: string) {
  const options = { new: true, runValidators: true };
  if (module === 'products') {
    const data = adminProductSchema.parse(input);
    if (!(await Category.exists({ slug: data.category })))
      throw new DomainError('INVALID_CATEGORY', 'Choose an existing category.');
    return id
      ? Product.findByIdAndUpdate(id, { $set: data }, options)
      : Product.create({ ...data, stock: 0, reserved: 0 });
  }
  if (module === 'categories') {
    const data = adminCategorySchema.parse(input);
    if (id) {
      const current = await Category.findById(id);
      if (
        current &&
        current.slug !== data.slug &&
        (await Product.exists({ category: current.slug }))
      )
        throw new DomainError(
          'CATEGORY_IN_USE',
          'The slug cannot change while products use this category.',
          409,
        );
    }
    return id ? Category.findByIdAndUpdate(id, { $set: data }, options) : Category.create(data);
  }
  if (module === 'machines') {
    const data = adminMachineSchema.parse(input);
    return id ? Machine.findByIdAndUpdate(id, { $set: data }, options) : Machine.create(data);
  }
  if (module === 'machine-models') {
    const data = machineModelSchema.parse(input);
    if (!(await Machine.exists({ _id: data.data.machineId })))
      throw new DomainError('INVALID_MACHINE', 'Choose an existing machine.');
    return id
      ? Entity.findOneAndUpdate({ _id: id, kind: module }, { $set: data }, options)
      : Entity.create({ ...data, kind: module });
  }
  if (module === 'compatibility') {
    const data = compatibilitySchema.parse(input);
    if (
      !(await Product.exists({ _id: data.productId })) ||
      !(await Entity.exists({ _id: data.machineModelId, kind: 'machine-models' }))
    )
      throw new DomainError(
        'INVALID_COMPATIBILITY',
        'Choose an existing product and machine model.',
      );
    const record = {
      ...data,
      verifiedBy: data.verified ? actorId : undefined,
      verifiedAt: data.verified ? new Date() : undefined,
    };
    return id
      ? Compatibility.findByIdAndUpdate(id, { $set: record }, options)
      : Compatibility.create(record);
  }
  throw new DomainError('UNSUPPORTED_MODULE', 'Catalogue module not supported.');
}
