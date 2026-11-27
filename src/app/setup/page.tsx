import { SetupForm } from "@/components/setup-form";
import { db } from "@/lib/db";
import { isProductionEnv, resolveSeedPlan } from "@/lib/seed-plan";

export const dynamic = "force-dynamic";

export const metadata = { title: "Set up Workbook" };

export default async function SetupPage() {
  if (!isProductionEnv(process.env)) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <h1 className="text-2xl font-semibold">Setup is for the live site</h1>
        <p className="mt-3 text-sm text-muted">On your own computer, run <code>npm run db:seed</code> and then open the sign-in page.</p>
      </main>
    );
  }
  let users = -1;
  try {
    users = await db.user.count();
  } catch {
    users = -1;
  }
  if (users > 0) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <h1 className="text-2xl font-semibold">Workbook is already set up</h1>
        <p className="mt-3 text-sm text-muted">Sign in with the email and password you saved in Vercel.</p>
        <a className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-accent px-4 text-sm font-medium text-accent-ink" href="/login">Go to sign in</a>
      </main>
    );
  }
  const plan = resolveSeedPlan(process.env);
  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <h1 className="text-2xl font-semibold">Create the first account</h1>
      <p className="mt-3 text-sm text-muted">
        This loads the six warehouses, the product list, and the coverage rates, then creates one admin sign-in.
        It does not load practice jobs.
      </p>
      {users < 0 ? <p className="mt-4 text-sm text-danger">The database is not ready yet. Wait until the Vercel deploy says Ready, then refresh this page.</p> : null}
      {!plan.ok ? <p className="mt-4 text-sm text-danger">{plan.error}</p> : <p className="mt-4 text-sm">The new sign-in email will be <strong>{plan.adminEmail}</strong>.</p>}
      {plan.ok && users >= 0 ? <SetupForm /> : null}
    </main>
  );
}
