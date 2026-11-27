"use client";

import { useMemo, useState } from "react";
import { savePickSheet } from "@/actions/jobs";
import { aboutBoxes, calculatePickSheet, formatBoxes, locationFactorFor, stockStatus, type CoverageConfig, type FlakeSize } from "@/lib/coverage";
import { resolveComponentProduct, type PickProduct } from "@/lib/pick-build";
import { inputClass, labelClass } from "./ui";

export function PickSheetForm({
  job,
  coverage,
  products,
  componentMap,
  onHand,
  warehouseName,
}: {
  job: {
    id: string;
    squareFootage: number | null;
    verticalLf: number;
    stairsLf: number;
    flakeSize: string;
    flakeColor: string;
    season: string;
    scheduledDate: string | null;
    includeMoisture: boolean;
    includeGator: boolean;
    includeBaseCd: boolean;
    includeTopCd: boolean;
  };
  coverage: CoverageConfig;
  products: (PickProduct & { weightPerBox: number | null })[];
  componentMap: Record<string, string>;
  onHand: Record<string, number>;
  warehouseName: string | null;
}) {
  const [sqft, setSqft] = useState(job.squareFootage ?? 0);
  const [vertical, setVertical] = useState(job.verticalLf);
  const [stairs, setStairs] = useState(job.stairsLf);
  const [size, setSize] = useState<FlakeSize>(job.flakeSize === "1/8" || job.flakeSize === "1/16" ? job.flakeSize : "1/4");
  const [season, setSeason] = useState(job.season || "summer");
  const [color, setColor] = useState(job.flakeColor);
  const [date, setDate] = useState(job.scheduledDate ?? "");
  const [include, setInclude] = useState({
    moisture: job.includeMoisture,
    gator: job.includeGator,
    baseCd: job.includeBaseCd,
    topCd: job.includeTopCd,
  });

  const preview = useMemo(() => {
    const resolvedSeason = season === "winter" ? "winter" : "summer";
    const lines = calculatePickSheet(
      {
        squareFeet: Number(sqft) || 0,
        verticalLf: Number(vertical) || 0,
        stairsLf: Number(stairs) || 0,
        flakeSize: size,
        season: resolvedSeason,
        locationFactor: locationFactorFor(coverage, warehouseName),
        include,
      },
      coverage,
    );
    return [...lines.lines, ...lines.weighOnly].map((line) => {
      const productId = resolveComponentProduct(line.key, color, products, componentMap);
      const product = products.find((item) => item.id === productId);
      const boxes = product ? aboutBoxes(line.lbs, product.weightPerBox ?? null) : null;
      const hand = productId ? onHand[productId] ?? 0 : null;
      return { ...line, product: product?.name ?? null, boxes: formatBoxes(boxes), stock: stockStatus(product ? hand : null, line.lbs), hand };
    });
  }, [sqft, vertical, stairs, size, season, include, color, coverage, products, componentMap, onHand, warehouseName]);

  return (
    <form action={savePickSheet} className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <input type="hidden" name="id" value={job.id} />
      <div className="space-y-3 rounded-2xl border border-line bg-panel p-4">
        <label className="block"><span className={labelClass}>Floor square feet</span>
          <input className={inputClass} name="squareFootage" inputMode="decimal" value={sqft} onChange={(e) => setSqft(Number(e.target.value))} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className={labelClass}>Verticals (linear ft)</span>
            <input className={inputClass} name="verticalLf" inputMode="decimal" value={vertical} onChange={(e) => setVertical(Number(e.target.value))} />
          </label>
          <label className="block"><span className={labelClass}>Stairs (linear ft)</span>
            <input className={inputClass} name="stairsLf" inputMode="decimal" value={stairs} onChange={(e) => setStairs(Number(e.target.value))} />
          </label>
        </div>
        <label className="block"><span className={labelClass}>Flake size</span>
          <select className={inputClass} name="flakeSize" value={size} onChange={(e) => setSize(e.target.value as FlakeSize)}>
            <option value="1/4">1/4 inch</option>
            <option value="1/8">1/8 inch</option>
            <option value="1/16">1/16 inch</option>
          </select>
        </label>
        <label className="block"><span className={labelClass}>Flake color</span>
          <input className={inputClass} name="flakeColor" list="flake-colors" value={color} onChange={(e) => setColor(e.target.value)} />
          <datalist id="flake-colors">
            {products.filter((p) => p.category === "FLAKE").map((p) => <option key={p.id} value={p.name} />)}
          </datalist>
        </label>
        <label className="block"><span className={labelClass}>Season</span>
          <select className={inputClass} name="season" value={season} onChange={(e) => setSeason(e.target.value)}>
            <option value="summer">Summer</option>
            <option value="winter">Winter</option>
            <option value="auto">Auto from install date</option>
          </select>
        </label>
        <label className="block"><span className={labelClass}>Install date</span>
          <input className={inputClass} type="date" name="scheduledDate" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <p className="text-sm text-muted">Location factor uses {warehouseName ?? "no warehouse"}.</p>
        {([
          ["includeMoisture", "moisture", "Moisture barrier"],
          ["includeGator", "gator", "Gator / Shark Bite"],
          ["includeBaseCd", "baseCd", "Base C / D"],
          ["includeTopCd", "topCd", "Top C / D"],
        ] as const).map(([name, key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name={name} checked={include[key]} onChange={(e) => setInclude({ ...include, [key]: e.target.checked })} />
            {label}
          </label>
        ))}
        <button className="min-h-11 rounded-xl bg-accent px-4 text-sm font-medium text-accent-ink" type="submit">Save pick sheet</button>
      </div>
      <div className="rounded-2xl border border-line bg-panel p-4">
        <h2 className="font-semibold">Live quantities</h2>
        <p className="mt-1 text-sm text-muted">Rates come from workspace coverage settings, not a fixed formula.</p>
        <ul className="mt-3 divide-y divide-line">
          {preview.map((line) => (
            <li key={line.key} className="py-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="font-medium">{line.label}</span>
                <span>{line.mode === "weigh-only" ? "Weigh only" : `${line.lbs} lb`}</span>
              </div>
              <p className="text-muted">
                {line.product ?? "Not mapped"}
                {line.mode === "weigh-only" ? "" : ` · about ${line.boxes}`}
                {line.stock === "none" ? " · none in stock" : line.stock === "short" ? ` · short (on hand ${line.hand} lb)` : ""}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </form>
  );
}
