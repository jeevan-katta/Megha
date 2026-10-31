'use client';

import { PageTitle } from '@/components/layout/page-title';
import { ButtonLink } from '@/components/ui/button-link';
import { Empty } from '@/components/ui/empty-state';
import { Img } from '@/components/ui/image';
import { Heading } from '@/components/ui/section-heading';
import { Summary } from '@/features/checkout/order-summary';
import { ProductCard } from '@/features/products/product-card';
import { api } from '@/lib/api-client';
import { money } from '@/lib/format';
import { useStore } from '@/providers/store-provider';
import { type Totals, type DeliveryOption } from '@megha/types';
import { ArrowLeft, ArrowRight, Minus, Plus, ShieldCheck, Trash2, Truck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export function Cart() {
  const { cart, setCart, catalogue, notice, runtime } = useStore();
  const [totals, setTotals] = useState<Totals | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    if (cart.length)
      api<Totals>('/checkout/validate', { items: cart }, 'POST', controller.signal)
        .then((t) => {
          setTotals(t);
          setError('');
        })
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        });
    else setTotals(null);
    return () => controller.abort();
  }, [cart]);
  const change = (id: string, n: number) =>
    setCart(
      cart.map((i) => (i.productId === id ? { ...i, quantity: Math.max(1, Math.min(100, n)) } : i)),
    );
  return (
    <div className="container page">
      <PageTitle title={'Your Cart (' + cart.length + ' Items)'} />
      {!cart.length ? (
        <Empty
          title="Your cart is empty"
          text="Explore spare parts for your laundry equipment."
          href="/spare-parts"
          label="Shop Spare Parts"
        />
      ) : (
        <>
          <div className="panel cart-table">
            <div className="cart-head">
              <span>Product</span>
              <span>Price</span>
              <span>Quantity</span>
              <span>Total</span>
              <span />
            </div>
            {cart.map((item) => {
              const p = catalogue.products.find((p) => p._id === item.productId);
              if (!p) return null;
              return (
                <div className="cart-row" key={p._id}>
                  <div className="cart-product">
                    <Img src={p.image} alt={p.name} />
                    <div>
                      <Link href={'/product/' + p.slug}>
                        <h3>{p.name}</h3>
                      </Link>
                      <p>Part No: {p.sku}</p>
                      <p>For industrial laundry equipment</p>
                      <span className="badge green">In Stock</span>
                    </div>
                  </div>
                  <strong>{money(p.price)}</strong>
                  <div className="quantity">
                    <button
                      aria-label={'Decrease ' + p.name}
                      onClick={() => change(p._id, item.quantity - 1)}
                      disabled={item.quantity === 1}
                    >
                      <Minus size={14} />
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      aria-label={'Increase ' + p.name}
                      onClick={() => change(p._id, item.quantity + 1)}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <strong>{money(p.price * item.quantity)}</strong>
                  <button
                    className="remove"
                    aria-label={'Remove ' + p.name}
                    onClick={() => setCart(cart.filter((i) => i.productId !== p._id))}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              );
            })}
            <div className="cart-bottom">
              <button className="secondary" onClick={() => setCart([])}>
                <Trash2 size={16} />
                Clear Cart
              </button>
              <ButtonLink href="/spare-parts" secondary>
                <ArrowLeft size={16} />
                Continue Shopping
              </ButtonLink>
            </div>
          </div>
          {error && <p className="error">{error}</p>}
          <div className="cart-lower">
            <div>
              <form
                className="shipping-box"
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    const rates = await api<DeliveryOption[]>('/checkout/shipping-rates', {
                      pincode: new FormData(e.currentTarget).get('pincode'),
                      items: cart,
                    });
                    notice(
                      (runtime.development ? 'Test delivery: ' : 'Delivery: ') +
                        rates
                          .map(
                            (rate) =>
                              rate.label +
                              ' ' +
                              money(rate.amount) +
                              (rate.etaDays ? ' (' + rate.etaDays + ' days)' : ''),
                          )
                          .join(' · '),
                    );
                  } catch (e) {
                    notice((e as Error).message);
                  }
                }}
              >
                <h3>
                  <Truck />
                  Estimate Shipping
                </h3>
                <div className="inline-form">
                  <input
                    aria-label="Shipping PIN code"
                    name="pincode"
                    pattern="[1-9][0-9]{5}"
                    required
                    placeholder="Enter your pincode"
                  />
                  <button>Check</button>
                </div>
              </form>
              <div className="section">
                <Heading title="You may also like" />
                <div className="product-grid recommendations">
                  {catalogue.products
                    .filter((p) => !cart.some((i) => i.productId === p._id))
                    .slice(0, 4)
                    .map((p) => (
                      <ProductCard p={p} key={p._id} />
                    ))}
                </div>
              </div>
            </div>
            <div>
              <Summary totals={totals} />
              <ButtonLink href="/checkout">
                Proceed to Checkout <ArrowRight size={17} />
              </ButtonLink>
              <p className="secure">
                <ShieldCheck size={18} />{' '}
                {runtime.development
                  ? 'Test checkout · No real money collected'
                  : 'Secure checkout'}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
