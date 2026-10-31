import type { Metadata } from 'next';
import { Information } from '@/features/content/information-page';
export const metadata: Metadata = {
  title: 'About Us',
  description:
    'Megha Laundry Equipment: industrial laundry machines, genuine spare parts, installation and after-sales service across India.',
};
export default function Page() {
  return <Information />;
}
