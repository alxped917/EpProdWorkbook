"use client";

import { useEffect, useRef, useState } from "react";
import { saveCount, saveShelfMin } from "@/actions/inventory";
import { inputClass } from "./ui";

export function CountEditor({
  rows,
}: {
  rows: { productId: string; warehouseId: string; name: string; category: string; onHand: number; shelfMin: number }[];
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <table className="min-w-full text-sm">
        <thead className="bg-sunken text-left text-muted">
          <tr>
            <th className="px-3 py-2 font-medium">Product</th>
            <th className="px-3 py-2 font-medium">System lb</th>
            <th className="px-3 py-2 font-medium">Counted lb</th>
            <th className="px-3 py-2 font-medium">Shelf min</th>
            <th className="px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <CountRow key={row.productId} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CountRow({ row }: { row: { productId: string; warehouseId: string; name: string; category: string; onHand: number; shelfMin: number } }) {
  const [counted, setCounted] = useState(String(row.onHand));
  const [min, setMin] = useState(String(row.shelfMin));
  const [onHand, setOnHand] = useState(row.onHand);
  const [status, setStatus] = useState("Saved");
  const savedCount = useRef(String(row.onHand));
  const savedMin = useRef(String(row.shelfMin));

  useEffect(() => {
    if (counted === savedCount.current) return;
    const handle = setTimeout(async () => {
      const value = Number(counted);
      if (!Number.isFinite(value)) {
        setStatus("Enter a number");
        return;
      }
      setStatus("Saving…");
      const result = await saveCount({ warehouseId: row.warehouseId, productId: row.productId, countedLbs: value });
      if (!result.ok) {
        setStatus(result.error);
        return;
      }
      savedCount.current = String(result.onHand);
      setCounted(savedCount.current);
      setOnHand(result.onHand);
      setStatus("Saved");
    }, 500);
    return () => clearTimeout(handle);
  }, [counted, row.productId, row.warehouseId]);

  useEffect(() => {
    if (min === savedMin.current) return;
    const handle = setTimeout(async () => {
      const value = Number(min);
      if (!Number.isFinite(value)) return;
      const result = await saveShelfMin({ warehouseId: row.warehouseId, productId: row.productId, shelfMinLbs: value });
      if (!result.ok) setStatus(result.error);
      else {
        savedMin.current = String(value);
        setStatus("Saved");
      }
    }, 500);
    return () => clearTimeout(handle);
  }, [min, row.productId, row.warehouseId]);

  return (
    <tr className="border-t border-line">
      <td className="px-3 py-3">
        <p className="font-medium">{row.name}</p>
        <p className="text-xs text-muted">{row.category}</p>
      </td>
      <td className="px-3 py-3">{onHand}</td>
      <td className="px-3 py-3">
        <input className={inputClass} inputMode="decimal" aria-label={`Counted pounds for ${row.name}`} value={counted} onChange={(e) => setCounted(e.target.value)} />
      </td>
      <td className="px-3 py-3">
        <input className={inputClass} inputMode="decimal" aria-label={`Shelf minimum for ${row.name}`} value={min} onChange={(e) => setMin(e.target.value)} />
      </td>
      <td className="px-3 py-3 text-muted">{status}</td>
    </tr>
  );
}
