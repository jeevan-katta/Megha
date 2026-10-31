import { redirect } from 'next/navigation';
// Addresses now live on the combined profile page.
export default function Page() {
  redirect('/account/profile#addresses');
}
