import { CatalogueBoundary } from '@/components/layout/catalogue-boundary';
import { ProductDetail } from '@/features/products/product-detail';
import { plainText, serverProduct, siteUrl } from '@/lib/server-api';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
// Each product page is rendered on first visit with its public product data (name, price,
// description) so search engines and link previews see it, then cached and refreshed every
// five minutes. Live stock and price still come from the catalogue loaded in the browser.
export const dynamicParams = true;
export const revalidate = 300;
export function generateStaticParams() {
  return [];
}
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await serverProduct((await params).slug);
  if (!product) return { title: 'Spare part' };
  const description =
    plainText(product.description) || `${product.name} (${product.sku}) from Megha Laundry.`;
  return {
    title: product.name,
    description,
    alternates: { canonical: siteUrl + '/product/' + product.slug },
    openGraph: { title: product.name, description, images: [product.image], type: 'website' },
  };
}
export default async function Page({ params }: Props) {
  const { slug } = await params;
  const product = await serverProduct(slug);
  // Only a definite "not found" from the API is a 404; if the API is unreachable the
  // browser loads the product as before.
  if (product === null) notFound();
  const available = product ? product.stock - product.reserved : 0;
  return (
    <>
      {product && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Product',
              name: product.name,
              sku: product.sku,
              mpn: product.partNumber,
              description: plainText(product.description, 500),
              image: product.image.startsWith('http') ? product.image : siteUrl + product.image,
              offers: {
                '@type': 'Offer',
                priceCurrency: 'INR',
                price: (product.price / 100).toFixed(2),
                availability:
                  available > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
                url: siteUrl + '/product/' + product.slug,
              },
            }).replace(/</g, '\\u003c'),
          }}
        />
      )}
      <CatalogueBoundary ready={!!product}>
        <ProductDetail slug={slug} initial={product ?? undefined} />
      </CatalogueBoundary>
    </>
  );
}
