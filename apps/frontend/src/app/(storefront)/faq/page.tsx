import type { Metadata } from 'next';
import { Information } from '@/features/content/information-page';
export const metadata: Metadata = {
  title: 'Frequently Asked Questions',
  description:
    'Answers about ordering spare parts, machine quotations, delivery and service from Megha Laundry Equipment.',
};
export default function Page() {
  return <Information />;
}
