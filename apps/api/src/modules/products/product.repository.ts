import { config } from '../../config';
import { Product } from './product.model';
export interface ProductQuery {
  q?: string;
  category?: string;
  sort?: string;
  page: number;
  limit: number;
}
function filterFor(query: ProductQuery) {
  const filter: Record<string, unknown> = {
    active: true,
    ...(!config.development ? { developmentOnly: { $ne: true } } : {}),
  };
  if (query.category) filter.category = query.category;
  if (query.q) {
    const literal = query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = ['name', 'sku', 'partNumber', 'keywords'].map((field) => ({
      [field]: { $regex: literal, $options: 'i' },
    }));
  }
  return filter;
}
export const productRepository = {
  featured: () =>
    Product.find(filterFor({ page: 1, limit: 100 }))
      .limit(100)
      .lean(),
  bySlug: (slug: string) => Product.findOne({ ...filterFor({ page: 1, limit: 1 }), slug }).lean(),
  list: (query: ProductQuery) => {
    const sort: Record<string, 1 | -1> =
      query.sort === 'price-asc'
        ? { price: 1, _id: 1 }
        : query.sort === 'price-desc'
          ? { price: -1, _id: 1 }
          : { featured: -1, name: 1 };
    return Product.find(filterFor(query))
      .sort(sort)
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean();
  },
  count: (query: ProductQuery) => Product.countDocuments(filterFor(query)),
};
