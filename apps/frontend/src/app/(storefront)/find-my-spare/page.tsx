import type { Metadata } from 'next';
import { RequestPage } from '@/features/enquiries/request-page';
export const metadata: Metadata = {
  title: 'Find My Spare Part',
  description:
    'Describe the part you need and our technical team will identify the right spare for your laundry machine.',
};
export default function Page() {
  return <RequestPage />;
}
