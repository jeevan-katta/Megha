import { redirect } from 'next/navigation';
// Quotation requests are managed under enquiries.
export default function Page() {
  redirect('/admin/enquiries');
}
