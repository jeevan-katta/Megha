'use client';

import { Img } from '@/components/ui/image';
import { useStore } from '@/providers/store-provider';
import { Menu, Search, ShoppingCart, UserRound } from 'lucide-react';
import { accountQuery } from '@/features/account/use-account-data';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

export function Header() {
  const { cart, user, runtime } = useStore();
  const client = useQueryClient();
  // Start loading account orders as the pointer reaches the account link.
  const prefetchAccount = () => {
    if (user) void client.prefetchQuery(accountQuery('orders', user._id));
  };
  const router = useRouter();
  const path = usePathname();
  const [q, setQ] = useState(''),
    [menu, setMenu] = useState(false);
  return (
    <>
      <div className="utility">
        <div className="container">
          <span>
            {runtime.publicSettings?.announcement ||
              'Industrial Laundry Equipment Manufacturer & Supplier'}
          </span>
          <div>
            <Link href="/about">About Us</Link>
            <Link href="/contact">Support</Link>
            <Link href="/account/orders">Track Order</Link>
            <Link href="/contact">Contact</Link>
          </div>
        </div>
      </div>
      <header>
        <div className="container header-main">
          <button
            className="mobile-menu icon-button"
            onClick={() => setMenu(!menu)}
            aria-label="Toggle menu"
          >
            <Menu />
          </button>
          <Link className="brand" href="/">
            <Img src="/assets/logo-mark.webp" alt="Megha" priority />
            <span>
              <strong>Megha Laundry Equipment</strong>
              <small>Industrial Laundry Solutions</small>
            </span>
          </Link>
          <form
            className="searchbox"
            onSubmit={(e) => {
              e.preventDefault();
              router.push('/search?q=' + encodeURIComponent(q));
            }}
          >
            <input
              aria-label="Search spare parts"
              placeholder="Search spare parts, machines, part number…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button aria-label="Search">
              <Search size={21} />
            </button>
          </form>
          <Link
            href="/account"
            className="header-action"
            onPointerEnter={prefetchAccount}
            onPointerDown={prefetchAccount}
            onFocus={prefetchAccount}
          >
            <UserRound />
            <span>
              <small>{user ? 'Welcome' : 'Login'}</small>
              {user ? user.name.split(' ')[0] : 'My Account'}
            </span>
          </Link>
          <Link href="/cart" className="header-action cart-icon">
            <ShoppingCart />
            <b>{cart.reduce((s, i) => s + i.quantity, 0)}</b>
            <span>Cart</span>
          </Link>
        </div>
        <nav
          className={'container navigation ' + (menu ? 'open' : '')}
          onClick={() => setMenu(false)}
        >
          {[
            ['Spare Parts', '/spare-parts'],
            ['Laundry Machines', '/machines'],
            ['Services', '/services'],
            ['Find My Spare', '/find-my-spare'],
          ].map(([n, h]) => (
            <Link key={n} href={h} aria-current={path.startsWith(h) ? 'page' : undefined}>
              {n}
            </Link>
          ))}
          <Link href="/bulk-quote" className="button nav-enquiry">
            Enquiry
          </Link>
        </nav>
      </header>
    </>
  );
}
