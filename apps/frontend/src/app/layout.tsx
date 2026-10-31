import { StoreProvider } from '@/providers/store-provider';
import { QueryProvider } from '@/providers/query-provider';
import type { Metadata } from 'next';
import { siteUrl } from '@/lib/server-api';
import './globals.css';
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Megha Laundry Equipment | Machines, Spare Parts & Service',
    template: '%s | Megha Laundry Equipment',
  },
  description:
    'Discover industrial laundry equipment, spare parts and technical services from Megha Laundry Equipment.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <StoreProvider>{children}</StoreProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
