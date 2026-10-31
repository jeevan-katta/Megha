import type { Metadata } from 'next';
import { RequestPage } from '@/features/enquiries/request-page';
export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Contact Megha Laundry Equipment for machines, spare parts and service support.',
};
export default function Page() {
  return <RequestPage />;
}
