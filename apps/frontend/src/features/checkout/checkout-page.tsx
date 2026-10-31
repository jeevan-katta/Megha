'use client';

import { PageTitle } from '@/components/layout/page-title';
import { Empty } from '@/components/ui/empty-state';
import { Login } from '@/features/auth/login-form';
import { Summary } from '@/features/checkout/order-summary';
import { payOrder } from '@/features/payments/pay-order';
import { api, ApiError } from '@/lib/api-client';
import { money } from '@/lib/format';
import { useStore } from '@/providers/store-provider';
import { type DeliveryOption, type Order, type Totals } from '@megha/types';
import { ArrowRight, Truck, Zap } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { emailInput, gstinInput, phoneInput } from '@/lib/input-patterns';
import { AddressFields } from './address-fields';

const pincodePattern = /^[1-9][0-9]{5}$/;
const read = (f: FormData, prefix: string) => ({
  line1: String(f.get(prefix + 'line1') ?? ''),
  ...(f.get(prefix + 'line2') ? { line2: String(f.get(prefix + 'line2')) } : {}),
  city: String(f.get(prefix + 'city') ?? ''),
  state: String(f.get(prefix + 'state') ?? ''),
  pincode: String(f.get(prefix + 'pincode') ?? ''),
});

export function Checkout() {
  const { user, cart, setCart, authLoading, runtime } = useStore();
  const router = useRouter();
  const [totals, setTotals] = useState<Totals | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [key] = useState(() => crypto.randomUUID()),
    [savedOrder, setSavedOrder] = useState<Order | null>(null),
    [pincode, setPincode] = useState(''),
    [options, setOptions] = useState<DeliveryOption[] | null>(null),
    [optionsError, setOptionsError] = useState(''),
    [service, setService] = useState<'standard' | 'express'>('standard'),
    [sameBilling, setSameBilling] = useState(true),
    // Bumped to fetch fresh totals, e.g. after the server reports a price change.
    [refresh, setRefresh] = useState(0);
  const validPincode = pincodePattern.test(pincode);
  // Delivery options for the entered PIN code, priced by the server.
  useEffect(() => {
    if (!validPincode || !cart.length) return;
    const controller = new AbortController();
    api<DeliveryOption[]>(
      '/checkout/shipping-rates',
      { pincode, items: cart },
      'POST',
      controller.signal,
    )
      .then((result) => {
        setOptions(result);
        setOptionsError('');
        setService((current) => (result.some((o) => o.service === current) ? current : 'standard'));
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setOptions([]);
        setOptionsError(e.message);
      });
    return () => controller.abort();
  }, [pincode, validPincode, cart]);
  // Totals always come from the server, including the chosen delivery option.
  useEffect(() => {
    const controller = new AbortController();
    if (cart.length)
      api<Totals>(
        '/checkout/validate',
        {
          items: cart,
          ...(validPincode && options?.length ? { pincode, shippingService: service } : {}),
        },
        'POST',
        controller.signal,
      )
        .then(setTotals)
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        });
    return () => controller.abort();
  }, [cart, pincode, validPincode, options, service, refresh]);
  if (authLoading)
    return (
      <div className="container page" role="status">
        Loading checkout…
      </div>
    );
  if (!runtime.checkoutEnabled)
    return (
      <Empty
        title="Online checkout is unavailable"
        text="Please send an enquiry and our team will help you complete your purchase."
        href="/bulk-quote"
        label="Send Enquiry"
      />
    );
  if (!user)
    return (
      <div className="container page">
        <PageTitle title="Checkout" />
        <Login returnTo="/checkout" />
      </div>
    );
  if (!cart.length && !savedOrder)
    return <Empty title="Your cart is empty" href="/spare-parts" label="Shop Spare Parts" />;
  const ready = !!totals?.shippingQuoted && !!options?.length;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const f = new FormData(e.currentTarget);
    try {
      const o =
        savedOrder ??
        (await api<Order>('/orders', {
          items: cart,
          idempotencyKey: key,
          customer: {
            name: f.get('name'),
            email: f.get('email'),
            phone: f.get('phone'),
            company: f.get('company') || undefined,
            gstin: f.get('gstin') || '',
          },
          address: read(f, ''),
          ...(sameBilling ? {} : { billingAddress: read(f, 'billing_') }),
          shippingService: service,
          expectedTotal: totals?.total,
        }));
      setSavedOrder(o);
      await payOrder(o);
      setCart([]);
      router.push('/order/success/' + o._id);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'PRICE_CHANGED') setRefresh((n) => n + 1);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="container page">
      <PageTitle
        title="Secure Checkout"
        subtitle={
          runtime.development || runtime.testPayments
            ? 'Test checkout. No real payment will be collected.'
            : 'Confirm your details and continue to secure payment.'
        }
      />
      <div className="checkout-layout">
        <form className="panel checkout-form" onSubmit={submit}>
          <fieldset disabled={!!savedOrder || busy}>
            <h2>Contact</h2>
            <div className="form-grid">
              <label>
                Full name
                <input
                  name="name"
                  defaultValue={user.name}
                  required
                  minLength={2}
                  maxLength={100}
                />
              </label>
              <label>
                Email
                <input name="email" {...emailInput} defaultValue={user.email} required />
              </label>
              <label>
                Phone number
                <input name="phone" required {...phoneInput} defaultValue={user.phone ?? ''} />
              </label>
            </div>
            <h2>Shipping address</h2>
            <div className="form-grid">
              <AddressFields
                prefix=""
                onPincode={(value) => {
                  setPincode(value);
                  setOptions(null);
                }}
              />
            </div>
            <h2>Billing &amp; GST</h2>
            <div className="form-grid">
              <label>
                Company (optional)
                <input name="company" maxLength={150} defaultValue={user.company ?? ''} />
              </label>
              <label>
                GSTIN (optional)
                <input name="gstin" {...gstinInput} defaultValue={user.gstin ?? ''} />
              </label>
            </div>
            <label className="check-label">
              <input
                type="checkbox"
                checked={sameBilling}
                onChange={(e) => setSameBilling(e.target.checked)}
              />
              Billing address is the same as shipping
            </label>
            {!sameBilling && (
              <div className="form-grid">
                <AddressFields prefix="billing_" />
              </div>
            )}
            <h2>Delivery</h2>
            {!validPincode ? (
              <p className="muted">Enter your PIN code to see delivery options.</p>
            ) : options === null ? (
              <p className="muted" role="status">
                Checking delivery options…
              </p>
            ) : optionsError || !options.length ? (
              <p className="error" role="alert">
                {optionsError || 'Delivery is not available to this PIN code yet.'}
              </p>
            ) : (
              <div className="delivery-options" role="radiogroup" aria-label="Delivery option">
                {options.map((option) => (
                  <label
                    key={option.service}
                    className={'delivery-option' + (service === option.service ? ' selected' : '')}
                  >
                    <input
                      type="radio"
                      name="delivery"
                      value={option.service}
                      checked={service === option.service}
                      onChange={() => setService(option.service)}
                    />
                    {option.service === 'express' ? <Zap size={18} /> : <Truck size={18} />}
                    <span>
                      <strong>{option.label}</strong>
                      <small>
                        {option.etaDays
                          ? 'Estimated ' +
                            option.etaDays +
                            ' day' +
                            (option.etaDays === 1 ? '' : 's')
                          : 'Estimate shared after dispatch'}
                      </small>
                    </span>
                    <b>{money(option.amount)}</b>
                  </label>
                ))}
              </div>
            )}
            {(runtime.development || runtime.testPayments) && (
              <label className="check-label">
                <input type="checkbox" required />I understand this is a test order. No real payment
                will be collected.
              </label>
            )}
          </fieldset>
          {savedOrder && (
            <p className="muted">
              Order {savedOrder.number} is saved.{' '}
              <Link href={'/order/success/' + savedOrder._id}>View order</Link>
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button disabled={busy || (!savedOrder && !ready)}>
            {busy
              ? 'Processing…'
              : savedOrder
                ? 'Retry Payment'
                : runtime.development || runtime.testPayments
                  ? 'Pay with Razorpay (Test)'
                  : 'Continue to Payment'}
            <ArrowRight size={18} />
          </button>
        </form>
        <Summary totals={totals} />
      </div>
    </div>
  );
}
