'use client';
import { api, ApiError } from '@/lib/api-client';
import type { CartItem, Catalogue, Product, User } from '@megha/types';
import { storedCartSchema } from '@megha/validation';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

interface RuntimeConfig {
  development: boolean;
  testPayments: boolean;
  checkoutEnabled: boolean;
  paymentProvider: string;
  publicSettings?: Record<string, string>;
}
interface StoreState {
  catalogue: Catalogue;
  catalogueLoading: boolean;
  catalogueError: string;
  reloadCatalogue: () => void;
  cart: CartItem[];
  setCart: (items: CartItem[]) => void;
  add: (product: Product) => void;
  user: User | null;
  setUser: (user: User | null) => void;
  authLoading: boolean;
  toast: string;
  notice: (message: string) => void;
  dismissNotice: () => void;
  runtime: RuntimeConfig;
}
const emptyCatalogue: Catalogue = { products: [], machines: [], categories: [], services: [] };
const Context = createContext<StoreState | null>(null);
const ProductActionsContext = createContext<Pick<StoreState, 'add' | 'notice' | 'user'> | null>(
  null,
);
const CatalogueContext = createContext<Catalogue>(emptyCatalogue);
export function useProductActions() {
  const value = useContext(ProductActionsContext);
  if (!value) throw new Error('useProductActions requires StoreProvider');
  return value;
}
export function useCatalogue() {
  return useContext(CatalogueContext);
}
export function useStore() {
  const value = useContext(Context);
  if (!value) throw new Error('useStore requires StoreProvider');
  return value;
}
export function StoreProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [catalogue, setCatalogue] = useState(emptyCatalogue);
  const [catalogueLoading, setCatalogueLoading] = useState(true),
    [catalogueError, setCatalogueError] = useState('');
  const [user, setUserState] = useState<User | null>(null),
    [authLoading, setAuthLoading] = useState(true);
  const [cart, setCartState] = useState<CartItem[]>([]),
    [toast, setToast] = useState('');
  const [runtime, setRuntime] = useState<RuntimeConfig>({
    development: false,
    testPayments: false,
    checkoutEnabled: false,
    paymentProvider: 'disabled',
  });
  const cartRef = useRef<CartItem[]>([]);
  const notice = useCallback((message: string) => setToast(message), []);
  const dismissNotice = useCallback(() => setToast(''), []);
  const setCart = useCallback(
    (items: CartItem[]) => {
      const parsed = storedCartSchema.parse(items);
      if (JSON.stringify(parsed) === JSON.stringify(cartRef.current)) return;
      cartRef.current = parsed;
      setCartState(parsed);
      try {
        localStorage.setItem('megha-cart', JSON.stringify(parsed));
      } catch {
        notice('Browser storage is unavailable. Your cart will last for this visit.');
      }
    },
    [notice],
  );
  const reloadCatalogue = useCallback(() => {
    setCatalogueLoading(true);
    setCatalogueError('');
    api<Catalogue>('/catalogue')
      .then(setCatalogue)
      .catch((error) => setCatalogueError(error.message))
      .finally(() => setCatalogueLoading(false));
  }, []);
  useEffect(() => {
    reloadCatalogue();
    api<RuntimeConfig>('/config')
      .then(setRuntime)
      .catch(() => {
        /* Checkout remains disabled if configuration is unavailable. */
      });
    api<User>('/me')
      .then(setUserState)
      .catch((error) => {
        if (!(error instanceof ApiError && error.status === 401))
          notice('Account could not be loaded. Please sign in again.');
      })
      .finally(() => setAuthLoading(false));
    try {
      const saved = storedCartSchema.safeParse(
        JSON.parse(localStorage.getItem('megha-cart') || '[]'),
      );
      if (saved.success) {
        cartRef.current = saved.data;
        setCartState(saved.data);
      }
    } catch {
      /* Discard invalid browser storage. */
    }
  }, [reloadCatalogue, notice]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(dismissNotice, 4500);
    return () => clearTimeout(timer);
  }, [toast, dismissNotice]);
  const setUser = useCallback(
    (value: User | null) => {
      queryClient.removeQueries({ queryKey: ['private'] });
      setUserState(value);
    },
    [queryClient],
  );
  const add = useCallback(
    (product: Product) => {
      const current = cartRef.current,
        old = current.find((item) => item.productId === product._id);
      const available = Math.min(product.stock - product.reserved, 100);
      if (available < 1) {
        notice(product.name + ' is out of stock.');
        return;
      }
      if ((old?.quantity || 0) >= available) {
        notice(`Only ${available} of ${product.name} available. Your cart already has them all.`);
        return;
      }
      setCart(
        old
          ? current.map((item) =>
              item.productId === product._id ? { ...item, quantity: item.quantity + 1 } : item,
            )
          : [...current, { productId: product._id, quantity: 1 }],
      );
      notice(product.name + ' added to your cart.');
    },
    [notice, setCart],
  );
  const productActions = useMemo(() => ({ add, notice, user }), [add, notice, user]);
  return (
    <Context.Provider
      value={{
        catalogue,
        catalogueLoading,
        catalogueError,
        reloadCatalogue,
        cart,
        setCart,
        add,
        user,
        setUser,
        authLoading,
        toast,
        notice,
        dismissNotice,
        runtime,
      }}
    >
      <CatalogueContext.Provider value={catalogue}>
        <ProductActionsContext.Provider value={productActions}>
          {children}
        </ProductActionsContext.Provider>
      </CatalogueContext.Provider>
    </Context.Provider>
  );
}
