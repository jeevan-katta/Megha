import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="container page empty">
      <h1>Page not found</h1>
      <p>The page may have moved or the address may be incorrect.</p>
      <Link href="/" className="button">
        Back to Home
      </Link>
    </main>
  );
}
