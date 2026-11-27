"use client";

import { useState } from "react";
import { login } from "@/actions/auth";
import { inputClass, labelClass } from "./ui";

const samples = [
  ["Admin", "avery.quinn@epoxy.example"],
  ["Installer", "morgan.hale@epoxy.example"],
  ["Warehouse", "reese.patel@epoxy.example"],
];

export function LoginForm({ next, passwordHint }: { next?: string; passwordHint: string }) {
  const [error, setError] = useState("");
  const [email, setEmail] = useState("avery.quinn@epoxy.example");
  const [password, setPassword] = useState(passwordHint);

  async function onSubmit(formData: FormData) {
    const result = await login(formData);
    if (result?.error) setError(result.error);
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <label className="block">
        <span className={labelClass}>Email</span>
        <input className={inputClass} name="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label className="block">
        <span className={labelClass}>Password</span>
        <input className={inputClass} name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <button className="min-h-11 w-full rounded-xl bg-accent font-medium text-accent-ink" type="submit">Sign in</button>
      <div className="flex flex-wrap gap-2">
        {samples.map(([label, value]) => (
          <button key={value} className="rounded-full border border-line px-3 py-1 text-xs" type="button" onClick={() => { setEmail(value); setPassword(passwordHint); }}>
            {label}
          </button>
        ))}
      </div>
    </form>
  );
}
