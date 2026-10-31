export interface PaymentSession {
  provider: 'development' | 'razorpay';
  orderId: string;
  key?: string;
  providerOrderId?: string;
  amount: number;
  currency?: string;
  testMode?: boolean;
}
export interface RazorpayResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}
interface CheckoutInstance {
  open(): void;
  close(): void;
  on(
    event: 'payment.failed',
    callback: (result: { error: { description?: string } }) => void,
  ): void;
}
interface CheckoutOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill: { name: string; email: string; contact: string };
  theme: { color: string };
  handler: (result: RazorpayResult) => void;
  modal: { ondismiss: () => void };
  retry: { enabled: boolean };
}
declare global {
  interface Window {
    Razorpay?: new (options: CheckoutOptions) => CheckoutInstance;
  }
}
let loading: Promise<void> | undefined;
function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = setTimeout(() => {
      script.remove();
      reject(new Error('Payment checkout timed out. Please retry.'));
    }, 20000);
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      clearTimeout(timeout);
      if (window.Razorpay) resolve();
      else reject(new Error('Payment checkout could not be loaded.'));
    };
    script.onerror = () => {
      clearTimeout(timeout);
      script.remove();
      reject(new Error('Unable to load Razorpay. Check your connection and retry.'));
    };
    document.head.appendChild(script);
  }).catch((error) => {
    loading = undefined;
    throw error;
  });
  return loading;
}
export async function openRazorpay(
  session: PaymentSession,
  customer: { name: string; email: string; phone: string },
): Promise<RazorpayResult> {
  await loadCheckout();
  if (!session.key || !session.providerOrderId || !window.Razorpay)
    throw new Error('Payment details are incomplete. Please retry.');
  const Razorpay = window.Razorpay;
  return new Promise((resolve, reject) => {
    let settled = false;
    const checkout = new Razorpay({
      key: session.key!,
      order_id: session.providerOrderId!,
      amount: session.amount,
      currency: session.currency ?? 'INR',
      name: 'Megha Laundry Equipment',
      description: session.testMode
        ? 'Test payment — no real money collected'
        : 'Laundry spare parts',
      prefill: { name: customer.name, email: customer.email, contact: customer.phone },
      theme: { color: '#0769c9' },
      retry: { enabled: false },
      handler: (result) => {
        settled = true;
        resolve(result);
      },
      modal: {
        ondismiss: () => {
          if (!settled)
            reject(new Error('Payment window closed. Your order is saved; you can retry payment.'));
        },
      },
    });
    checkout.on('payment.failed', (result) => {
      settled = true;
      checkout.close();
      reject(new Error(result.error.description ?? 'Payment failed. Please try again.'));
    });
    checkout.open();
  });
}
