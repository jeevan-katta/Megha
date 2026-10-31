import type { Metadata } from 'next';
import { RequestPage } from '@/features/enquiries/request-page';
export const metadata: Metadata = {
  title: 'Send an Enquiry',
  description: 'Ask for a quotation on laundry machines, bulk spare parts or service contracts.',
};
export default function Page() {
  return <RequestPage />;
}
