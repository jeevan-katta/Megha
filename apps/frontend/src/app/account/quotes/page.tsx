import { redirect } from 'next/navigation';
// Quotation requests are part of enquiries.
export default function Page() {
  redirect('/account/enquiries');
}
