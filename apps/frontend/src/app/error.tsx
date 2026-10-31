'use client';
export default function ErrorBoundary({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="container page empty">
      <h1>Unable to load this page</h1>
      <p>Please try again. If the problem continues, contact support.</p>
      <button onClick={reset}>Try Again</button>
    </main>
  );
}
