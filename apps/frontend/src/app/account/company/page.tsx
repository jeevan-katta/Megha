import { redirect } from 'next/navigation';
// Company details now live on the combined profile page.
export default function Page() {
  redirect('/account/profile#details');
}
