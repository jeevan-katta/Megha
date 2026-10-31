'use client';

import { PageTitle } from '@/components/layout/page-title';
import { ButtonLink } from '@/components/ui/button-link';
import { Empty } from '@/components/ui/empty-state';
import { ProductCard } from '@/features/products/product-card';
import { useCatalogue } from '@/providers/store-provider';
import { Headphones, SlidersHorizontal } from 'lucide-react';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useState, useMemo } from 'react';

export function CataloguePage() {
  return (
    <Suspense
      fallback={
        <div className="container page" role="status">
          Loading products…
        </div>
      }
    >
      <CatalogueRoute />
    </Suspense>
  );
}

function CatalogueRoute() {
  const params = useParams<{ category?: string }>();
  const search = useSearchParams();
  const category = params.category || search.get('category') || '';
  const query = search.get('q') || '';
  return (
    <CatalogueResults
      key={category + ':' + query}
      initialCategory={category}
      initialQuery={query}
    />
  );
}

function CatalogueResults({
  initialCategory,
  initialQuery,
}: {
  initialCategory: string;
  initialQuery: string;
}) {
  const catalogue = useCatalogue();
  const [q, setQ] = useState(initialQuery),
    [category, setCategory] = useState(initialCategory),
    [sort, setSort] = useState('featured');
  const products = useMemo(
    () =>
      catalogue.products
        .filter(
          (p) =>
            (!category || p.category === category) &&
            [p.name, p.sku, p.partNumber, ...p.keywords]
              .join(' ')
              .toLowerCase()
              .includes(q.toLowerCase()),
        )
        .sort((a, b) =>
          sort === 'price-asc' ? a.price - b.price : sort === 'price-desc' ? b.price - a.price : 0,
        ),
    [catalogue.products, category, q, sort],
  );
  return (
    <div className="container page">
      <PageTitle
        title="Spare Parts"
        subtitle="Find the right parts for your industrial laundry equipment."
      />
      <div className="catalogue-layout">
        <aside className="filter-panel">
          <h3>
            <SlidersHorizontal size={18} /> Filter Products
          </h3>
          <label>
            Category
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {catalogue.categories.map((c) => (
                <option key={c._id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="help-box">
            <Headphones />
            <h3>Need help finding a part?</h3>
            <p>Our technical team can help you identify your spare.</p>
            <ButtonLink href="/find-my-spare" secondary>
              Find My Spare
            </ButtonLink>
          </div>
        </aside>
        <div>
          <div className="catalogue-toolbar">
            <input
              aria-label="Filter parts"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, SKU or part number"
            />
            <select
              aria-label="Sort products"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="featured">Featured products</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
          </div>
          <p className="muted">{products.length} products found</p>
          {products.length ? (
            <div className="product-grid catalogue-products">
              {products.map((p) => (
                <ProductCard key={p._id} p={p} />
              ))}
            </div>
          ) : (
            <Empty
              title="No matching parts found"
              text="Try a different term, or ask our technical team."
              href="/find-my-spare"
              label="Find My Spare"
            />
          )}
        </div>
      </div>
    </div>
  );
}
