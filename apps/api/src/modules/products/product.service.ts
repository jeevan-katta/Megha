import { DomainError } from '../../shared/errors/domain-error';
import { Compatibility } from '../compatibility/compatibility.model';
import { productRepository, type ProductQuery } from './product.repository';
export async function listProducts(query: ProductQuery) {
  const [data, total] = await Promise.all([
    productRepository.list(query),
    productRepository.count(query),
  ]);
  return { data, meta: { total, page: query.page, limit: query.limit } };
}
export async function getProduct(slug: string) {
  const product = await productRepository.bySlug(slug);
  if (!product) throw new DomainError('NOT_FOUND', 'Product not found.', 404);
  return {
    product,
    compatibility: await Compatibility.find({
      productId: String(product._id),
      verified: true,
    }).lean(),
  };
}
