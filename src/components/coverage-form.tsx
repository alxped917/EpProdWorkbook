"use client";

import { useMemo, useState } from "react";
import { saveCoverage } from "@/actions/admin";
import { COMPONENT_KEYS, COMPONENTS, FLAKE_SIZES, calculatePickSheet, defaultCoverage, type CoverageConfig, type ComponentKey, type FlakeSize } from "@/lib/coverage";
import { inputClass } from "./ui";

export function CoverageForm({
  initial,
  tolerance,
  winterMonths,
  timezone,
  warehouses,
}: {
  initial: CoverageConfig;
  tolerance: number;
  winterMonths: string;
  timezone: string;
  warehouses: string[];
}) {
  const [config, setConfig] = useState(initial);
  const preview = useMemo(
    () =>
      calculatePickSheet(
        { squareFeet: 707, verticalLf: 0, stairsLf: 0, flakeSize: "1/4", season: "summer", include: { moisture: false, gator: false, baseCd: false, topCd: false } },
        config,
      ),
    [config],
  );

  function setFloor(key: ComponentKey, size: FlakeSize, value: string) {
    const n = Number(value);
    setConfig((current) => ({
      ...current,
      floorLbsPerSqft: {
        ...current.floorLbsPerSqft,
        [key]: { ...current.floorLbsPerSqft[key], [size]: Number.isFinite(n) ? n : 0 },
      },
    }));
  }

  return (
    <form action={saveCoverage} className="space-y-4">
      <input type="hidden" name="coverage" value={JSON.stringify(config)} />
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-sm">Variance tolerance %
          <input className={inputClass} name="tolerance" defaultValue={tolerance} />
        </label>
        <label className="text-sm">Winter months
          <input className={inputClass} name="winterMonths" defaultValue={winterMonths} />
        </label>
        <label className="text-sm">Timezone
          <input className={inputClass} name="timezone" defaultValue={timezone} />
        </label>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="min-w-full text-sm">
          <thead className="bg-sunken text-left">
            <tr>
              <th className="px-2 py-2">Component</th>
              {FLAKE_SIZES.map((size) => <th key={size} className="px-2 py-2">lb / sq ft · {size}</th>)}
              <th className="px-2 py-2">Vertical lb/ft</th>
              <th className="px-2 py-2">Stair lb/ft</th>
            </tr>
          </thead>
          <tbody>
            {COMPONENT_KEYS.map((key) => (
              <tr key={key} className="border-t border-line">
                <td className="px-2 py-2">{COMPONENTS.find((c) => c.key === key)?.label}</td>
                {FLAKE_SIZES.map((size) => (
                  <td key={size} className="px-2 py-2">
                    <input className={inputClass} value={config.floorLbsPerSqft[key][size]} onChange={(e) => setFloor(key, size, e.target.value)} />
                  </td>
                ))}
                <td className="px-2 py-2">
                  <input className={inputClass} value={config.verticalLbsPerLf[key]} onChange={(e) => setConfig({ ...config, verticalLbsPerLf: { ...config.verticalLbsPerLf, [key]: Number(e.target.value) || 0 } })} />
                </td>
                <td className="px-2 py-2">
                  <input className={inputClass} value={config.stairLbsPerLf[key]} onChange={(e) => setConfig({ ...config, stairLbsPerLf: { ...config.stairLbsPerLf, [key]: Number(e.target.value) || 0 } })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm">Summer multiplier
          <input className={inputClass} value={config.seasonMultiplier.summer} onChange={(e) => setConfig({ ...config, seasonMultiplier: { ...config.seasonMultiplier, summer: Number(e.target.value) || 0 } })} />
        </label>
        <label className="text-sm">Winter multiplier
          <input className={inputClass} value={config.seasonMultiplier.winter} onChange={(e) => setConfig({ ...config, seasonMultiplier: { ...config.seasonMultiplier, winter: Number(e.target.value) || 0 } })} />
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {warehouses.map((name) => (
          <label key={name} className="text-sm">{name} location factor
            <input className={inputClass} value={config.locationFactors[name] ?? 1} onChange={(e) => setConfig({ ...config, locationFactors: { ...config.locationFactors, [name]: Number(e.target.value) || 1 } })} />
          </label>
        ))}
      </div>
      <button className="min-h-11 rounded-xl bg-accent px-4 text-sm font-medium text-accent-ink" type="submit">Save coverage rates</button>
      <button className="ml-2 min-h-11 rounded-xl border border-line px-4 text-sm" type="button" onClick={() => setConfig(defaultCoverage())}>Reset to reference defaults</button>
      <div className="rounded-2xl border border-line bg-sunken/50 p-4 text-sm">
        <p className="font-medium">Check against 707 sq ft, 1/4 inch, summer</p>
        <p className="mt-1 text-muted">Reference: flake 101, Base A 26.7, Base B 13.4, Top A 34, Top B 34.</p>
        <p className="mt-2">{preview.lines.map((line) => `${line.label} ${line.lbs}`).join(" · ")}</p>
      </div>
    </form>
  );
}
