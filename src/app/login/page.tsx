import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/auth";
import { homePath } from "@/lib/permissions";
import { db } from "@/lib/db";
import { isProductionEnv } from "@/lib/seed-plan";
import { one } from "@/lib/search";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (user) redirect(homePath(user.permissions));
  if (isProductionEnv(process.env)) {
    let accounts = 0;
    try {
      accounts = await db.user.count();
    } catch {
      accounts = 0;
    }
    if (accounts === 0) redirect("/setup");
  }
  const sp = await searchParams;
  const showDemo = !isProductionEnv(process.env);
  const hint = showDemo ? process.env.SEED_PASSWORD || "demo-pass-7783" : "";
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-[#221e19] p-10 text-[#f6f1e7] lg:flex">
        <div>
          <div className="grid h-12 w-12 grid-rows-3 overflow-hidden rounded-xl">
            <span className="bg-amber-700" />
            <span className="bg-stone-400" />
            <span className="bg-sky-900" />
          </div>
          <h1 className="mt-8 max-w-md text-4xl font-semibold tracking-tight">Workbook</h1>
          <p className="mt-3 max-w-md text-[#cbbfaa]">
            Weigh materials out for the job, weigh the leftovers back in, and see what the floor actually cost.
          </p>
        </div>
        <p className="text-sm text-[#cbbfaa]">Endless Poxybilities Concrete Coating · sample data only</p>
      </section>
      <section className="flex items-center justify-center bg-canvas px-6 py-12">
        <div className="w-full max-w-md">
          <h2 className="text-2xl font-semibold">Sign in</h2>
          <p className="mt-2 text-sm text-muted">
            {showDemo ? `Sample password from SEED_PASSWORD. The default demo password is ${hint}.` : "Use the email and password you saved when you set up the site."}
          </p>
          <div className="mt-6">
            <LoginForm next={one(sp.next)} passwordHint={hint} showSamples={showDemo} />
          </div>
        </div>
      </section>
    </main>
  );
}
