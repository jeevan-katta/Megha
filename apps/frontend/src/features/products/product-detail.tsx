'use client';

import { PageTitle } from '@/components/layout/page-title';
import { ButtonLink } from '@/components/ui/button-link';
import { Empty } from '@/components/ui/empty-state';
import { Img } from '@/components/ui/image';
import { Heading } from '@/components/ui/section-heading';
import { ProductCard } from '@/features/products/product-card';
import { money } from '@/lib/format';
import { useStore } from '@/providers/store-provider';
import type { Product } from '@megha/types';
import { ArrowRight, ShieldCheck, ShoppingCart } from 'lucide-react';
import Link from 'next/link';

export function ProductDetail({ slug, initial }: { slug: string; initial?: Product }) {
  const { catalogue, catalogueLoading, catalogueError, add, runtime } = useStore();
  // Live catalogue data once loaded; the server-rendered product until then. A product missing
  // from a loaded catalogue has been withdrawn, so the cached copy is not shown.
  const p =
    catalogue.products.find((p) => p.slug === slug) ??
    (catalogueLoading || catalogueError ? initial : undefined);
  if (!p) return <Empty title="Product not found" href="/spare-parts" label="Browse parts" />;
  const available = Math.max(0, p.stock - p.reserved);
  const stock =
    available < 1
      ? { tone: 'out', text: 'Out of stock' }
      : available <= p.threshold
        ? { tone: 'low', text: `Only ${available} left` }
        : { tone: '', text: 'In stock' };
  return (
    <div className="container page">
      <PageTitle title={p.name} breadcrumbOnly />
      <div className="detail-layout">
        <div className="detail-image">
          <Img src={p.image} alt={p.name} />
        </div>
        <div>
          <span className={'stock ' + stock.tone}>
            <i />
            {stock.text}
            {runtime.development && ' · Development inventory'}
          </span>
          <h1>{p.name}</h1>
          <p className="muted">
            SKU: {p.sku} · Part no: {p.partNumber}
          </p>
          <p>{p.description}</p>
          <strong className="detail-price">{money(p.price)}</strong>
          <p className="muted">
            Excludes GST ({p.gstRate}%).
            {runtime.development && ' Reference price for local testing.'}
          </p>
          <div className="actions">
            <button onClick={() => add(p)} disabled={available < 1}>
              <ShoppingCart size={18} /> {available < 1 ? 'Out of Stock' : 'Add to Cart'}
            </button>
            <ButtonLink href={'/bulk-quote?item=' + encodeURIComponent(p.name)} secondary>
              Send Enquiry
            </ButtonLink>
          </div>
          <div className="help-box">
            <ShieldCheck />
            <h3>Confirm compatibility before ordering</h3>
            <p>No verified model compatibility has been supplied for this reference product.</p>
            <Link href="/find-my-spare">
              Ask our technical team <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>
      <section className="section">
        <Heading title="Related Spare Parts" />
        <div className="product-grid home-products">
          {catalogue.products
            .filter((x) => x._id !== p._id)
            .slice(0, 6)
            .map((p) => (
              <ProductCard p={p} key={p._id} />
            ))}
        </div>
      </section>
    </div>
  );
}
