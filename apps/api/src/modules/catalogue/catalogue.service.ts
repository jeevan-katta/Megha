import { services } from '../../core/seed-data';
import { Category } from '../categories/category.model';
import { Machine } from '../machines/machine.model';
import { productRepository } from '../products/product.repository';
export async function catalogue() {
  const [products, categories, machines] = await Promise.all([
    productRepository.featured(),
    Category.find().lean(),
    Machine.find({ active: true }).lean(),
  ]);
  return { products, categories, machines, services };
}
