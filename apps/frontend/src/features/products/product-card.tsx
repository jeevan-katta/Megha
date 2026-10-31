'use client';

import { Img } from '@/components/ui/image';
import { api } from '@/lib/api-client';
import { money } from '@/lib/format';
import { useProductActions } from '@/providers/store-provider';
import { memo, useState } from 'react';
import { type Product } from '@megha/types';
import { Heart, ShoppingCart } from 'lucide-react';
import Link from 'next/link';

export const ProductCard = memo(function ProductCard({ p }: { p: Product }) {
  const { add, notice, user } = useProductActions();
  const [saving, setSaving] = useState(false);
  return (
    <article className="product-card">
      <button
        className="wishlist"
        aria-label={'Save ' + p.name}
        aria-busy={saving}
        disabled={saving}
        onClick={async () => {
          if (!user) return notice('Sign in to save products.');
          setSaving(true);
          try {
            await api('/me/records/saved', { title: p.name, data: { productId: p._id } });
            notice('Product saved to your account.');
          } catch (e) {
            notice((e as Error).message);
          } finally {
            setSaving(false);
          }
        }}
      >
        <Heart size={18} />
      </button>
      <Link href={'/product/' + p.slug}>
        <Img src={p.image} alt={p.name} />
        <h3>{p.name}</h3>
        <p>{p.category.replaceAll('-', ' ')}</p>
      </Link>
      <strong className="price">{money(p.price)}</strong>
      <div className="product-bottom">
        <span className="stock">
          <i /> {p.stock - p.reserved > 0 ? 'In stock' : 'Out of stock'}
        </span>
        <button
          aria-label={'Add ' + p.name + ' to cart'}
          disabled={p.stock - p.reserved < 1}
          onClick={() => add(p)}
        >
          <ShoppingCart size={17} />
        </button>
      </div>
    </article>
  );
});
