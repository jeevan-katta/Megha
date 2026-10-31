import { ResetPassword } from '@/features/auth/reset-password';
import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Reset Password',
  robots: { index: false, follow: false },
};
export default function Page() {
  return <ResetPassword />;
}
