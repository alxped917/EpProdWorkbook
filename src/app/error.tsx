"use client";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-lg px-6 py-24">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted">{error.message || "The page could not be loaded."}</p>
      <button className="mt-4 min-h-11 rounded-xl bg-accent px-4 text-accent-ink" onClick={() => reset()} type="button">Try again</button>
    </main>
  );
}
