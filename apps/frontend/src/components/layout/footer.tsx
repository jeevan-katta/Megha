'use client';
import { useStore } from '@/providers/store-provider';

import { Img } from '@/components/ui/image';
import { Mail, MapPin, Phone } from 'lucide-react';
import Link from 'next/link';

export function Footer() {
  const { runtime } = useStore();
  const settings = runtime.publicSettings ?? {};
  return (
    <footer>
      <div className="container footer-grid">
        <div>
          <Img src="/assets/logo-mark.webp" alt="Megha" />
          <h3>Megha Laundry Equipment</h3>
          <p>Industrial laundry equipment, spare parts and after-sales support.</p>
        </div>
        <div>
          <h3>Quick Links</h3>
          {[
            ['Home', '/'],
            ['Spare Parts', '/spare-parts'],
            ['Laundry Machines', '/machines'],
            ['Services', '/services'],
            ['About Us', '/about'],
            ['Contact Us', '/contact'],
          ].map(([n, h]) => (
            <Link href={h} key={n}>
              {n}
            </Link>
          ))}
        </div>
        <div>
          <h3>Customer Support</h3>
          {[
            ['My Account', '/account'],
            ['Track Order', '/account/orders'],
            ['Send an Enquiry', '/bulk-quote'],
            ['Service Request', '/services'],
            ['FAQs', '/faq'],
            ['Shipping & Delivery', '/policies/shipping'],
          ].map(([n, h]) => (
            <Link href={h} key={n}>
              {n}
            </Link>
          ))}
        </div>
        <div>
          <h3>Contact Information</h3>
          <p>
            <MapPin size={15} /> {settings.business_address || 'Secunderabad, Telangana, India'}
          </p>
          <Link href="/contact">
            <Mail size={15} /> Send an enquiry
          </Link>
          <Link href="/services">
            <Phone size={15} /> Request a callback
          </Link>
          <Link href="/admin">Staff administration</Link>
          {settings.support_email && (
            <p>
              <Mail size={15} />
              {settings.support_email}
            </p>
          )}
          {settings.support_phone && (
            <p>
              <Phone size={15} />
              {settings.support_phone}
            </p>
          )}
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} Megha Laundry Equipment. All rights reserved.</span>
        <div>
          <Link href="/policies/privacy">Privacy Policy</Link>
          <Link href="/policies/terms">Terms & Conditions</Link>
          <Link href="/policies/returns">Return Policy</Link>
        </div>
      </div>
    </footer>
  );
}
