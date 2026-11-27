"use client";

import { useState } from "react";
import { runFirstSetup } from "@/actions/setup";
import { inputClass } from "./ui";

export function SetupForm() {
  const [error, setError] = useState("");
  async function onSubmit(formData: FormData) {
    const result = await runFirstSetup(formData);
    if (result?.error) setError(result.error);
  }
  return (
    <form action={onSubmit} className="mt-6 space-y-3">
      <label className="block text-sm">
        Setup code
        <input className={inputClass} name="secret" type="password" autoComplete="off" required />
      </label>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <button className="min-h-11 rounded-xl bg-accent px-4 text-sm font-medium text-accent-ink" type="submit">Create the admin account</button>
    </form>
  );
}
