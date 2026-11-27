import Link from "next/link";
import { cn } from "@/lib/cn";

export function Card({ children, className, title, action }: { children: React.ReactNode; className?: string; title?: string; action?: React.ReactNode }) {
  return (
    <section className={cn("rounded-2xl border border-line bg-panel p-4 md:p-5", className)}>
      {(title || action) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          {title ? <h2 className="text-base font-semibold">{title}</h2> : <span />}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Flash({ notice, error }: { notice?: string; error?: string }) {
  if (!notice && !error) return null;
  return (
    <p className={cn("mb-4 rounded-xl border px-3 py-2 text-sm", error ? "border-danger/40 bg-danger/10 text-danger" : "border-ok/40 bg-ok/10 text-ok")} role="status">
      {error || notice}
    </p>
  );
}

const tones = {
  neutral: "bg-sunken text-ink",
  accent: "bg-accent/15 text-accent",
  ok: "bg-ok/15 text-ok",
  danger: "bg-danger/15 text-danger",
};

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: keyof typeof tones }) {
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>;
}

export function statusTone(status: string): keyof typeof tones {
  if (status === "IN_PROGRESS") return "accent";
  if (status === "COMPLETED") return "ok";
  if (status === "CANCELLED") return "danger";
  return "neutral";
}

export function buttonClass(variant: "primary" | "outline" | "ghost" | "danger" = "outline") {
  const base = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50";
  if (variant === "primary") return cn(base, "bg-accent text-accent-ink hover:brightness-105");
  if (variant === "danger") return cn(base, "bg-danger text-white");
  if (variant === "ghost") return cn(base, "hover:bg-sunken");
  return cn(base, "border border-line bg-panel hover:bg-sunken");
}

export function ButtonLink({ href, children, variant = "outline" }: { href: string; children: React.ReactNode; variant?: "primary" | "outline" | "ghost" | "danger" }) {
  return <Link className={buttonClass(variant)} href={href}>{children}</Link>;
}

export const inputClass = "w-full min-h-11 rounded-xl border border-line bg-canvas px-3 py-2 text-base text-ink outline-none ring-accent/40 placeholder:text-muted focus:ring-2";
export const labelClass = "mb-1 block text-sm font-medium";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">{children}</p>;
}
