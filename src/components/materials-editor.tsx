"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveWeights, scanBarcode } from "@/actions/inventory";
import { inputClass, labelClass } from "./ui";

type Row = {
  productId: string;
  name: string;
  category: string;
  plannedLbs: number | null;
  boxes: string | null;
  lbsCheckedOut: number;
  lbsCheckedIn: number;
  onHand: number;
  weighOnly: boolean;
};

export function MaterialsEditor({ jobId, rows, locked }: { jobId: string; rows: Row[]; locked: boolean }) {
  return (
    <div className="space-y-4">
      <BarcodeBox jobId={jobId} disabled={locked} />
      {rows.map((row) => (
        <MaterialRow key={row.productId} jobId={jobId} row={row} locked={locked} />
      ))}
    </div>
  );
}

function BarcodeBox({ jobId, disabled }: { jobId: string; disabled: boolean }) {
  const router = useRouter();
  const [barcode, setBarcode] = useState("");
  const [lbs, setLbs] = useState("");
  const [direction, setDirection] = useState<"out" | "in">("out");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    const parsed = lbs.trim() ? Number(lbs) : null;
    const result = await scanBarcode({ jobId, barcode, direction, lbs: parsed });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(result.message);
    setBarcode("");
    setLbs("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-line bg-sunken/60 p-4">
      <p className="text-sm font-medium">Scan or type a barcode</p>
      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_8rem_9rem_auto]">
        <input className={inputClass} value={barcode} disabled={disabled} placeholder="IS-XXXXXXXX-XXXX" onChange={(e) => setBarcode(e.target.value)} aria-label="Barcode" />
        <input className={inputClass} value={lbs} disabled={disabled} inputMode="decimal" placeholder="Lbs" onChange={(e) => setLbs(e.target.value)} aria-label="Pounds for this scan" />
        <select className={inputClass} value={direction} disabled={disabled} onChange={(e) => setDirection(e.target.value as "out" | "in")} aria-label="Direction">
          <option value="out">Check out</option>
          <option value="in">Check in</option>
        </select>
        <button className="min-h-11 rounded-xl bg-accent px-4 text-sm font-medium text-accent-ink" disabled={disabled} type="submit">Apply</button>
      </div>
      <p className="mt-2 text-xs text-muted">Leave pounds blank to move the whole container. Format is IS-XXXXXXXX-XXXX.</p>
      {message ? <p className="mt-2 text-sm text-ok">{message}</p> : null}
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </form>
  );
}

function MaterialRow({ jobId, row, locked }: { jobId: string; row: Row; locked: boolean }) {
  const router = useRouter();
  const [out, setOut] = useState(String(row.lbsCheckedOut));
  const [inn, setIn] = useState(String(row.lbsCheckedIn));
  const [onHand, setOnHand] = useState(row.onHand);
  const [status, setStatus] = useState<"saved" | "saving" | "error">("saved");
  const [message, setMessage] = useState("");
  const saved = useRef({ out: String(row.lbsCheckedOut), inn: String(row.lbsCheckedIn) });

  useEffect(() => {
    setOnHand(row.onHand);
  }, [row.onHand]);

  useEffect(() => {
    if (out !== saved.current.out || inn !== saved.current.inn) return;
    const nextOut = String(row.lbsCheckedOut);
    const nextIn = String(row.lbsCheckedIn);
    if (nextOut === out && nextIn === inn) return;
    saved.current = { out: nextOut, inn: nextIn };
    setOut(nextOut);
    setIn(nextIn);
  }, [row.lbsCheckedOut, row.lbsCheckedIn, out, inn]);

  useEffect(() => {
    if (out === saved.current.out && inn === saved.current.inn) return;
    const handle = setTimeout(async () => {
      const outN = Number(out);
      const inN = Number(inn);
      if (out.trim() === "" || inn.trim() === "" || !Number.isFinite(outN) || !Number.isFinite(inN)) {
        setStatus("error");
        setMessage("Enter both weights as numbers");
        return;
      }
      setStatus("saving");
      const result = await saveWeights({ jobId, productId: row.productId, lbsCheckedOut: outN, lbsCheckedIn: inN });
      if (!result.ok) {
        setStatus("error");
        setMessage(result.error);
        return;
      }
      saved.current = { out: String(result.lbsCheckedOut), inn: String(result.lbsCheckedIn) };
      setOut(saved.current.out);
      setIn(saved.current.inn);
      setOnHand(result.onHand);
      setStatus("saved");
      setMessage("");
      router.refresh();
    }, 450);
    return () => clearTimeout(handle);
  }, [out, inn, jobId, row.productId, router]);

  const used = (Number(out) || 0) - (Number(inn) || 0);
  return (
    <article className="rounded-2xl border border-line bg-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">{row.name}</h3>
          <p className="text-sm text-muted">{row.category === "FLAKE" ? "Color & finish" : row.category === "SUPPLY" ? "Supply" : "Chemical"}</p>
        </div>
        <p className="text-sm text-muted">On hand {onHand.toLocaleString()} lb</p>
      </div>
      <p className="mt-2 text-sm">
        {row.plannedLbs == null
          ? row.weighOnly
            ? "Weigh only — not on the calculated pick sheet."
            : "No pick-sheet quantity yet."
          : `Pick sheet says ${row.plannedLbs} lb${row.boxes ? `, about ${row.boxes}` : ""}.`}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label>
          <span className={labelClass}>Lbs checked out</span>
          <input className={inputClass} inputMode="decimal" disabled={locked} value={out} onChange={(e) => setOut(e.target.value)} />
        </label>
        <label>
          <span className={labelClass}>Lbs checked in</span>
          <input className={inputClass} inputMode="decimal" disabled={locked} value={inn} onChange={(e) => setIn(e.target.value)} />
        </label>
      </div>
      <p className="mt-2 text-sm" aria-live="polite">
        Used {Number.isFinite(used) ? used.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"} lb
        <span className="ml-3 text-muted">
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : message}
        </span>
      </p>
    </article>
  );
}
