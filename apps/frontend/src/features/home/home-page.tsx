'use client';

import { CatalogueBoundary } from '@/components/layout/catalogue-boundary';
import { ButtonLink } from '@/components/ui/button-link';
import { Img } from '@/components/ui/image';
import { Heading } from '@/components/ui/section-heading';
import { Newsletter } from '@/features/content/newsletter';
import { MachineGrid } from '@/features/machines/machine-grid';
import { ProductCard } from '@/features/products/product-card';
import { ServiceGrid } from '@/features/services/service-grid';
import { useCatalogue } from '@/providers/store-provider';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Camera,
  ClipboardList,
  Crown,
  Headphones,
  Package,
  Settings,
  ShieldCheck,
  Truck,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';

export function Home() {
  const catalogue = useCatalogue();
  const icons = [Settings, Truck, Wrench, Headphones];
  return (
    <>
      <section className="hero">
        <Img
          src="/assets/hero-machines.webp"
          alt="Stainless steel industrial laundry machines"
          className="hero-photo"
          priority
        />
        <div className="container hero-inner">
          <div className="hero-copy">
            <h1>
              Complete <br />
              Laundry Solutions
              <br />
              for <em>Your Business</em>
            </h1>
            <p>
              Industrial Laundry Equipment | Spare Parts | Installation
              <br />
              AMC / CMC | Service Support | Detergents
            </p>
            <div className="actions">
              <ButtonLink href="/spare-parts">
                Shop Spare Parts <ArrowRight size={17} />
              </ButtonLink>
              <ButtonLink href="/machines" secondary>
                Explore Machines
              </ButtonLink>
            </div>
          </div>
          <div className="hero-seal">
            <Crown size={30} />
            <span>
              <strong>20+</strong> Years of Excellence
              <br />
              in Laundry Industry
            </span>
          </div>
        </div>
        <div className="container hero-benefits">
          {[
            ['Genuine Spare Parts', 'Wide Range & Ready Stock'],
            ['Pan India Delivery', 'Safe & Secure Shipping'],
            ['Expert Installation', 'By Trained Technicians'],
            ['Reliable After-Sales Service', 'For Long Term Support'],
          ].map(([a, b], i) => {
            const Icon = icons[i];
            return (
              <div key={a}>
                <Icon />
                <span>
                  <strong>{a}</strong>
                  <small>{b}</small>
                </span>
              </div>
            );
          })}
        </div>
      </section>
      {/* The hero needs no data; only the catalogue sections wait for it. */}
      <CatalogueBoundary>
        <section className="container section categories-section">
          <Heading title="Shop by Category" href="/spare-parts" label="View All Categories" />
          <div className="category-grid">
            {catalogue.categories.map((c) => (
              <Link href={'/spare-parts?category=' + c.slug} key={c._id} className="category-card">
                <Img src={c.image} alt={c.name} />
                <strong>{c.name}</strong>
              </Link>
            ))}
          </div>
        </section>
        <section className="container section">
          <Heading
            title="Popular Spare Parts"
            subtitle="Find spare parts for your industrial laundry equipment."
            href="/spare-parts"
            label="View All Products"
          />
          <div className="product-grid home-products">
            {catalogue.products.slice(0, 6).map((p) => (
              <ProductCard key={p._id} p={p} />
            ))}
          </div>
        </section>
        <section className="tinted">
          <div className="container section">
            <Heading
              title="Our Laundry Machines"
              subtitle="Industrial equipment for commercial laundry operations."
              href="/machines"
              label="View All Machines"
            />
            <MachineGrid />
          </div>
        </section>
        <section className="container section">
          <Heading
            title="Our Services"
            subtitle="Support for your laundry equipment throughout its lifecycle."
            href="/services"
            label="View All Services"
          />
          <ServiceGrid />
        </section>
        <section className="why">
          <div className="container section">
            <Heading
              title="Why Choose Megha?"
              subtitle="Equipment, spare parts and service in one place."
            />
            <div className="trust-grid">
              {[
                [BadgeCheck, 'Equipment expertise'],
                [ClipboardList, 'Technical guidance'],
                [ShieldCheck, 'Quality focused'],
                [Package, 'Wide range of spares'],
                [Headphones, 'Technical support'],
                [Building2, 'Commercial solutions'],
              ].map(([I, t]) => {
                const Icon = I as typeof Package;
                return (
                  <div key={String(t)}>
                    <Icon />
                    <strong>{String(t)}</strong>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
        <section className="container section">
          <div className="find-banner">
            <div className="round-icon">
              <Camera size={34} />
            </div>
            <div>
              <h2>Can’t Find Your Spare Part?</h2>
              <p>
                Describe the part you need. Our technical team will help you
                <br className="desktop" /> identify the right spare for your equipment.
              </p>
            </div>
            <ButtonLink href="/find-my-spare" secondary>
              <Camera size={17} /> Find My Spare
            </ButtonLink>
            <Link href="/contact" className="outline-light">
              Send Enquiry
            </Link>
          </div>
        </section>
        <section className="container section industries">
          <Heading
            title="Supporting Professional Laundry Operations"
            subtitle="Equipment and spare-part enquiries for a range of industries."
          />
          <div>
            <span>HOTELS & RESORTS</span>
            <span>HOSPITALS</span>
            <span>COMMERCIAL LAUNDRIES</span>
            <span>INSTITUTIONS</span>
            <span>INDUSTRIAL FACILITIES</span>
          </div>
        </section>
        <section className="container section">
          <Heading
            title="Latest Updates & Resources"
            subtitle="Practical guidance for your laundry operation."
            href="/faq"
          />
          <div className="resource-grid">
            {[
              'Maintaining Your Industrial Washing Machine',
              'Identifying the Right Spare Part',
              'Planning Your Laundry Equipment',
            ].map((title, i) => (
              <Link href={'/resources/' + i} className="resource-card" key={title}>
                <Img src={'/assets/article-' + i + '.webp'} alt={title} />
                <div>
                  <h3>{title}</h3>
                  <span>
                    Read More <ArrowRight size={14} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </CatalogueBoundary>
      <Newsletter />
    </>
  );
}
