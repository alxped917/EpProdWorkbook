import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg px-6 py-24">
      <h1 className="text-2xl font-semibold">That page is not here</h1>
      <p className="mt-2 text-sm text-muted">The job or screen may have been deleted.</p>
      <Link className="mt-4 inline-block text-accent" href="/dashboard">Back to the dashboard</Link>
    </main>
  );
}
